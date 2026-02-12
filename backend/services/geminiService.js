const { GoogleGenAI } = require('@google/genai');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

// Official Unified Google Gen AI Client
const client = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

const log = (msg) => {
    console.log(`[${new Date().toISOString()}] [GEMINI-SDK] ${msg}`);
};

/**
 * Generates an image using the Official @google/genai SDK (Imagen 3).
 */
async function generateGeminiImage(prompt, aspectRatio = "1:1", model = null) {
    let modelId = model || process.env.GEMINI_IMAGE_MODEL || 'models/imagen-3.0-generate-001';

    // Ensure the models/ prefix is present for the Gemini API
    if (!modelId.includes('/') && !modelId.startsWith('models/')) {
        modelId = `models/${modelId}`;
    }

    log(`Generating Image via SDK Model: ${modelId}`);

    try {
        let imageUrl = null;

        // --- DUAL ENGINE DETECTION ---
        // Gemini models (multimodal) use generateContent
        // Dedicated Imagen models use generateImages
        if (modelId.includes('gemini')) {
            log("Using Multimodal Engine (generateContent)...");
            const response = await client.models.generateContent({
                model: modelId,
                contents: [{
                    role: 'user',
                    parts: [{ text: `Generate a professional, high-fidelity image in ${aspectRatio} aspect ratio. PROMPT: ${prompt}` }]
                }],
                generationConfig: {
                    // For multimodal models that support explicit ratio params
                    aspectRatio: aspectRatio
                }
            });

            // Handle Multimodal Image Response
            const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (!imagePart) {
                // Some models return a URI in the response
                const uriPart = response.candidates?.[0]?.content?.parts?.find(p => p.fileData);
                if (uriPart) {
                    imageUrl = uriPart.fileData.fileUri;
                } else {
                    // Try text response if it contains a URL (rare but possible in some preview versions)
                    const text = response.text;
                    if (text && text.includes('http')) {
                        imageUrl = text.match(/https?:\/\/[^\s]+/)?.[0];
                    }
                }
            } else {
                imageUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
            }
        } else {
            log("Using Dedicated Visual Engine (generateImages)...");
            const response = await client.models.generateImages({
                model: modelId,
                prompt: prompt,
                config: {
                    numberOfImages: 1,
                    aspectRatio: aspectRatio
                }
            });

            const generatedImage = response.generatedImages?.[0];
            if (!generatedImage) throw new Error("No image data returned from Gemini Visual SDK.");

            const imgBytes = generatedImage.image?.imageBytes;
            imageUrl = imgBytes
                ? `data:image/png;base64,${imgBytes}`
                : generatedImage.image?.uri;
        }

        if (!imageUrl) throw new Error(`Could not extract image from ${modelId} response.`);

        log("Image successfully synthesized via GenAI SDK.");
        return imageUrl;
    } catch (error) {
        log(`[SDK ERROR] ${modelId} failed: ${error.message}`);
        throw error;
    }
}

/**
 * Executes strategic text synthesis via Official GenAI SDK.
 */
async function generateGeminiText(systemPrompt, userPrompt) {
    const modelId = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    log(`Synthesizing text via SDK Model: ${modelId}...`);

    try {
        const response = await client.models.generateContent({
            model: modelId,
            contents: [{
                role: 'user',
                parts: [{ text: `${systemPrompt}\n\nUSER COMMAND: ${userPrompt}` }]
            }]
        });

        return response.text;
    } catch (error) {
        log(`[SDK TEXT ERROR] ${error.message}`);
        throw error;
    }
}

/**
 * Executes a structured completion via Gemini (JSON or text).
 * Drop-in replacement for OpenAI's generateCompletion used by agents.
 */
async function generateGeminiCompletion(systemPrompt, userPrompt, responseFormat = "json_object", modelOverride = null) {
    const modelId = modelOverride || process.env.GEMINI_MODEL || "gemini-2.0-flash";
    log(`Initiating Agent Synthesis via ${modelId} (Format: ${responseFormat})...`);

    const jsonInstruction = responseFormat === "json_object"
        ? "\n\nIMPORTANT: You MUST respond with valid JSON only. No markdown, no code fences, no explanation outside the JSON object."
        : "";

    const contents = [
        { role: 'user', parts: [{ text: `${systemPrompt}${jsonInstruction}\n\n${userPrompt}` }] }
    ];

    async function attemptCompletion(model) {
        try {
            const response = await client.models.generateContent({
                model: model,
                contents: contents,
                generationConfig: responseFormat === "json_object"
                    ? { responseMimeType: "application/json" }
                    : {}
            });

            const text = response.text;
            if (!text) throw new Error("Empty response from Gemini.");

            if (responseFormat === "json_object") {
                // Strip any accidental markdown fences
                const cleaned = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
                return JSON.parse(cleaned);
            }

            return text;
        } catch (error) {
            log(`[TRY FAIL] Model ${model} failed: ${error.message}`);
            throw error;
        }
    }

    try {
        return await attemptCompletion(modelId);
    } catch (primaryError) {
        if (modelId !== "gemini-2.0-flash") {
            log(`[FALLBACK] Primary model failed. Re-routing through gemini-2.0-flash...`);
            try {
                return await attemptCompletion("gemini-2.0-flash");
            } catch (fallbackError) {
                log(`[CRITICAL] All Gemini models failed: ${fallbackError.message}`);
                throw fallbackError;
            }
        }
        throw primaryError;
    }
}

module.exports = { generateGeminiImage, generateGeminiText, generateGeminiCompletion };
