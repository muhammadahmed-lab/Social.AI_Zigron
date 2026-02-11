const { createClient } = require('@supabase/supabase-js');
const { generateCompletion } = require('../services/unifiedAIService');
const { invalidateConfigCache } = require('./agentController');
const fs = require('fs');
const path = require('path');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ===========================================
// GET /api/admin/agents — List all agent configs
// ===========================================
const getAgentConfigs = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('agent_configs')
            .select('*')
            .order('agent_id');

        if (error) throw error;
        res.json({ success: true, agents: data });
    } catch (err) {
        console.error('[ADMIN] getAgentConfigs error:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ===========================================
// PUT /api/admin/agents/:agentId — Update agent config
// ===========================================
const updateAgentConfig = async (req, res) => {
    const { agentId } = req.params;
    const {
        name, description, system_prompt, directive_template,
        ai_provider, ai_model, temperature, max_tokens,
        response_format, is_active, search_query_template
    } = req.body;

    try {
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (description !== undefined) updates.description = description;
        if (system_prompt !== undefined) updates.system_prompt = system_prompt;
        if (directive_template !== undefined) updates.directive_template = directive_template;
        if (ai_provider !== undefined) updates.ai_provider = ai_provider;
        if (ai_model !== undefined) updates.ai_model = ai_model;
        if (temperature !== undefined) updates.temperature = temperature;
        if (max_tokens !== undefined) updates.max_tokens = max_tokens;
        if (response_format !== undefined) updates.response_format = response_format;
        if (is_active !== undefined) updates.is_active = is_active;
        if (search_query_template !== undefined) updates.search_query_template = search_query_template;
        updates.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('agent_configs')
            .update(updates)
            .eq('agent_id', Number(agentId))
            .select()
            .single();

        if (error) throw error;

        // Bust the agent config cache so user-facing runs pick up changes immediately
        invalidateConfigCache();

        res.json({ success: true, agent: data });
    } catch (err) {
        console.error('[ADMIN] updateAgentConfig error:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ===========================================
// POST /api/admin/agents/test — Playground test
// ===========================================
const testAgent = async (req, res) => {
    const { system_prompt, directive_template, test_variables, ai_provider, ai_model } = req.body;

    try {
        // Replace {{VAR}} placeholders with test values
        let prompt = directive_template || '';
        if (test_variables && typeof test_variables === 'object') {
            for (const [key, value] of Object.entries(test_variables)) {
                prompt = prompt.replaceAll(`{{${key}}}`, value || '');
            }
        }

        const startTime = Date.now();
        const result = await generateCompletion(
            system_prompt || 'You are a helpful assistant.',
            prompt,
            'json_object',
            { provider: ai_provider, model: ai_model }
        );
        const executionTime = Date.now() - startTime;

        res.json({ success: true, result, execution_time_ms: executionTime });
    } catch (err) {
        console.error('[ADMIN] testAgent error:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ===========================================
// GET /api/admin/api-keys — Return masked API keys
// ===========================================
const getApiKeyStatus = async (req, res) => {
    try {
        const keys = [
            { name: 'OPENAI_API_KEY', label: 'OpenAI API Key' },
            { name: 'GEMINI_API_KEY', label: 'Gemini API Key' },
            { name: 'SERPER_API_KEY', label: 'Serper API Key' },
        ];

        const status = keys.map(k => {
            const val = process.env[k.name] || '';
            const masked = val.length > 8
                ? val.substring(0, 4) + '...' + val.substring(val.length - 4)
                : val ? '****' : 'Not set';
            return { name: k.name, label: k.label, masked, is_set: !!val };
        });

        const globalSettings = {
            ai_provider: process.env.AI_PROVIDER || 'openai',
            openai_model: process.env.OPENAI_MODEL || 'gpt-4o',
            gemini_model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
        };

        res.json({ success: true, keys: status, globalSettings });
    } catch (err) {
        console.error('[ADMIN] getApiKeyStatus error:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ===========================================
// PUT /api/admin/api-keys — Update an API key
// ===========================================
const updateApiKey = async (req, res) => {
    const { key_name, key_value } = req.body;

    const allowedKeys = ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'SERPER_API_KEY', 'AI_PROVIDER', 'OPENAI_MODEL', 'GEMINI_MODEL'];
    if (!allowedKeys.includes(key_name)) {
        return res.status(400).json({ error: `Invalid key name: ${key_name}` });
    }

    try {
        // Update in-memory (works on all platforms including Render)
        process.env[key_name] = key_value;

        // Best-effort .env file write (local dev only — silently skipped on read-only production filesystems)
        try {
            const envPath = path.join(__dirname, '../../.env');
            let envContent = '';
            try {
                envContent = fs.readFileSync(envPath, 'utf-8');
            } catch {
                envContent = '';
            }

            const regex = new RegExp(`^${key_name}=.*$`, 'm');
            if (regex.test(envContent)) {
                envContent = envContent.replace(regex, `${key_name}=${key_value}`);
            } else {
                envContent += `\n${key_name}=${key_value}`;
            }

            fs.writeFileSync(envPath, envContent, 'utf-8');
        } catch {
            console.log(`[ADMIN] .env file write skipped (read-only filesystem). In-memory update applied.`);
        }

        res.json({ success: true, message: `${key_name} updated successfully.` });
    } catch (err) {
        console.error('[ADMIN] updateApiKey error:', err.message);
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getAgentConfigs,
    updateAgentConfig,
    testAgent,
    getApiKeyStatus,
    updateApiKey,
};
