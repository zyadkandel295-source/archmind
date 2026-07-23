-- Notion OAuth token columns (encrypted at rest)
ALTER TABLE users ADD COLUMN IF NOT EXISTS notion_access_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notion_workspace_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notion_workspace_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notion_workspace_icon TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notion_bot_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notion_connected_at TIMESTAMPTZ;

-- Activity audit log (no sensitive content)
CREATE TABLE IF NOT EXISTS notion_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation TEXT NOT NULL,
  resource_id TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notion_activity_user_id
  ON notion_activity_logs(user_id, created_at DESC);
