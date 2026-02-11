// ===========================================
// File Controller - Supabase Storage + Text Extraction
// ===========================================
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
            'image/png',
            'image/jpeg',
            'image/svg+xml',
            'image/webp'
        ];

        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`File type ${file.mimetype} not allowed`), false);
        }
    }
});

/**
 * Extract text content from document files (PDF, DOCX, TXT)
 * Returns null for image files (no text to extract)
 */
async function extractText(buffer, mimetype) {
    try {
        if (mimetype === 'application/pdf') {
            const pdf = new PDFParse({ data: new Uint8Array(buffer) });
            const result = await pdf.getText();
            return result.text?.trim() || null;
        }

        if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const result = await mammoth.extractRawText({ buffer });
            return result.value?.trim() || null;
        }

        if (mimetype === 'application/msword') {
            try {
                const result = await mammoth.extractRawText({ buffer });
                return result.value?.trim() || null;
            } catch {
                return null;
            }
        }

        if (mimetype === 'text/plain') {
            return buffer.toString('utf-8').trim();
        }

        // Images - no text extraction
        return null;
    } catch (err) {
        console.warn(`[TEXT-EXTRACT] Failed for ${mimetype}:`, err.message);
        return null;
    }
}

// POST /api/companies/:id/files - Upload file + extract text
const uploadFile = async (req, res) => {
    const { id: companyId } = req.params;
    const { email, file_type } = req.body;
    const file = req.file;

    if (!email || !file_type || !file) {
        return res.status(400).json({ error: 'Email, file_type, and file are required' });
    }

    try {
        console.log(`[FILE-UPLOAD] Uploading ${file_type} for company ${companyId}`);

        // Verify ownership
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (userError || !user) {
            throw new Error('User not found');
        }

        const { data: company, error: companyError } = await supabase
            .from('companies')
            .select('id')
            .eq('id', companyId)
            .eq('user_id', user.id)
            .single();

        if (companyError || !company) {
            throw new Error('Company not found or unauthorized');
        }

        // Extract text content from documents (PDF, DOCX, TXT)
        const textContent = await extractText(file.buffer, file.mimetype);
        if (textContent) {
            console.log(`[FILE-UPLOAD] Extracted ${textContent.length} chars of text`);
        }

        // Generate file path
        const timestamp = Date.now();
        const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `${companyId}/${file_type}_${timestamp}_${sanitizedFilename}`;

        // Upload to Supabase Storage (keep original for download/preview)
        const { error: uploadError } = await supabase.storage
            .from('company-files')
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                upsert: false
            });

        if (uploadError) {
            throw new Error(`Storage upload failed: ${uploadError.message}`);
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('company-files')
            .getPublicUrl(filePath);

        // Save metadata + extracted text to database
        const { data: fileRecord, error: dbError } = await supabase
            .from('company_files')
            .insert({
                company_id: companyId,
                file_type: file_type,
                file_name: file.originalname,
                file_path: filePath,
                file_url: publicUrl,
                mime_type: file.mimetype,
                file_size: file.size,
                text_content: textContent
            })
            .select()
            .single();

        if (dbError) {
            // Rollback: delete uploaded file if DB insert fails
            await supabase.storage
                .from('company-files')
                .remove([filePath]);
            throw new Error(`Database insert failed: ${dbError.message}`);
        }

        console.log(`[FILE-UPLOAD] Success: File ${fileRecord.id} created`);

        res.json({ success: true, file: fileRecord });
    } catch (error) {
        console.error(`[FILE-UPLOAD] Error:`, error.message);
        res.status(500).json({ error: error.message });
    }
};

// GET /api/companies/:id/files - List files for a company
const getFiles = async (req, res) => {
    const { id: companyId } = req.params;
    const { file_type } = req.query;

    try {
        let query = supabase
            .from('company_files')
            .select('id, company_id, file_type, file_name, file_path, file_url, mime_type, file_size, uploaded_at')
            .eq('company_id', companyId);

        if (file_type) {
            query = query.eq('file_type', file_type);
        }

        const { data: files, error } = await query.order('uploaded_at', { ascending: false });

        if (error) throw error;

        res.json({ success: true, files: files || [] });
    } catch (error) {
        console.error(`[FILE-GET] Error:`, error.message);
        res.status(500).json({ error: error.message });
    }
};

// DELETE /api/files/:id - Delete file
const deleteFile = async (req, res) => {
    const { id } = req.params;
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        const { data: file, error: fetchError } = await supabase
            .from('company_files')
            .select('*, companies!inner(user_id)')
            .eq('id', id)
            .single();

        if (fetchError || !file) {
            throw new Error('File not found');
        }

        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (userError || !user) {
            throw new Error('User not found');
        }

        if (file.companies.user_id !== user.id) {
            throw new Error('Unauthorized: You do not own this file');
        }

        // Delete from Supabase Storage
        const { error: storageError } = await supabase.storage
            .from('company-files')
            .remove([file.file_path]);

        if (storageError) {
            console.error('[FILE-DELETE] Warning: Failed to delete from storage:', storageError.message);
        }

        // Delete from database
        const { error: dbError } = await supabase
            .from('company_files')
            .delete()
            .eq('id', id);

        if (dbError) throw dbError;

        res.json({ success: true });
    } catch (error) {
        console.error(`[FILE-DELETE] Error:`, error.message);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    uploadFile: [upload.single('file'), uploadFile],
    getFiles,
    deleteFile
};
