-- User-level agent overrides (custom prompts, model settings per user per agent)
CREATE TABLE IF NOT EXISTS user_agent_overrides (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_id INTEGER NOT NULL,
    overrides JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, agent_id)
);

-- Disable RLS (matching existing pattern)
ALTER TABLE user_agent_overrides DISABLE ROW LEVEL SECURITY;
