// ===========================================
// Company Controller - Multi-Company Management
// ===========================================
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// GET /api/companies - List all companies for user
const getCompanies = async (req, res) => {
    const { email } = req.query;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        console.log(`[COMPANY-GET] Fetching companies for: ${email}`);

        // Get user
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (userError || !user) {
            throw new Error('User not found');
        }

        // Fetch all companies for this user with all data
        const { data: companies, error } = await supabase
            .from('companies')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Fetch calendar data for each company
        const companiesWithCalendar = await Promise.all(
            (companies || []).map(async (company) => {
                const { data: calendar } = await supabase
                    .from('company_calendars')
                    .select('calendar_data')
                    .eq('company_id', company.id)
                    .maybeSingle();

                return {
                    ...company,
                    content_calendar: calendar?.calendar_data || null
                };
            })
        );

        console.log(`[COMPANY-GET] Found ${companiesWithCalendar?.length || 0} companies`);

        res.json({ success: true, companies: companiesWithCalendar || [] });
    } catch (error) {
        console.error(`[COMPANY-GET] Error:`, error.message);
        res.status(500).json({ error: error.message });
    }
};

// POST /api/companies - Create new company
const createCompany = async (req, res) => {
    const { email, name, website_url, set_as_active = true } = req.body;

    if (!email || !name) {
        return res.status(400).json({ error: 'Email and company name are required' });
    }

    try {
        console.log(`[COMPANY-CREATE] Creating company "${name}" for: ${email}`);

        // Get user
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (userError || !user) {
            throw new Error('User not found');
        }

        // If setting as active, deactivate all other companies
        if (set_as_active) {
            const { error: deactivateError } = await supabase
                .from('companies')
                .update({ is_active: false })
                .eq('user_id', user.id);

            if (deactivateError) {
                console.error('[COMPANY-CREATE] Warning: Failed to deactivate other companies:', deactivateError.message);
            }
        }

        // Create new company
        const { data: company, error: insertError } = await supabase
            .from('companies')
            .insert({
                user_id: user.id,
                name,
                website_url: website_url || null,
                is_active: set_as_active
            })
            .select()
            .single();

        if (insertError) throw insertError;

        // Update user's active_company_id if this is the active company
        if (set_as_active) {
            const { error: updateUserError } = await supabase
                .from('users')
                .update({ active_company_id: company.id })
                .eq('id', user.id);

            if (updateUserError) {
                console.error('[COMPANY-CREATE] Warning: Failed to update user active_company_id:', updateUserError.message);
            }
        }

        console.log(`[COMPANY-CREATE] Success: Company ${company.id} created`);

        res.json({ success: true, company });
    } catch (error) {
        console.error(`[COMPANY-CREATE] Error:`, error.message);
        res.status(500).json({ error: error.message });
    }
};

