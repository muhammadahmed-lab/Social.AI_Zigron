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

        // Guard: check if agent is disabled
        if (agentConfig?.is_active === false) {
            throw new Error(`Agent "${agentConfig.name}" is currently disabled by an administrator.`);
        }

        // --- Filesystem fallback definitions (used when DB config not found) ---
        const FILESYSTEM_CONFIGS = {
            1: { file: 'icp_analyst.md',      system: 'You are a StoryBrand Strategist.',         search: '{{COMPANY_NAME}} {{WEBSITE_URL}} target audience industry segments and positioning' },
            2: { file: 'icp_problem_id.md',   system: 'You are a Problem Identification Expert.', search: '{{INDUSTRY}} {{WEBSITE_URL}} customer pain points quora reddit frustrations' },
            3: { file: 'content_calendar.md', system: 'You are a Content Strategist.',            search: null },
        };

        // Resolve base config — DB first, filesystem fallback
        let baseDirective, baseSystemPrompt, baseSearchTemplate, baseResponseFormat, baseProvider, baseModel;
        if (agentConfig) {
            baseDirective       = agentConfig.directive_template;
            baseSystemPrompt    = agentConfig.system_prompt;
            baseSearchTemplate  = agentConfig.search_query_template;
            baseResponseFormat  = agentConfig.response_format || 'json_object';
            baseProvider        = agentConfig.ai_provider;
            baseModel           = agentConfig.ai_model;
            console.log(`[AGENT-RUN] Using DB config for agent ${aid}`);
        } else {
            const fc = FILESYSTEM_CONFIGS[aid];
            if (!fc) throw new Error(`No configuration found for agent ${aid}.`);
            baseDirective       = fs.readFileSync(path.join(__dirname, '../../directives', fc.file), 'utf-8');
            baseSystemPrompt    = fc.system;
            baseSearchTemplate  = fc.search;
            baseResponseFormat  = 'json_object';
            baseProvider        = undefined;
            baseModel           = undefined;
            console.log(`[AGENT-RUN] No DB config for agent ${aid}, using filesystem fallback`);
        }

        // --- Always fetch + apply user overrides (works for both DB and filesystem paths) ---
        const { data: savedOverride } = await supabase
            .from('user_agent_overrides')
            .select('overrides')
            .eq('user_id', user.id)
            .eq('agent_id', aid)
            .maybeSingle();

        const dbOverrides = savedOverride?.overrides || {};
        const merged = { ...dbOverrides, ...(user_overrides || {}) };

        const effectiveSystemPrompt = merged.system_prompt || baseSystemPrompt;

        // Smart directive building:
        // Plain-text custom instructions → prepend company context + append output schema from base directive
        let effectiveDirective;
        const userDirective = merged.directive_template;
        if (userDirective) {
            const hasOutputFormat = userDirective.includes('OUTPUT FORMAT') || userDirective.includes('REQUIRED JSON FORMAT') || userDirective.includes('JSON FORMAT') || userDirective.includes('"industry"') || userDirective.includes('"icp_');
            if (hasOutputFormat) {
                // Power user — they included a full schema, use as-is
                effectiveDirective = userDirective;
            } else {
                // Plain text — inject company context header + append output schema from base directive
                const companyContext = `COMPANY: {{COMPANY_NAME}}\nWEBSITE: {{WEBSITE_URL}}\nINDUSTRY: {{INDUSTRY}}\nBRAND CONTEXT: {{BRAND_CONTEXT}}\nRESEARCH DATA: {{RESEARCH_DATA}}`;
                const schemaMarkers = ['OUTPUT FORMAT', 'REQUIRED JSON FORMAT', 'JSON FORMAT', 'OUTPUT SCHEMA'];
                let schemaMarker = -1;
                for (const marker of schemaMarkers) {
                    const idx = baseDirective.indexOf(marker);
                    if (idx !== -1) { schemaMarker = idx; break; }
                }
                const outputSchema = schemaMarker !== -1 ? baseDirective.substring(schemaMarker) : '';
                effectiveDirective = outputSchema
                    ? `${companyContext}\n\n${userDirective}\n\n---\n\n${outputSchema}`
                    : `${companyContext}\n\n${userDirective}`;
                console.log(`[AGENT-RUN] Plain text prompt — injected company context + appended output schema`);
            }
        } else {
            effectiveDirective = baseDirective;
        }

        const effectiveProvider = (merged.ai_provider && merged.ai_provider !== 'auto')
            ? merged.ai_provider
            : (baseProvider && baseProvider !== 'auto' ? baseProvider : undefined);
        const effectiveModel = merged.ai_model || baseModel || undefined;

        console.log(`[AGENT-RUN] Executing agent ${aid}${Object.keys(merged).length ? ' + user overrides' : ''} for ${company.name}`);

        // Run web search
        let searchData = '';
        if (baseSearchTemplate) {
            let searchQuery = baseSearchTemplate;
            for (const [key, value] of Object.entries(variables)) {
                searchQuery = searchQuery.replaceAll(`{{${key}}}`, value);
            }
            searchData = await webSearch(searchQuery);
        }
        variables.RESEARCH_DATA = searchData || 'No search results available.';

        // Replace all {{VAR}} placeholders
        let prompt = effectiveDirective;
        for (const [key, value] of Object.entries(variables)) {
            prompt = prompt.replaceAll(`{{${key}}}`, value);
        }

        result = await generateCompletion(
            effectiveSystemPrompt,
            prompt,
            baseResponseFormat,
            { provider: effectiveProvider, model: effectiveModel }
        );

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

        if (aid === 2) {
            await supabase
                .from('companies')
                .update({ icp_problems: null })
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
