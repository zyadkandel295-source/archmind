-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLE: public.assistants
-- Purpose: Store user-created AI assistants
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.assistants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- User Association
  user_id UUID NOT NULL,
  
  -- Assistant Data
  name VARCHAR(255) NOT NULL,
  description TEXT,
  instructions TEXT NOT NULL,
  icon VARCHAR(10),
  color VARCHAR(50),
  status VARCHAR(20) DEFAULT 'idle', -- 'idle', 'active', 'thinking'
  
  -- Model Info
  model_name VARCHAR(100) DEFAULT 'Jellyfish',
  model_version VARCHAR(50) DEFAULT 'BIA 1',
  model_developer VARCHAR(100) DEFAULT 'Zyad Kandel',
  
  -- Configuration
  temperature NUMERIC(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 2000,
  system_prompt TEXT,
  
  -- Metadata
  is_public BOOLEAN DEFAULT FALSE,
  is_favorite BOOLEAN DEFAULT FALSE,
  tags TEXT[] DEFAULT ARRAY[]::text[],
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT fk_user_id FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT name_not_empty CHECK (name != '')
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_assistants_user_id ON public.assistants(user_id);
CREATE INDEX IF NOT EXISTS idx_assistants_created_at ON public.assistants(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assistants_deleted_at ON public.assistants(deleted_at);

-- ============================================================================
-- TABLE: public.chats
-- Purpose: Store conversations with assistants
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- User & Assistant Association
  user_id UUID NOT NULL,
  assistant_id UUID NOT NULL,
  
  -- Chat Data
  title VARCHAR(255),
  summary TEXT,
  
  -- Configuration
  model_name VARCHAR(100),
  model_version VARCHAR(50),
  
  -- Metadata
  message_count INTEGER DEFAULT 0,
  is_archived BOOLEAN DEFAULT FALSE,
  is_favorite BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  last_message_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT fk_user_id FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_assistant_id FOREIGN KEY (assistant_id) 
    REFERENCES public.assistants(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON public.chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_assistant_id ON public.chats(assistant_id);
CREATE INDEX IF NOT EXISTS idx_chats_created_at ON public.chats(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chats_deleted_at ON public.chats(deleted_at);

-- ============================================================================
-- TABLE: public.messages
-- Purpose: Store individual chat messages
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Chat Association
  chat_id UUID NOT NULL,
  user_id UUID NOT NULL,
  assistant_id UUID NOT NULL,
  
  -- Message Data
  role VARCHAR(20) NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,
  
  -- Metadata
  tokens_used INTEGER,
  response_time_ms INTEGER,
  model_used VARCHAR(100),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT fk_chat_id FOREIGN KEY (chat_id) 
    REFERENCES public.chats(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_id FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_assistant_id FOREIGN KEY (assistant_id) 
    REFERENCES public.assistants(id) ON DELETE CASCADE,
  CONSTRAINT role_check CHECK (role IN ('user', 'assistant'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON public.messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);

-- ============================================================================
-- TABLE: public.user_profiles
-- Purpose: Store additional user information
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Profile Data
  full_name VARCHAR(255),
  avatar_url TEXT,
  
  -- Preferences
  theme VARCHAR(50) DEFAULT 'dark',
  notifications_enabled BOOLEAN DEFAULT TRUE,
  
  -- Usage Stats
  total_assistants INTEGER DEFAULT 0,
  total_chats INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Enable data isolation per user
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.assistants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ASSISTANTS RLS Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own assistants" ON public.assistants;
CREATE POLICY "Users can view own assistants"
  ON public.assistants
  FOR SELECT
  USING (auth.uid() = user_id OR is_public = TRUE);

DROP POLICY IF EXISTS "Users can create own assistants" ON public.assistants;
CREATE POLICY "Users can create own assistants"
  ON public.assistants
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own assistants" ON public.assistants;
CREATE POLICY "Users can update own assistants"
  ON public.assistants
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own assistants" ON public.assistants;
CREATE POLICY "Users can delete own assistants"
  ON public.assistants
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- CHATS RLS Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own chats" ON public.chats;
CREATE POLICY "Users can view own chats"
  ON public.chats
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own chats" ON public.chats;
CREATE POLICY "Users can create own chats"
  ON public.chats
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own chats" ON public.chats;
CREATE POLICY "Users can update own chats"
  ON public.chats
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own chats" ON public.chats;
CREATE POLICY "Users can delete own chats"
  ON public.chats
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- MESSAGES RLS Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
CREATE POLICY "Users can view own messages"
  ON public.messages
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own messages" ON public.messages;
CREATE POLICY "Users can create own messages"
  ON public.messages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own messages" ON public.messages;
CREATE POLICY "Users can update own messages"
  ON public.messages
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own messages" ON public.messages;
CREATE POLICY "Users can delete own messages"
  ON public.messages
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- USER PROFILES RLS Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Users can view own profile"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- FUNCTIONS FOR AUTO-UPDATES
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_assistants_updated_at ON public.assistants;
CREATE TRIGGER update_assistants_updated_at
  BEFORE UPDATE ON public.assistants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_chats_updated_at ON public.chats;
CREATE TRIGGER update_chats_updated_at
  BEFORE UPDATE ON public.chats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_messages_updated_at ON public.messages;
CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
