const { generateChatCompletion } = require('../services/unifiedAIService');
const { createClient } = require('@supabase/supabase-js');
const { webSearch, webImageSearch } = require('../services/researchService');
const { generateGeminiImage } = require('../services/geminiService');
const fs = require('fs');
const path = require('path');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const handleChat = async (req, res) => {
    const { email, message, history } = req.body;
    console.log(`[ORCHESTRATOR] Chat request from: ${email}`);

    try {
        // 1. Fetch User and Active Company
        let { data: user, error: userErr } = await supabase
            .from('users')
            .select('id, active_company_id')
            .eq('email', email)
            .single();

        if (userErr || !user) {
            console.warn(`[ORCHESTRATOR] Profile not found for ${email}. Checking Demo Mode...`);
            // Fallback for Demo Users
            if (email?.includes('demo') || !email) {
                // Demo mode - create mock company
                const demoCompany = {
                    name: "Demo Enterprise",
                    website_url: "demo.example.com",
                    icp_data: { segments: ["Technology Professionals", "Innovation Leaders"] },
                    icp_problems: [{ problem: "Inefficient workflows" }, { problem: "Lacking AI integration" }],
                    messaging_strategy: { core_message: "Empowering innovation through AI." }
                };

                user = { id: 'demo-user-id', active_company_id: 'demo-company-id' };
                var company = demoCompany; // eslint-disable-line no-var
                var brand_guidelines_content = null; // eslint-disable-line no-var
            } else {
                throw new Error(`Profile '${email}' not found. Please verify your registration.`);
            }
        }

        // 2. Fetch Active Company (skip if demo mode)
        if (!company && user.active_company_id) {
            const { data: fetchedCompany, error: companyErr } = await supabase
                .from('companies')
                .select('*')
                .eq('id', user.active_company_id)
                .single();

            if (companyErr || !fetchedCompany) {
                throw new Error('Active company not found. Please select a company in Company Profile.');
            }

            var company = fetchedCompany; // eslint-disable-line no-var

            // 3. Fetch Brand Guidelines text from DB
            const { data: files } = await supabase
                .from('company_files')
                .select('text_content')
                .eq('company_id', company.id)
                .eq('file_type', 'brand_guidelines');

            var brand_guidelines_content = null; // eslint-disable-line no-var
            if (files && files.length > 0) {
                const texts = files.map(f => f.text_content).filter(Boolean);
                brand_guidelines_content = texts.join('\n\n---\n\n') || null;
            }
        } else if (!company) {
            throw new Error('Please create and activate a company before using the chat.');
        }

        // 4. Multimedia Research System
        let searchContext = "No real-time search performed.";
        let foundImages = [];
        const needsSearch = /latest|trend|news|current|now|today|update|happened|competitor|research|market|price|stock|show|image|photo|look like|who is|what is|find|search|browse|check/i.test(message);

        if (needsSearch) {
            console.log(`[ORCHESTRATOR] Multimedia Search Triggered: "${message}"`);
            // Clean the query: remove common filler words
            const cleanQuery = message.replace(/show me|find|search for|hey|please|can you/gi, '').trim();
            const query = `${company.name || ''} ${cleanQuery}`.trim();

            [searchContext, foundImages] = await Promise.all([
                webSearch(query),
                webImageSearch(query)
            ]);
        }

        // 5. Fetch Company Content Calendar Context
        const { data: calData } = await supabase
            .from('company_calendars')
            .select('calendar_data')
            .eq('company_id', company.id)
            .maybeSingle();

        // 6. Synthesize Prompt with Company Data
        const directivePath = path.join(__dirname, '../../directives/ai_orchestrator.md');
        let systemPrompt = fs.readFileSync(directivePath, 'utf-8');

        systemPrompt = systemPrompt
            .replaceAll('{{COMPANY_NAME}}', company.name || 'Your Company')
            .replaceAll('{{WEBSITE_URL}}', company.website_url || 'Not provided')
            .replaceAll('{{BRAND_CONTEXT}}', brand_guidelines_content || 'Not provided')
            .replaceAll('{{ICP_DATA}}', JSON.stringify(company.icp_data || 'No ICP data yet.'))
            .replaceAll('{{ICP_PROBLEMS}}', JSON.stringify(company.icp_problems || 'No problems identified yet.'))
            .replaceAll('{{MESSAGING_STRATEGY}}', JSON.stringify(company.messaging_strategy || 'No master strategy generated yet.'))
            .replaceAll('{{CONTENT_CALENDAR}}', JSON.stringify(calData?.calendar_data || 'No calendar generated yet.'))
            .replaceAll('{{WEB_RESEARCH}}', searchContext || 'No data.')
            .replaceAll('{{FOUND_IMAGES}}', JSON.stringify(foundImages || []));

        // --- DEFINE TOOLS ---
        const tools = [
            {
                type: "function",
                function: {
                    name: "update_single_post",
                    description: "PREFERRED: Use this to modify a SINGLE post in the calendar by its day_number. Only provide the fields you want to change. The system will merge your changes into the existing post.",
                    parameters: {
                        type: "object",
                        properties: {
                            day_number: { type: "integer", description: "The day number to update (e.g., 1 for Day 1)" },
                            updates: {
                                type: "object",
                                description: "Only include fields you want to change",
                                properties: {
                                    channel: { type: "string", enum: ["LinkedIn", "Instagram", "X (Twitter)", "Facebook"] },
                                    post_type: { type: "string", enum: ["Image", "Video", "Carousel"] },
                                    current_theme: { type: "string" },
                                    current_problem: { type: "string" },
                                    overlay_text: { type: "string", description: "The hook/headline" },
                                    description: { type: "string", description: "The post copy" },
                                    caption: { type: "string" },
                                    detailed_prompt: { type: "string", description: "Visual AI prompt" },
                                    model: { type: "string", enum: ["Nanobanana", "Veo", "HeyGen"] }
                                }
                            },
                            change_summary: { type: "string", description: "Brief description of what you changed." }
                        },
                        required: ["day_number", "updates", "change_summary"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "update_calendar",
                    description: "Use ONLY for bulk operations like removing multiple posts or regenerating the entire calendar. You MUST include ALL posts in the calendar, not just the changed ones.",
                    parameters: {
                        type: "object",
                        properties: {
                            calendar_title: { type: "string" },
                            posts: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        day_number: { type: "integer" },
                                        date: { type: "string" },
                                        day_name: { type: "string" },
                                        channel: { type: "string", enum: ["LinkedIn", "Instagram", "X (Twitter)", "Facebook"] },
                                        post_type: { type: "string", enum: ["Image", "Video", "Carousel"] },
                                        current_theme: { type: "string" },
                                        current_problem: { type: "string" },
                                        overlay_text: { type: "string", description: "The hook/headline" },
                                        description: { type: "string", description: "The post copy" },
                                        caption: { type: "string" },
                                        detailed_prompt: { type: "string", description: "Visual AI prompt" },
                                        model: { type: "string", enum: ["Nanobanana", "Veo", "HeyGen"] }
                                    }
                                }
                            },
                            strategic_advice: { type: "string" },
                            change_summary: { type: "string", description: "Briefly explain what you changed." }
                        },
                        required: ["posts", "change_summary"]
                    }
                }
            }
        ];

        // 5. Generate Response via Optimized Service
        const formattedHistory = history.map(m => ({ role: m.role, content: m.content }));
        const aiMessage = await generateChatCompletion(systemPrompt, message, formattedHistory, tools);

        let finalResponse = aiMessage.content;

        // 6. Handle Tool Calls
        if (aiMessage.tool_calls) {
            for (const toolCall of aiMessage.tool_calls) {
                // --- SINGLE POST UPDATE (Preferred) ---
                if (toolCall.function.name === 'update_single_post') {
                    const args = JSON.parse(toolCall.function.arguments);
                    console.log(`[ORCHESTRATOR] SINGLE POST UPDATE Day ${args.day_number}: ${args.change_summary}`);

                    // Get existing calendar
                    let existingPosts = calData?.calendar_data?.posts ||
                        (Array.isArray(calData?.calendar_data) ? calData.calendar_data : []);

                    if (existingPosts.length === 0) {
                        finalResponse = `⚠️ **Update Failed**: No calendar exists yet. Please generate a calendar first using the Agents tab.`;
                    } else {
                        // Find the post to update
                        const postIndex = existingPosts.findIndex(p => p.day_number === args.day_number);

                        if (postIndex === -1) {
                            finalResponse = `⚠️ **Update Failed**: Day ${args.day_number} not found in calendar.`;
                        } else {
                            // Merge updates into existing post
                            existingPosts[postIndex] = { ...existingPosts[postIndex], ...args.updates };

                            const updatedCalendar = {
                                calendar_title: calData?.calendar_data?.calendar_title || "My Strategic Calendar",
                                posts: existingPosts,
                                strategic_advice: calData?.calendar_data?.strategic_advice || "Keep following the plan!"
                            };

                            // Persist to Company Calendars
                            const { data: existing } = await supabase
                                .from('company_calendars')
                                .select('id')
                                .eq('company_id', company.id)
                                .maybeSingle();

                            if (existing) {
                                await supabase
                                    .from('company_calendars')
                                    .update({ calendar_data: updatedCalendar })
                                    .eq('id', existing.id);
                            } else {
                                await supabase
                                    .from('company_calendars')
                                    .insert({ company_id: company.id, calendar_data: updatedCalendar });
                            }

                            finalResponse = `✅ **Day ${args.day_number} Updated**: ${args.change_summary}`;
                        }
                    }
                }

                // --- FULL CALENDAR UPDATE (Bulk operations only) ---
                if (toolCall.function.name === 'update_calendar') {
                    const args = JSON.parse(toolCall.function.arguments);
                    console.log(`[ORCHESTRATOR] CALENDAR UPDATE: ${args.change_summary}`);

                    // Safety Check: Prevent accidental wipe of calendar
                    // If we already have a calendar with many posts, don't save one with too few
                    const existingPostCount = calData?.calendar_data?.posts?.length ||
                        (Array.isArray(calData?.calendar_data) ? calData.calendar_data.length : 0);
                    const newPostCount = args.posts?.length || 0;

                    if (existingPostCount > 5 && newPostCount < existingPostCount * 0.5) {
                        console.warn(`[ORCHESTRATOR] SAFETY: Blocked update. Existing: ${existingPostCount} posts, New: ${newPostCount} posts.`);
                        finalResponse = `⚠️ **Update Blocked**: The AI tried to save only ${newPostCount} posts, but your calendar has ${existingPostCount}. This looks like an error. Please ask the AI to make a specific change to a single post instead of regenerating the full calendar.`;
                    } else if (newPostCount === 0) {
                        console.warn(`[ORCHESTRATOR] SAFETY: Blocked update. No posts in payload.`);
                        finalResponse = `⚠️ **Update Blocked**: The AI returned an empty calendar. No changes were made.`;
                    } else {
                        const newCalendarData = {
                            calendar_title: args.calendar_title || calData?.calendar_data?.calendar_title || "My Strategic Calendar",
                            posts: args.posts,
                            strategic_advice: args.strategic_advice || calData?.calendar_data?.strategic_advice || "Keep following the plan!"
                        };

                        // Persist to Company Calendars
                        const { data: existing } = await supabase
                            .from('company_calendars')
                            .select('id')
                            .eq('company_id', company.id)
                            .maybeSingle();

                        if (existing) {
                            await supabase
                                .from('company_calendars')
                                .update({ calendar_data: newCalendarData })
                                .eq('id', existing.id);
                        } else {
                            await supabase
                                .from('company_calendars')
                                .insert({ company_id: company.id, calendar_data: newCalendarData });
                        }

                        finalResponse = `✅ **System Update**: ${args.change_summary}`;
                    }
                }
            }
        }

        res.json({ response: finalResponse });
    } catch (err) {
        console.error(`[CHAT-CONTROLLER] Error:`, err.message);
        res.status(500).json({ error: err.message });
    }
};

module.exports = { handleChat };
