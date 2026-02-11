const { OpenAI } = require('openai');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const log = (msg) => {
    console.log(`[${new Date().toISOString()}] [AI-SERVICE] ${msg}`);
};

/**
 * Executes a strategic completion using OpenAI.
 * Centralized for easier maintenance of models, response formats, and error handling.
 */
async function generateCompletion(systemPrompt, userPrompt, responseFormat = "json_object", modelOverride = null) {
    const model = modelOverride || process.env.OPENAI_MODEL || "gpt-4o";
    log(`Initiating Agent Synthesis via ${model} (Format: ${responseFormat})...`);

    const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
    ];

    async function attemptCompletion(targetModel) {
        try {
            const params = {
                model: targetModel,
                messages: messages,
            };

            if (responseFormat === "json_object") {
                params.response_format = { type: "json_object" };
                // Ensure the prompt mentions JSON for OpenAI requirements
                if (!messages[0].content.toLowerCase().includes('json')) {
                    messages[0].content += " Respond strictly in JSON format.";
                }
            }

            const completion = await openai.chat.completions.create(params);
            const content = completion.choices[0].message.content;

            return responseFormat === "json_object" ? JSON.parse(content) : content;
        } catch (error) {
            log(`[TRY FAIL] Model ${targetModel} failed: ${error.message}`);
            throw error;
        }
    }

    try {
        return await attemptCompletion(model);
    } catch (primaryError) {
        if (model !== "gpt-4o") {
            log(`[FALLBACK] Primary model failed. Re-routing through GPT-4o...`);
            try {
                return await attemptCompletion("gpt-4o");
            } catch (fallbackError) {
                log(`[CRITICAL] All model uplinks failed: ${fallbackError.message}`);
                throw fallbackError;
            }
        }
        throw primaryError;
    }
}

/**
 * Wrapper for text-only specialized completions (e.g. for Simple Agents)
 */
async function generateText(systemPrompt, userPrompt, history = []) {
    const model = process.env.OPENAI_MODEL || "gpt-4o";
    log(`Generating Chat Response via ${model}...`);

    try {
        const messages = [
            { role: "system", content: systemPrompt },
            ...history,
            { role: "user", content: userPrompt }
        ];

        const completion = await openai.chat.completions.create({
            model: model,
            messages: messages
        });

        return completion.choices[0].message.content;
    } catch (error) {
        log(`[TEXT-GEN ERROR] ${error.message}`);
        throw error;
    }
}

/**
 * Enhanced Chat Completion with Tool Support
 */
async function generateChatCompletion(systemPrompt, userPrompt, history = [], tools = null) {
    const model = process.env.OPENAI_MODEL || "gpt-4o";
    log(`Generating Tool-Aware Chat Response via ${model}...`);

    try {
        const messages = [
            { role: "system", content: systemPrompt },
            ...history,
            { role: "user", content: userPrompt }
        ];

        const params = {
            model: model,
            messages: messages,
        };

        if (tools) {
            params.tools = tools;
            params.tool_choice = "auto";
        }

        const completion = await openai.chat.completions.create(params);
        return completion.choices[0].message;
    } catch (error) {
        log(`[CHAT-TOOL ERROR] ${error.message}`);
        throw error;
    }
}

module.exports = { generateCompletion, generateText, generateChatCompletion };
