
CREATE TABLE IF NOT EXISTS public.liz_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL UNIQUE,
  user_id uuid,
  user_email text,
  user_name text,
  mode text NOT NULL,
  is_admin_or_dev boolean NOT NULL DEFAULT false,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  message_count integer NOT NULL DEFAULT 0,
  first_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_emailed_at timestamptz,
  page_url text,
  user_agent text
);
CREATE INDEX IF NOT EXISTS idx_liz_conversations_updated ON public.liz_conversations (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_liz_conversations_admin ON public.liz_conversations (is_admin_or_dev);
GRANT ALL ON public.liz_conversations TO service_role;
ALTER TABLE public.liz_conversations ENABLE ROW LEVEL SECURITY;
