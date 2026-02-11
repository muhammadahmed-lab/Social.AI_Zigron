-- ================================================
-- Migration 003: Admin Panel Setup
-- Adds role column to users and agent_configs table
-- ================================================

-- 1. Add role column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

-- 2. Agent configurations table
CREATE TABLE IF NOT EXISTS agent_configs (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    system_prompt TEXT NOT NULL,
    directive_template TEXT NOT NULL,
    ai_provider TEXT DEFAULT 'auto',
    ai_model TEXT,
    temperature NUMERIC(3,2) DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 4096,
    response_format TEXT DEFAULT 'json_object',
    is_active BOOLEAN DEFAULT true,
    search_query_template TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Disable RLS on agent_configs (accessed only via backend service key)
ALTER TABLE agent_configs DISABLE ROW LEVEL SECURITY;

-- 4. To set a user as admin, run:
-- UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
