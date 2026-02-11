const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

/**
 * Middleware: Require admin role
 * Reads email from req.body or req.query, checks role in DB.
 */
const requireAdmin = async (req, res, next) => {
    const email = req.body?.email || req.query?.email;
    if (!email) {
        return res.status(401).json({ error: 'Email required for authentication.' });
    }

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, role')
            .eq('email', email)
            .single();

        if (error || !user) {
            return res.status(401).json({ error: 'User not found.' });
        }

        if (user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required.' });
        }

        req.adminUser = user;
        next();
    } catch (err) {
        console.error('[ADMIN-AUTH] Error:', err.message);
        res.status(500).json({ error: 'Authentication failed.' });
    }
};

module.exports = { requireAdmin };
