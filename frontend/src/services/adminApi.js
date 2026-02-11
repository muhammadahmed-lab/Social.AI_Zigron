// ===========================================
// Admin API Service
// ===========================================
import config from '../config';

export const getAgentConfigs = async (email) => {
    try {
        const response = await fetch(
            `${config.backendUrl}/api/admin/agents?email=${encodeURIComponent(email)}`
        );
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to fetch agent configs');
        }
        return await response.json();
    } catch (error) {
        console.error('getAgentConfigs error:', error);
        return { success: false, error: error.message };
    }
};

export const updateAgentConfig = async (email, agentId, configData) => {
    try {
        const response = await fetch(
            `${config.backendUrl}/api/admin/agents/${agentId}`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, ...configData }),
            }
        );
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to update agent config');
        }
        return await response.json();
    } catch (error) {
        console.error('updateAgentConfig error:', error);
        return { success: false, error: error.message };
    }
};

export const testAgent = async (email, payload) => {
    try {
        const response = await fetch(
            `${config.backendUrl}/api/admin/agents/test`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, ...payload }),
            }
        );
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Test failed');
        }
        return await response.json();
    } catch (error) {
        console.error('testAgent error:', error);
        return { success: false, error: error.message };
    }
};

export const getApiKeyStatus = async (email) => {
    try {
        const response = await fetch(
            `${config.backendUrl}/api/admin/api-keys?email=${encodeURIComponent(email)}`
        );
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to fetch API keys');
        }
        return await response.json();
    } catch (error) {
        console.error('getApiKeyStatus error:', error);
        return { success: false, error: error.message };
    }
};

export const updateApiKey = async (email, keyName, keyValue) => {
    try {
        const response = await fetch(
            `${config.backendUrl}/api/admin/api-keys`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, key_name: keyName, key_value: keyValue }),
            }
        );
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to update API key');
        }
        return await response.json();
    } catch (error) {
        console.error('updateApiKey error:', error);
        return { success: false, error: error.message };
    }
};
