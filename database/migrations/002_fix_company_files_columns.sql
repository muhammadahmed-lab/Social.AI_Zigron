-- ===========================================
-- Fix company_files table - Add missing columns
-- ===========================================
-- Run this in Supabase SQL Editor if you get errors like:
-- "Could not find the 'file_path' column of 'company_files'"
-- "column company_files.file_path does not exist"
--
-- This happens when the table was created before the migration
-- script ran, so CREATE TABLE IF NOT EXISTS skipped it.
-- ===========================================

-- Add missing columns safely (won't error if they already exist)
DO $$
BEGIN
    -- file_path: Storage path in Supabase (e.g., "company-id/brand_guidelines_1234_file.pdf")
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='company_files' AND column_name='file_path') THEN
        ALTER TABLE company_files ADD COLUMN file_path TEXT NOT NULL DEFAULT '';
    END IF;

    -- file_url: Public URL from Supabase Storage
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='company_files' AND column_name='file_url') THEN
        ALTER TABLE company_files ADD COLUMN file_url TEXT NOT NULL DEFAULT '';
    END IF;

    -- mime_type: MIME type of the uploaded file
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='company_files' AND column_name='mime_type') THEN
        ALTER TABLE company_files ADD COLUMN mime_type TEXT;
    END IF;

    -- file_size: File size in bytes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='company_files' AND column_name='file_size') THEN
        ALTER TABLE company_files ADD COLUMN file_size INTEGER;
    END IF;

    -- text_content: Extracted text from PDF/DOCX/TXT files (null for images)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='company_files' AND column_name='text_content') THEN
        ALTER TABLE company_files ADD COLUMN text_content TEXT;
    END IF;

    -- file_name: Original filename
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='company_files' AND column_name='file_name') THEN
        ALTER TABLE company_files ADD COLUMN file_name TEXT NOT NULL DEFAULT 'unknown';
    END IF;

    -- file_type: Type category (brand_guidelines, logo, other)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='company_files' AND column_name='file_type') THEN
        ALTER TABLE company_files ADD COLUMN file_type TEXT NOT NULL DEFAULT 'other';
    END IF;

    -- uploaded_at: Timestamp
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='company_files' AND column_name='uploaded_at') THEN
        ALTER TABLE company_files ADD COLUMN uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Verify the table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'company_files'
ORDER BY ordinal_position;
