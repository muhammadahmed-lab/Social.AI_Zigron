const { generateCompletion } = require('../services/unifiedAIService');
const { webSearch } = require('../services/researchService');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ===========================================
// In-memory agent config cache (5-min TTL)
// ===========================================
const configCache = { data: null, timestamp: 0 };
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getCachedConfigs() {
    const now = Date.now();
    if (configCache.data && (now - configCache.timestamp) < CACHE_TTL_MS) {
        return configCache.data;
    }
    const { data } = await supabase.from('agent_configs').select('*').order('agent_id');
    configCache.data = data || [];
    configCache.timestamp = now;
    console.log(`[AGENT-CACHE] Refreshed ${configCache.data.length} agent configs`);
    return configCache.data;
}

// Called by admin update to bust cache immediately
function invalidateConfigCache() {
    configCache.data = null;
    configCache.timestamp = 0;
}

/**
 * GET /api/agents/list — Public metadata (name, description, is_active)
 * Used by the Agents page to show dynamic names/descriptions from DB.
 */
const listAgents = async (req, res) => {
    try {
        const configs = await getCachedConfigs();
        // Return full configs so the user-facing Settings modal can pre-fill prompts
        res.json({ success: true, agents: configs });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * GET /api/agents/:agentId/config — Full agent config for user settings
 * Returns system_prompt, directive_template, ai_provider, ai_model etc.
 */
const getAgentConfig = async (req, res) => {
    try {
        const { agentId } = req.params;
        const configs = await getCachedConfigs();
        const cfg = configs.find(c => c.agent_id === Number(agentId));
        if (!cfg) return res.status(404).json({ error: 'Agent not found' });
        res.json({ success: true, config: cfg });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * Enhanced Agent Runner
 * Orchestrates multiple specialized agents using a unified framework.
 */
const runAgent = async (req, res) => {
    const { email, agent_id, selected_workers, user_overrides } = req.body;

    try {
        console.log(`[AGENT-RUN] Request: Email=${email}, AgentId=${agent_id}`);

        // 1. Unified User Context Retrieval
        const { data: user, error: userErr } = await supabase.from('users').select('id, active_company_id').eq('email', email).single();
        if (userErr || !user) throw new Error('User context missing. Please ensure registration is complete.');

        // 1.5 Guard: Ensure active company exists
        if (!user.active_company_id) {
            throw new Error('Please create and activate a company before running agents. Visit the Company Profile section to add your company.');
        }

        // 2. Fetch Active Company
        const { data: company, error: companyErr } = await supabase
            .from('companies')
            .select('*')
            .eq('id', user.active_company_id)
            .single();

        if (companyErr || !company) {
            throw new Error('Active company not found. Please select a company in Company Profile.');
        }

        // 3. Multimedia / Asset Enrichment - Load brand guidelines text from DB
        const { data: files } = await supabase
            .from('company_files')
            .select('text_content')
            .eq('company_id', company.id)
            .eq('file_type', 'brand_guidelines');

        // Combine text from all brand guideline files
        let brand_guidelines_content = null;
        if (files && files.length > 0) {
            const texts = files.map(f => f.text_content).filter(Boolean);
            brand_guidelines_content = texts.join('\n\n---\n\n') || null;
        }

        let result = null;
        const aid = Number(agent_id);
        const { duration = 'Weekly', start_date = new Date().toISOString().split('T')[0] } = req.body;

        // Build variables map available to all agents
        const variables = {
            COMPANY_NAME: company.name,
            WEBSITE_URL: company.website_url || 'N/A',
            BRAND_CONTEXT: brand_guidelines_content || 'N/A',
            INDUSTRY: company.icp_data?.industry || company.name,
            ICP_SUMMARY: JSON.stringify(company.icp_data || {}),
            PROBLEMS_SUMMARY: JSON.stringify(company.icp_problems || {}),
            DURATION: duration,
            START_DATE: start_date,
        };

        // Load config from cache (DB-backed, 5-min TTL)
        const allConfigs = await getCachedConfigs();
        const agentConfig = allConfigs.find(c => c.agent_id === aid);

        if (agentConfig) {
            // Guard: check if agent is active
            if (agentConfig.is_active === false) {
                throw new Error(`Agent "${agentConfig.name}" is currently disabled by an administrator.`);
            }

            // --- DB-DRIVEN AGENT EXECUTION (with optional user overrides) ---
            const effectiveSystemPrompt = user_overrides?.system_prompt || agentConfig.system_prompt;
            const effectiveDirective = user_overrides?.directive_template || agentConfig.directive_template;
            const effectiveProvider = (user_overrides?.ai_provider && user_overrides.ai_provider !== 'auto')
                ? user_overrides.ai_provider
                : (agentConfig.ai_provider !== 'auto' ? agentConfig.ai_provider : undefined);
            const effectiveModel = user_overrides?.ai_model || agentConfig.ai_model || undefined;

            console.log(`[AGENT-RUN] Executing "${agentConfig.name}" (DB config${user_overrides ? ' + user overrides' : ''}) for ${company.name}`);

            // Run web search if template exists
            let searchData = '';
            if (agentConfig.search_query_template) {
                let searchQuery = agentConfig.search_query_template;
                for (const [key, value] of Object.entries(variables)) {
                    searchQuery = searchQuery.replaceAll(`{{${key}}}`, value);
                }
                searchData = await webSearch(searchQuery);
            }
            variables.RESEARCH_DATA = searchData || 'No search results available.';

            // Replace all {{VAR}} in directive template
            let prompt = effectiveDirective;
            for (const [key, value] of Object.entries(variables)) {
                prompt = prompt.replaceAll(`{{${key}}}`, value);
            }

            result = await generateCompletion(
                effectiveSystemPrompt,
                prompt,
                agentConfig.response_format || 'json_object',
                { provider: effectiveProvider, model: effectiveModel }
            );
        } else {
            // --- FILESYSTEM FALLBACK (safety net) ---
            console.log(`[AGENT-RUN] No DB config for agent ${aid}, using filesystem fallback`);

            if (aid === 1) {
                const searchQuery = `${company.name} ${company.website_url || ''} target audience industry segments and positioning`;
                const searchData = await webSearch(searchQuery);
                const directive = fs.readFileSync(path.join(__dirname, '../../directives/icp_analyst.md'), 'utf-8');
                const prompt = directive
                    .replaceAll('{{COMPANY_NAME}}', company.name)
                    .replaceAll('{{WEBSITE_URL}}', company.website_url || 'N/A')
                    .replaceAll('{{BRAND_CONTEXT}}', brand_guidelines_content || 'N/A')
                    .replaceAll('{{RESEARCH_DATA}}', searchData || 'No search results available.');
                result = await generateCompletion("You are a StoryBrand Strategist.", prompt);
            } else if (aid === 2) {
                const industry = company.icp_data?.industry || company.name;
                const searchQuery = `${industry} ${company.website_url || ''} customer pain points quora reddit frustrations`;
                const searchData = await webSearch(searchQuery);
                const directive = fs.readFileSync(path.join(__dirname, '../../directives/icp_problem_id.md'), 'utf-8');
                const prompt = directive
                    .replaceAll('{{COMPANY_NAME}}', company.name)
                    .replaceAll('{{WEBSITE_URL}}', company.website_url || 'N/A')
                    .replaceAll('{{INDUSTRY}}', industry)
                    .replaceAll('{{ICP_SUMMARY}}', JSON.stringify(company.icp_data || {}))
                    .replaceAll('{{RESEARCH_DATA}}', searchData || 'No search results available.');
                result = await generateCompletion("You are a Problem Identification Expert.", prompt);
            } else if (aid === 3) {
                const directive = fs.readFileSync(path.join(__dirname, '../../directives/content_calendar.md'), 'utf-8');
                const prompt = directive
                    .replaceAll('{{COMPANY_NAME}}', company.name)
                    .replaceAll('{{WEBSITE_URL}}', company.website_url || 'N/A')
                    .replaceAll('{{START_DATE}}', start_date)
                    .replaceAll('{{BRAND_CONTEXT}}', brand_guidelines_content || 'N/A')
                    .replaceAll('{{ICP_SUMMARY}}', JSON.stringify(company.icp_data || {}))
                    .replaceAll('{{PROBLEMS_SUMMARY}}', JSON.stringify(company.icp_problems || {}))
                    .replaceAll('{{DURATION}}', duration);
                result = await generateCompletion("You are a Content Strategist.", prompt);
            }
        }

        res.json({ success: true, result });
    } catch (error) {
        console.error(`[AGENT-RUN] Fatal Error:`, error.message);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Persistence layer for agent results
 */
const saveResults = async (req, res) => {
    const { email, agent_id, data } = req.body;
    try {
        const { data: user, error: userErr } = await supabase
            .from('users')
            .select('id, active_company_id')
            .eq('email', email)
            .single();

        if (userErr || !user) throw new Error('User not found.');
        if (!user.active_company_id) throw new Error('No active company selected.');

        const aid = Number(agent_id);
        const updates = {};

        if (aid === 1) updates.icp_data = data;
        if (aid === 2) updates.icp_problems = data;

        // Save to companies table instead of users
        if (Object.keys(updates).length > 0) {
            await supabase
                .from('companies')
                .update(updates)
                .eq('id', user.active_company_id);
        }

        // Handle Company Calendars Table (company-scoped)
        if (aid === 3) {
            const { data: existing } = await supabase
                .from('company_calendars')
                .select('id')
                .eq('company_id', user.active_company_id)
                .maybeSingle();

            if (existing) {
                await supabase
                    .from('company_calendars')
                    .update({ calendar_data: data })
                    .eq('id', existing.id);
            } else {
                await supabase
                    .from('company_calendars')
                    .insert({ company_id: user.active_company_id, calendar_data: data });
            }
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const resetResults = async (req, res) => {
    const { email, agent_id } = req.body;
    try {
        const { data: user } = await supabase
            .from('users')
            .select('id, active_company_id')
            .eq('email', email)
            .single();

        if (!user?.active_company_id) throw new Error('No active company selected.');

        const aid = Number(agent_id);

        if (aid === 1) {
            await supabase
                .from('companies')
                .update({ icp_data: null })
                .eq('id', user.active_company_id);
        }

        if (aid === 3) {
            await supabase
                .from('company_calendars')
                .delete()
                .eq('company_id', user.active_company_id);
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ===========================================
// GET /api/user-overrides?email=... — Load persisted user overrides
// ===========================================
const getUserOverrides = async (req, res) => {
    try {
        const email = req.query.email;
        if (!email) return res.status(400).json({ error: 'Email required' });

        const { data: user } = await supabase.from('users').select('id').eq('email', email).single();
        if (!user) return res.status(404).json({ error: 'User not found' });

        const { data, error } = await supabase
            .from('user_agent_overrides')
            .select('agent_id, overrides')
            .eq('user_id', user.id);

        if (error) throw error;

        // Return as a map: { 1: {...}, 2: {...} }
        const overridesMap = {};
        (data || []).forEach(row => { overridesMap[row.agent_id] = row.overrides; });

        res.json({ success: true, overrides: overridesMap });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ===========================================
// PUT /api/user-overrides — Save/update user override for one agent
// ===========================================
const saveUserOverride = async (req, res) => {
    const { email, agent_id, overrides } = req.body;

    try {
        if (!email || !agent_id) return res.status(400).json({ error: 'Email and agent_id required' });

        const { data: user } = await supabase.from('users').select('id').eq('email', email).single();
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (!overrides || Object.keys(overrides).length === 0) {
            // No overrides — delete the row
            await supabase
                .from('user_agent_overrides')
                .delete()
                .eq('user_id', user.id)
                .eq('agent_id', Number(agent_id));
        } else {
            // Upsert the override
            const { error } = await supabase
                .from('user_agent_overrides')
                .upsert({
                    user_id: user.id,
                    agent_id: Number(agent_id),
                    overrides,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id,agent_id' });

            if (error) throw error;
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { runAgent, saveResults, resetResults, listAgents, getAgentConfig, getUserOverrides, saveUserOverride, invalidateConfigCache };
