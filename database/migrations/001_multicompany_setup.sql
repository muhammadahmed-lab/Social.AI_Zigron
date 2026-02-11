-- ===========================================
-- Multi-Company Architecture Migration
-- ===========================================
-- This script transforms the application from single-company-per-user
-- to multi-company support with Supabase Storage integration.
--
-- IMPORTANT: Run this in Supabase SQL Editor
--
-- Prerequisites:
-- 1. Backup your database before running
-- 2. No active user sessions recommended
-- ===========================================

BEGIN;

-- ===========================================
-- STEP 1: CREATE NEW TABLES
-- ===========================================

-- Companies table - stores multiple companies per user
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    website_url TEXT,
    icp_data JSONB,
    icp_problems JSONB,
    messaging_strategy JSONB,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns if they don't exist (for re-running script on existing table)
DO $$
BEGIN
    -- Add is_active column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='companies' AND column_name='is_active') THEN
        ALTER TABLE companies ADD COLUMN is_active BOOLEAN DEFAULT false;
    END IF;

    -- Add name column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='companies' AND column_name='name') THEN
        ALTER TABLE companies ADD COLUMN name TEXT NOT NULL DEFAULT 'My Company';
    END IF;

    -- Add website_url column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='companies' AND column_name='website_url') THEN
        ALTER TABLE companies ADD COLUMN website_url TEXT;
    END IF;

    -- Add icp_data column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='companies' AND column_name='icp_data') THEN
        ALTER TABLE companies ADD COLUMN icp_data JSONB;
    END IF;

    -- Add icp_problems column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='companies' AND column_name='icp_problems') THEN
        ALTER TABLE companies ADD COLUMN icp_problems JSONB;
    END IF;

    -- Add messaging_strategy column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='companies' AND column_name='messaging_strategy') THEN
        ALTER TABLE companies ADD COLUMN messaging_strategy JSONB;
    END IF;

    -- Add created_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='companies' AND column_name='created_at') THEN
        ALTER TABLE companies ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;

    -- Add updated_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='companies' AND column_name='updated_at') THEN
        ALTER TABLE companies ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_companies_user_id ON companies(user_id);
CREATE INDEX IF NOT EXISTS idx_companies_user_active ON companies(user_id, is_active) WHERE is_active = true;

-- Enforce only one active company per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_one_active_per_user
ON companies(user_id) WHERE is_active = true;

-- Company files table - stores file metadata (actual files in Supabase Storage)
CREATE TABLE IF NOT EXISTS company_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    file_type TEXT NOT NULL CHECK (file_type IN ('brand_guidelines', 'logo', 'other')),
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL, -- Path in Supabase Storage
    file_url TEXT NOT NULL,  -- Public URL from Supabase Storage
    mime_type TEXT,
    file_size INTEGER,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for file queries
CREATE INDEX IF NOT EXISTS idx_company_files_company_id ON company_files(company_id);
CREATE INDEX IF NOT EXISTS idx_company_files_type ON company_files(company_id, file_type);

-- Company calendars table - replaces content_calendars
CREATE TABLE IF NOT EXISTS company_calendars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    calendar_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_calendars_company_id ON company_calendars(company_id);

-- ===========================================
-- STEP 2: UPDATE USERS TABLE
-- ===========================================

-- Add active company tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- Make legacy company columns nullable (data now lives in companies table)
-- This allows new user registration without requiring company_name
ALTER TABLE users ALTER COLUMN company_name DROP NOT NULL;

-- ===========================================
-- STEP 3: MIGRATE EXISTING DATA
-- ===========================================

-- Migrate existing company data from users table to companies table
-- Note: Only migrating columns that exist in users table
INSERT INTO companies (user_id, name, website_url, icp_data, icp_problems, is_active, created_at)
SELECT
    id as user_id,
    COALESCE(company_name, 'My Company') as name,
    website_url,
    icp_data,
    icp_problems,
    true as is_active, -- Make it the active company
    COALESCE(created_at, NOW()) as created_at
FROM users
WHERE (company_name IS NOT NULL OR website_url IS NOT NULL OR icp_data IS NOT NULL)
AND id NOT IN (SELECT user_id FROM companies) -- Avoid duplicates if script is re-run
ON CONFLICT DO NOTHING;

-- Set active_company_id for users who got a company created
UPDATE users u
SET active_company_id = c.id
FROM companies c
WHERE c.user_id = u.id
AND c.is_active = true
AND u.active_company_id IS NULL;

-- Migrate existing content_calendars to company_calendars
INSERT INTO company_calendars (company_id, calendar_data, created_at)
SELECT
    c.id as company_id,
    cc.calendar_data,
    cc.created_at
FROM content_calendars cc
JOIN companies c ON c.user_id = cc.user_id
WHERE NOT EXISTS (
    SELECT 1 FROM company_calendars WHERE company_id = c.id
) -- Avoid duplicates
ON CONFLICT DO NOTHING;

-- ===========================================
-- STEP 4: CREATE SUPABASE STORAGE BUCKET
-- ===========================================

-- Insert bucket for company files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'company-files',
    'company-files',
    true,
    10485760, -- 10MB limit
    ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ===========================================
-- STEP 5: STORAGE POLICIES (RLS)
-- ===========================================

-- Drop existing policies if they exist (to allow re-running script)
DROP POLICY IF EXISTS "Users can upload files for their companies" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their company files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their company files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their company files" ON storage.objects;

-- Policy: Users can upload files for their own companies
CREATE POLICY "Users can upload files for their companies"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'company-files' AND
    (storage.foldername(name))[1] IN (
        SELECT id::text FROM companies WHERE user_id = auth.uid()
    )
);

-- Policy: Users can read files from their own companies
CREATE POLICY "Users can read their company files"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'company-files' AND
    (storage.foldername(name))[1] IN (
        SELECT id::text FROM companies WHERE user_id = auth.uid()
    )
);

-- Policy: Users can update files from their own companies
CREATE POLICY "Users can update their company files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'company-files' AND
    (storage.foldername(name))[1] IN (
        SELECT id::text FROM companies WHERE user_id = auth.uid()
    )
);

-- Policy: Users can delete files from their own companies
CREATE POLICY "Users can delete their company files"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'company-files' AND
    (storage.foldername(name))[1] IN (
        SELECT id::text FROM companies WHERE user_id = auth.uid()
    )
);

-- ===========================================
-- STEP 6: VERIFICATION QUERIES
-- ===========================================

-- Uncomment these to verify migration success:
-- SELECT COUNT(*) as total_companies FROM companies;
-- SELECT COUNT(*) as users_with_active_company FROM users WHERE active_company_id IS NOT NULL;
-- SELECT COUNT(*) as migrated_calendars FROM company_calendars;
-- SELECT * FROM storage.buckets WHERE id = 'company-files';

COMMIT;

-- ===========================================
-- ROLLBACK INSTRUCTIONS
-- ===========================================
-- If something goes wrong, run this to rollback:
--
-- BEGIN;
-- DROP TABLE IF EXISTS company_calendars CASCADE;
-- DROP TABLE IF EXISTS company_files CASCADE;
-- DROP TABLE IF EXISTS companies CASCADE;
-- ALTER TABLE users DROP COLUMN IF EXISTS active_company_id;
-- DELETE FROM storage.buckets WHERE id = 'company-files';
-- COMMIT;
-- ===========================================

-- Migration complete!
-- Next step: Run the file migration script (migrate_files_to_storage.js)
-- to move Base64 files from brand_assets to Supabase Storage.
