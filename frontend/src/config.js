// ===========================================
// Configuration - reads from .env file
// ===========================================

const config = {
    // API & Backend
    backendUrl: import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000',

    // Webhook URLs
    webhooks: {
        login: import.meta.env.VITE_WEBHOOK_LOGIN || '',
        chat: import.meta.env.VITE_WEBHOOK_CHAT || '',
        icpAnalyst: import.meta.env.VITE_WEBHOOK_ICP_ANALYST || '',
        icpProblem: import.meta.env.VITE_WEBHOOK_ICP_PROBLEM || '',
    },

    // Auth Configuration
    auth: {
        googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
    },

    // Timeout Configuration
    timeout: {
        chat: parseInt(import.meta.env.VITE_TIMEOUT_CHAT) || 60000,
        webhook: parseInt(import.meta.env.VITE_TIMEOUT_WEBHOOK) || 30000,
    },

    // App Configuration
    app: {
        name: import.meta.env.VITE_APP_NAME || 'Social Media AI Agent',
        demoMode: import.meta.env.VITE_DEMO_MODE === 'true',
    },

    // File Upload Constraints
    fileUpload: {
        brandGuidelines: {
            maxSize: 10 * 1024 * 1024, // 10MB
            acceptedTypes: ['.pdf', '.doc', '.docx', '.txt'],
            acceptedMimes: [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'text/plain',
            ],
        },
        logo: {
            maxSize: 5 * 1024 * 1024, // 5MB
            acceptedTypes: ['.png', '.jpg', '.jpeg', '.svg', '.webp'],
            acceptedMimes: ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'],
        },
    },

    // Storage Keys
    storage: {
        user: 'smm_ai_user',
        chatHistory: 'smm_ai_chat_history',
        onboardingComplete: 'smm_ai_onboarded',
    },
};

export default config;
