CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_phone text NOT NULL UNIQUE,
  wa_name text,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  qualified boolean NOT NULL DEFAULT false,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.whatsapp_conversations TO service_role;

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_coord_read_whatsapp_conv"
ON public.whatsapp_conversations FOR SELECT
TO authenticated
USING (public.is_admin_or_coord());

CREATE INDEX IF NOT EXISTS idx_wa_conv_phone ON public.whatsapp_conversations(wa_phone);
CREATE INDEX IF NOT EXISTS idx_wa_conv_last ON public.whatsapp_conversations(last_message_at DESC);