// ===========================================
// API Service - handles all API & Supabase calls
// ===========================================
import config from '../config';
import { supabase } from './supabase';

/**
 * Convert file to base64 with metadata (used by Company Profile)
 */
export const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve({
                fileName: file.name,
                mimeType: file.type,
                size: file.size,
                extension: file.name.split('.').pop().toLowerCase(),
                data: base64,
            });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

/**
 * Register a new user (direct Supabase insert)
 */
export const registerUser = async (userData) => {
    try {
        const { data: existingEmail } = await supabase
            .from('users')
            .select('id')
            .eq('email', userData.email)
            .maybeSingle();
        if (existingEmail) throw new Error('An account with this email already exists.');

        const { data: existingUsername } = await supabase
            .from('users')
            .select('id')
            .eq('username', userData.username)
            .maybeSingle();
        if (existingUsername) throw new Error('This username is taken. Please choose another.');

        const { data, error } = await supabase
            .from('users')
            .insert({
                email: userData.email,
                username: userData.username,
                password: userData.password,
            })
            .select()
            .single();

        if (error) throw new Error(error.message);

        return {
            success: true,
            user: {
                id: data.id,
                email: data.email,
                username: data.username,
            }
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

/**
 * Login user (username-based authentication)
 * Fetches user data directly from Supabase for speed and reliability.
 */
export const loginUser = async (username, password) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .eq('password', password)
            .single();

        if (error || !data) {
            throw new Error('Invalid username or password');
        }

        // Map DB record back to CamelCase for the App State
        const user = {
            id: data.id,
            username: data.username,
            firstName: data.first_name,
            lastName: data.last_name,
            email: data.email,
            role: data.role || 'user',
            companyName: data.company_name,
            websiteUrl: data.website_url,
            brandGuidelinesContent: data.brand_guidelines_content,
            icpData: data.icp_data,
            icpProblems: data.icp_problems,
            messagingStrategy: data.messaging_strategy,
            active_company_id: data.active_company_id,
        };

        // Fetch calendar data
        const { data: calData } = await supabase
            .from('content_calendars')
            .select('calendar_data')
            .eq('user_id', data.id)
            .maybeSingle();

        user.content_calendar = calData?.calendar_data || null;

        return { success: true, user };
    } catch (error) {
        console.error('Login error:', error);

        // Demo mode fallback
        if (config.app.demoMode) {
            console.log('Demo mode: Simulating successful login');
            return {
                success: true,
                user: {
                    username: username,
                    email: 'demo@example.com',
                    firstName: 'Demo',
                    lastName: 'User',
                    companyName: 'Demo Company',
                },
            };
        }

        throw error;
    }
};

/**
 * Get Fresh User Profile
 */
export const getUserProfile = async (email) => {
    try {
        // 1. Fetch primary user data
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error) throw error;

        // 2. Fetch associated items (Content Calendar)
        const { data: calData } = await supabase
            .from('content_calendars')
            .select('calendar_data')
            .eq('user_id', data.id)
            .maybeSingle();

        return {
            success: true,
            user: {
                id: data.id,
                username: data.username,
                firstName: data.first_name,
                lastName: data.last_name,
                email: data.email,
                role: data.role || 'user',
                companyName: data.company_name,
                websiteUrl: data.website_url,
                brandGuidelinesContent: data.brand_guidelines_content,
                icpData: data.icp_data,
                icpProblems: data.icp_problems,
                messagingStrategy: data.messaging_strategy,
                content_calendar: calData?.calendar_data || null,
                active_company_id: data.active_company_id,
            }
        };
    } catch (error) {
        console.error('Fetch profile error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Send chat message
 */
export const sendChatMessage = async (message, context = {}, chatHistory = []) => {
    try {
        // Build the target URL - prioritize direct webhook if configured
        const targetUrl = config.webhooks.chat || `${config.backendUrl}/api/orchestrator-chat`;

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: context.email,
                message,
                history: chatHistory,
                // Add metadata to help n8n distinguish the action if nested
                action: 'chat',
                submitted_at: new Date().toISOString()
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Chat request failed: ${response.status}`);
        }

        const data = await response.json();
        return { success: true, response: data.response };
    } catch (error) {
        console.error('Orchestrator chat error:', error);

        if (config.app.demoMode) {
            return {
                success: true,
                response: getDemoResponse(message),
            };
        }
        throw error;
    }
};

/**
 * Update company profile (post-registration)
 */
export const updateCompanyProfile = async (userId, profileData, files = {}) => {
    try {
        const updates = {};
        if (profileData.companyName !== undefined) updates.company_name = profileData.companyName;
        if (profileData.websiteUrl !== undefined) updates.website_url = profileData.websiteUrl;

        if (Object.keys(updates).length > 0) {
            const { error } = await supabase
                .from('users')
                .update(updates)
                .eq('id', userId);
            if (error) throw error;
        }

        if (files.brandGuidelines) {
            const fileData = await fileToBase64(files.brandGuidelines);
            const { data: existing } = await supabase
                .from('brand_assets')
                .select('id')
                .eq('user_id', userId)
                .maybeSingle();

            if (existing) {
                await supabase.from('brand_assets')
                    .update({ brand_guidelines_content: fileData.data })
                    .eq('id', existing.id);
            } else {
                await supabase.from('brand_assets')
                    .insert({ user_id: userId, brand_guidelines_content: fileData.data });
            }
        }

        return { success: true };
    } catch (error) {
        console.error('Update company profile error:', error);
        return { success: false, error: error.message };
    }
};

// ===========================================
// Company Management API Functions
// ===========================================

/**
 * Get all companies for a user
 */
export const getCompanies = async (email) => {
    try {
        const response = await fetch(`${config.backendUrl}/api/companies?email=${encodeURIComponent(email)}`);
        if (!response.ok) throw new Error('Failed to fetch companies');
        return await response.json();
    } catch (error) {
        console.error('Get companies error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Create a new company
 */
export const createCompany = async (email, name, website_url = '', set_as_active = true) => {
    try {
        const response = await fetch(`${config.backendUrl}/api/companies`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, name, website_url, set_as_active }),
        });
        if (!response.ok) throw new Error('Failed to create company');
        return await response.json();
    } catch (error) {
        console.error('Create company error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Update company details
 */
export const updateCompany = async (companyId, email, name, website_url) => {
    try {
        const response = await fetch(`${config.backendUrl}/api/companies/${companyId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, name, website_url }),
        });
        if (!response.ok) throw new Error('Failed to update company');
        return await response.json();
    } catch (error) {
        console.error('Update company error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Activate a company (set as active)
 */
export const activateCompany = async (companyId, email) => {
    try {
        const response = await fetch(`${config.backendUrl}/api/companies/${companyId}/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });
        if (!response.ok) throw new Error('Failed to activate company');
        return await response.json();
    } catch (error) {
        console.error('Activate company error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Delete a company
 */
export const deleteCompany = async (companyId, email) => {
    try {
        const response = await fetch(`${config.backendUrl}/api/companies/${companyId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });
        if (!response.ok) throw new Error('Failed to delete company');
        return await response.json();
    } catch (error) {
        console.error('Delete company error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Upload file for a company
 */
export const uploadFile = async (companyId, email, file_type, file) => {
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('email', email);
        formData.append('file_type', file_type);

        const response = await fetch(`${config.backendUrl}/api/companies/${companyId}/files`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) throw new Error('Failed to upload file');
        return await response.json();
    } catch (error) {
        console.error('Upload file error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get files for a company
 */
export const getFiles = async (companyId, file_type = null) => {
    try {
        let url = `${config.backendUrl}/api/companies/${companyId}/files`;
        if (file_type) url += `?file_type=${encodeURIComponent(file_type)}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch files');
        return await response.json();
    } catch (error) {
        console.error('Get files error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Delete a file
 */
export const deleteFile = async (fileId, email) => {
    try {
        const response = await fetch(`${config.backendUrl}/api/files/${fileId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });
        if (!response.ok) throw new Error('Failed to delete file');
        return await response.json();
    } catch (error) {
        console.error('Delete file error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Demo response generator
 */
const getDemoResponse = (message) => {
    const responses = [
        "That's a great question! Based on your brand guidelines, I'd suggest focusing on authentic, value-driven content that resonates with your target audience.",
        "I've analyzed your request. Here's my recommendation: Create a content calendar that balances promotional content (20%), educational content (40%), and engaging content (40%).",
        "For your social media strategy, I recommend posting 3-5 times per week on Instagram, 1-2 times daily on Twitter/X, and 2-3 times per week on LinkedIn.",
        "Based on current trends, short-form video content is performing exceptionally well. Consider incorporating Reels and TikTok-style content into your strategy.",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
};