// PUT /api/companies/:id - Update company
const updateCompany = async (req, res) => {
    const { id } = req.params;
    const { email, name, website_url } = req.body;

    if (!email || !name) {
        return res.status(400).json({ error: 'Email and company name are required' });
    }

    try {
        console.log(`[COMPANY-UPDATE] Updating company ${id}`);

        // Verify ownership
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (userError || !user) {
            throw new Error('User not found');
        }

        // Update company
        const { data: company, error: updateError } = await supabase
            .from('companies')
            .update({
                name,
                website_url: website_url || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .eq('user_id', user.id) // Ensure user owns this company
            .select()
            .single();

        if (updateError) throw updateError;

        if (!company) {
            throw new Error('Company not found or unauthorized');
        }

        console.log(`[COMPANY-UPDATE] Success: Company ${id} updated`);

        res.json({ success: true, company });
    } catch (error) {
        console.error(`[COMPANY-UPDATE] Error:`, error.message);
        res.status(500).json({ error: error.message });
    }
};

// POST /api/companies/:id/activate - Set as active company
const activateCompany = async (req, res) => {
    const { id } = req.params;
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        console.log(`[COMPANY-ACTIVATE] Activating company ${id} for: ${email}`);

        // Get user
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (userError || !user) {
            throw new Error('User not found');
        }

        // Verify ownership
        const { data: company, error: verifyError } = await supabase
            .from('companies')
            .select('id')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

        if (verifyError || !company) {
            throw new Error('Company not found or unauthorized');
        }

        // Deactivate all companies for this user
        const { error: deactivateError } = await supabase
            .from('companies')
            .update({ is_active: false })
            .eq('user_id', user.id);

        if (deactivateError) {
            throw new Error(`Failed to deactivate companies: ${deactivateError.message}`);
        }

        // Activate selected company
        const { error: activateError } = await supabase
            .from('companies')
            .update({ is_active: true })
            .eq('id', id);

        if (activateError) {
            throw new Error(`Failed to activate company: ${activateError.message}`);
        }

        // Update user's active_company_id
        const { error: updateUserError } = await supabase
            .from('users')
            .update({ active_company_id: id })
            .eq('id', user.id);

        if (updateUserError) {
            console.error('[COMPANY-ACTIVATE] Warning: Failed to update user active_company_id:', updateUserError.message);
        }

        console.log(`[COMPANY-ACTIVATE] Success: Company ${id} is now active`);

        res.json({ success: true });
    } catch (error) {
        console.error(`[COMPANY-ACTIVATE] Error:`, error.message);
        res.status(500).json({ error: error.message });
    }
};

// DELETE /api/companies/:id - Delete company
const deleteCompany = async (req, res) => {
    const { id } = req.params;
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        console.log(`[COMPANY-DELETE] Deleting company ${id} for: ${email}`);

        // Get user
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, active_company_id')
            .eq('email', email)
            .single();

        if (userError || !user) {
            throw new Error('User not found');
        }

        // Verify ownership
        const { data: company, error: verifyError } = await supabase
            .from('companies')
            .select('id')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

        if (verifyError || !company) {
            throw new Error('Company not found or unauthorized');
        }

        // Get all files for this company
        const { data: files, error: filesError } = await supabase
            .from('company_files')
            .select('file_path')
            .eq('company_id', id);

        // Delete files from Supabase Storage
        if (files && files.length > 0) {
            console.log(`[COMPANY-DELETE] Deleting ${files.length} files from storage...`);
            const filePaths = files.map(f => f.file_path);

            const { error: storageError } = await supabase.storage
                .from('company-files')
                .remove(filePaths);

            if (storageError) {
                console.error('[COMPANY-DELETE] Warning: Failed to delete some files:', storageError.message);
            }
        }

        // Delete company (cascades to company_files and company_calendars)
        const { error: deleteError } = await supabase
            .from('companies')
            .delete()
            .eq('id', id);

        if (deleteError) throw deleteError;

        // If deleted company was active, activate another one
        if (user.active_company_id === id) {
            console.log(`[COMPANY-DELETE] Deleted active company, finding replacement...`);

            const { data: newActive, error: newActiveError } = await supabase
                .from('companies')
                .select('id')
                .eq('user_id', user.id)
                .limit(1)
                .maybeSingle();

            if (newActive) {
                await supabase
                    .from('companies')
                    .update({ is_active: true })
                    .eq('id', newActive.id);

                await supabase
                    .from('users')
                    .update({ active_company_id: newActive.id })
                    .eq('id', user.id);

                console.log(`[COMPANY-DELETE] Company ${newActive.id} is now active`);
            } else {
                await supabase
                    .from('users')
                    .update({ active_company_id: null })
                    .eq('id', user.id);

                console.log(`[COMPANY-DELETE] User has no remaining companies`);
            }
        }

        console.log(`[COMPANY-DELETE] Success: Company ${id} deleted`);

        res.json({ success: true });
    } catch (error) {
        console.error(`[COMPANY-DELETE] Error:`, error.message);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getCompanies,
    createCompany,
    updateCompany,
    activateCompany,
    deleteCompany
};
