const { generateGeminiImage } = require('../services/geminiService');

// Fallback model when primary fails (must be a Gemini multimodal model)
const FALLBACK_IMAGE_MODEL = 'models/gemini-2.5-flash-image';

/**
 * Image Generation via Gemini SDK
 * Primary: User-selected model
 * Fallback: Gemini 2.5 Flash Image
 */
const generateImage = async (req, res) => {
    const { email, prompt, aspect_ratio = "1:1", model = null } = req.body;

    try {
        const primaryModel = model || process.env.GEMINI_IMAGE_MODEL || 'models/gemini-2.0-flash-preview-image-generation';
        console.log(`[CONTENT-GEN] Image requested by ${email}. Model: ${primaryModel}`);

        let imageUrl = null;
        let usedModel = primaryModel;

        // Try primary model
        try {
            imageUrl = await generateGeminiImage(prompt, aspect_ratio, primaryModel);
        } catch (primaryErr) {
            console.warn(`[CONTENT-GEN] Primary model failed: ${primaryErr.message}`);

            // Fallback to Gemini Flash if primary was different
            if (primaryModel !== FALLBACK_IMAGE_MODEL) {
                console.log(`[CONTENT-GEN] Retrying with fallback model: ${FALLBACK_IMAGE_MODEL}`);
                try {
                    imageUrl = await generateGeminiImage(prompt, aspect_ratio, FALLBACK_IMAGE_MODEL);
                    usedModel = FALLBACK_IMAGE_MODEL;
                } catch (fallbackErr) {
                    console.error(`[CONTENT-GEN] Fallback also failed: ${fallbackErr.message}`);
                    throw new Error(`Image generation failed. Primary: ${primaryErr.message} | Fallback: ${fallbackErr.message}`);
                }
            } else {
                throw primaryErr;
            }
        }

        if (!imageUrl) throw new Error("No image data returned from generation engine.");

        res.json({
            success: true,
            url: imageUrl,
            prompt: prompt,
            model_used: usedModel,
            engine: "Gemini",
            creditsUsed: 15
        });

    } catch (err) {
        console.error(`[CONTENT-GEN] Fatal Error:`, err.message);
        res.status(500).json({ error: err.message });
    }
};

module.exports = { generateImage };
