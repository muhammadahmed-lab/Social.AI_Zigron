const { createClient } = require('@supabase/supabase-js');
const { generateGeminiImage } = require('../services/geminiService');
const axios = require('axios');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

/**
 * High-Production Image Generation
 * Primary: Google Gemini (Imagen)
 * Fallback: n8n Production Line
 */
const generateImage = async (req, res) => {
    const { email, prompt, aspect_ratio = "1:1", use_fallback = false, model = null } = req.body;

    try {
        console.log(`[CONTENT-GEN] Image requested by ${email}. Engine: ${use_fallback ? 'n8n' : 'Gemini'}. Model: ${model || 'default'}`);

        // 1. Fetch Active Company for Context Enrichment
        const { data: user } = await supabase
            .from('users')
            .select('id, active_company_id')
            .eq('email', email)
            .single();

        let company = null;
        if (user?.active_company_id) {
            const { data: fetchedCompany } = await supabase
                .from('companies')
                .select('name, icp_data')
                .eq('id', user.active_company_id)
                .single();

            company = fetchedCompany;
        }

        let imageUrl = null;

        if (!use_fallback) {
            // --- PRIMARY: GEMINI SDK (IMAGEN) ---
            try {
                imageUrl = await generateGeminiImage(prompt, aspect_ratio, model);
            } catch (geminiErr) {
                console.warn(`[CONTENT-GEN] Gemini failed, attempting n8n fallback...`);
                imageUrl = await runN8nFallback(email, prompt, company);
            }
        } else {
            // --- DIRECT FALLBACK ---
            imageUrl = await runN8nFallback(email, prompt, company);
        }

        if (!imageUrl) throw new Error("All image generation engines failed.");

        res.json({
            success: true,
            url: imageUrl,
            prompt: prompt,
            engine: use_fallback ? "n8n Production" : (model || "Gemini Imagen"),
            creditsUsed: 15
        });

    } catch (err) {
        console.error(`[CONTENT-GEN] Fatal Error:`, err.message);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Auxiliary n8n workflow for complex multi-step visual production
 */
async function runN8nFallback(email, prompt, company) {
    try {
        const n8nResponse = await axios.post(process.env.N8N_IMAGE_GEN_WEBHOOK, {
            email,
            prompt,
            company_name: company?.name || "Enterprise",
            icp_context: company?.icp_data
        }, { timeout: 120000, responseType: 'arraybuffer' });

        const contentType = (n8nResponse.headers['content-type'] || '').split(';')[0].trim();
        if (contentType.includes('image/')) {
            return `data:${contentType};base64,${Buffer.from(n8nResponse.data).toString('base64')}`;
        }
        return null;
    } catch (e) {
        return null;
    }
}

module.exports = { generateImage };
