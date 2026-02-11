// ============================================================
// Unified AI Service — Dynamic Provider with Auto-Fallback
// ============================================================
// Reads AI_PROVIDER from .env ('openai' or 'gemini').
// Primary provider runs first; on failure, auto-falls back
// to the other provider. Change only .env to switch.
// ============================================================

const { generateCompletion: openaiCompletion, generateText: openaiText, generateChatCompletion: openaiChat } = require('./aiService');
const { generateGeminiCompletion: geminiCompletion, generateGeminiText: geminiText } = require('./geminiService');

const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase();

const log = (msg) => {
    console.log(`[${new Date().toISOString()}] [UNIFIED-AI] ${msg}`);
};

log(`Initialized — Primary Provider: ${provider.toUpperCase()}, Fallback: ${provider === 'openai' ? 'GEMINI' : 'OPENAI'}`);

// ---------------------------------------------------------
// generateCompletion — For Agents (JSON structured output)
// ---------------------------------------------------------
async function generateCompletion(systemPrompt, userPrompt, responseFormat = "json_object", options = {}) {
    // Allow per-call provider + model override (e.g. from admin panel config)
    const activeProvider = (options.provider || provider).toLowerCase();
    const modelOverride = options.model || null;

    const [primary, fallback] = activeProvider === 'openai'
        ? [openaiCompletion, geminiCompletion]
        : [geminiCompletion, openaiCompletion];

    const [primaryName, fallbackName] = activeProvider === 'openai'
        ? ['OpenAI', 'Gemini']
        : ['Gemini', 'OpenAI'];

    try {
        log(`[Completion] Attempting ${primaryName}${modelOverride ? ` (model: ${modelOverride})` : ''}...`);
        return await primary(systemPrompt, userPrompt, responseFormat, modelOverride);
    } catch (err) {
        log(`[Completion] ${primaryName} failed: ${err.message}. Falling back to ${fallbackName}...`);
        try {
            // Fallback uses default model (no override — different provider)
            return await fallback(systemPrompt, userPrompt, responseFormat, null);
        } catch (fallbackErr) {
            log(`[Completion] CRITICAL — Both providers failed. ${fallbackName}: ${fallbackErr.message}`);
            throw new Error(`All AI providers failed. ${primaryName}: ${err.message} | ${fallbackName}: ${fallbackErr.message}`);
        }
    }
}

// ---------------------------------------------------------
// generateText — For simple text generation
// ---------------------------------------------------------
async function generateText(systemPrompt, userPrompt, history = []) {
    const [primaryFn, fallbackFn] = provider === 'openai'
        ? [() => openaiText(systemPrompt, userPrompt, history), () => geminiText(systemPrompt, userPrompt)]
        : [() => geminiText(systemPrompt, userPrompt), () => openaiText(systemPrompt, userPrompt, history)];

    const [primaryName, fallbackName] = provider === 'openai'
        ? ['OpenAI', 'Gemini']
        : ['Gemini', 'OpenAI'];

    try {
        log(`[Text] Attempting ${primaryName}...`);
        return await primaryFn();
    } catch (err) {
        log(`[Text] ${primaryName} failed: ${err.message}. Falling back to ${fallbackName}...`);
        try {
            return await fallbackFn();
        } catch (fallbackErr) {
            log(`[Text] CRITICAL — Both providers failed. ${fallbackName}: ${fallbackErr.message}`);
            throw new Error(`All AI providers failed. ${primaryName}: ${err.message} | ${fallbackName}: ${fallbackErr.message}`);
        }
    }
}

// ---------------------------------------------------------
// generateChatCompletion — For Chat with Tool Calling
// ---------------------------------------------------------
// Note: OpenAI supports tool_calls natively. When Gemini is
// used (as primary or fallback), it returns text-only with
// { content, tool_calls: null }. Calendar tool updates only
// work with OpenAI — Gemini degrades gracefully to text chat.
// ---------------------------------------------------------
async function generateChatCompletion(systemPrompt, userPrompt, history = [], tools = null) {
    if (provider === 'openai') {
        // OpenAI primary → Gemini text fallback
        try {
            log('[Chat] Attempting OpenAI (with tools)...');
            return await openaiChat(systemPrompt, userPrompt, history, tools);
        } catch (err) {
            log(`[Chat] OpenAI failed: ${err.message}. Falling back to Gemini text...`);
            try {
                const text = await geminiText(systemPrompt, userPrompt);
                return { content: text, tool_calls: null };
            } catch (fallbackErr) {
                log(`[Chat] CRITICAL — Both providers failed. Gemini: ${fallbackErr.message}`);
                throw new Error(`All AI providers failed. OpenAI: ${err.message} | Gemini: ${fallbackErr.message}`);
            }
        }
    } else {
        // Gemini primary → OpenAI chat fallback
        try {
            log('[Chat] Attempting Gemini text...');
            const text = await geminiText(systemPrompt, userPrompt);
            return { content: text, tool_calls: null };
        } catch (err) {
            log(`[Chat] Gemini failed: ${err.message}. Falling back to OpenAI (with tools)...`);
            try {
                return await openaiChat(systemPrompt, userPrompt, history, tools);
            } catch (fallbackErr) {
                log(`[Chat] CRITICAL — Both providers failed. OpenAI: ${fallbackErr.message}`);
                throw new Error(`All AI providers failed. Gemini: ${err.message} | OpenAI: ${fallbackErr.message}`);
            }
        }
    }
}

module.exports = { generateCompletion, generateText, generateChatCompletion };
