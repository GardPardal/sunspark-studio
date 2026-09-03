-- Identidade real dos contatos e conteúdo de mídia nas mensagens
ALTER TABLE public.wa_contacts
  ADD COLUMN IF NOT EXISTS lid text,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS photo_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS phone_unknown boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS wa_contacts_org_lid_uidx
  ON public.wa_contacts (org_id, lid) WHERE lid IS NOT NULL;

ALTER TABLE public.wa_messages
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_mime text,
  ADD COLUMN IF NOT EXISTS media_filename text,
  ADD COLUMN IF NOT EXISTS raw_type text;

CREATE TABLE IF NOT EXISTS public.wa_directory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  lid text,
  phone_e164 text,
  name text,
  img_url text,
  img_updated_at timestamptz,
  source text NOT NULL DEFAULT 'zapi',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.wa_directory TO authenticated;
GRANT ALL ON public.wa_directory TO service_role;
ALTER TABLE public.wa_directory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wa_directory org read" ON public.wa_directory;
CREATE POLICY "wa_directory org read" ON public.wa_directory
  FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));

CREATE UNIQUE INDEX IF NOT EXISTS wa_directory_org_lid_uidx
  ON public.wa_directory (org_id, lid) WHERE lid IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS wa_directory_org_phone_uidx
  ON public.wa_directory (org_id, phone_e164) WHERE phone_e164 IS NOT NULL AND lid IS NULL;
CREATE INDEX IF NOT EXISTS wa_messages_conv_time_idx
  ON public.wa_messages (conversation_id, occurred_at DESC);