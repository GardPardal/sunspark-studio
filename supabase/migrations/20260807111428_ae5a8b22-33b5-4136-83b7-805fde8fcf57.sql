-- =========================================================
-- 1) ORGANIZAÇÕES
-- =========================================================
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  retention_media_days integer NOT NULL DEFAULT 180,
  retention_message_months integer NOT NULL DEFAULT 24,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);
GRANT SELECT ON public.org_members TO authenticated;
GRANT ALL ON public.org_members TO service_role;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_org_member(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members m
    WHERE m.org_id = _org_id AND m.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.default_org_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.organizations WHERE slug = 'lz7' LIMIT 1;
$$;

CREATE POLICY "org members read own org"
  ON public.organizations FOR SELECT TO authenticated
  USING (public.is_org_member(id));
CREATE POLICY "admins manage orgs"
  ON public.organizations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "members read own membership rows"
  ON public.org_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_org_member(org_id));
CREATE POLICY "admins manage memberships"
  ON public.org_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Semente: LZ7 + todos os usuários existentes como membros
INSERT INTO public.organizations (name, slug)
VALUES ('LZ7 Energia', 'lz7')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.org_members (org_id, user_id, role)
SELECT (SELECT id FROM public.organizations WHERE slug = 'lz7'), p.id, 'member'
FROM public.profiles p
ON CONFLICT (org_id, user_id) DO NOTHING;

-- Novos usuários entram automaticamente na org padrão
CREATE OR REPLACE FUNCTION public.handle_new_user_org_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_org uuid;
BEGIN
  SELECT id INTO v_org FROM public.organizations WHERE slug = 'lz7' LIMIT 1;
  IF v_org IS NOT NULL THEN
    INSERT INTO public.org_members (org_id, user_id, role)
    VALUES (v_org, NEW.id, 'member')
    ON CONFLICT (org_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user_org_member falhou para %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_org_member
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_org_member();

-- =========================================================
-- 2) CANAIS WHATSAPP
-- =========================================================
CREATE TABLE public.wa_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  label text NOT NULL,
  phone_number_id text NOT NULL UNIQUE,
  display_phone text,
  business_account_id text,
  persona text,
  bot_enabled boolean NOT NULL DEFAULT false,
  shadow_mode boolean NOT NULL DEFAULT true,
  test_allowlist text[] NOT NULL DEFAULT '{}'::text[],
  business_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_channels TO authenticated;
GRANT ALL ON public.wa_channels TO service_role;
ALTER TABLE public.wa_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read channels"
  ON public.wa_channels FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));
CREATE POLICY "coord manage channels"
  ON public.wa_channels FOR ALL TO authenticated
  USING (public.is_org_member(org_id) AND public.is_admin_or_coord())
  WITH CHECK (public.is_org_member(org_id) AND public.is_admin_or_coord());

-- =========================================================
-- 3) CONTATOS
-- =========================================================
CREATE TABLE public.wa_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  phone_e164 text NOT NULL,
  wa_id text,
  profile_name text,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  consent_status text NOT NULL DEFAULT 'unknown',
  opt_in_at timestamptz,
  opt_out_at timestamptz,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, phone_e164)
);
CREATE INDEX idx_wa_contacts_org_last ON public.wa_contacts (org_id, last_inbound_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_contacts TO authenticated;
GRANT ALL ON public.wa_contacts TO service_role;
ALTER TABLE public.wa_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read contacts"
  ON public.wa_contacts FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));
CREATE POLICY "org members write contacts"
  ON public.wa_contacts FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(org_id));
CREATE POLICY "org members update contacts"
  ON public.wa_contacts FOR UPDATE TO authenticated
  USING (public.is_org_member(org_id))
  WITH CHECK (public.is_org_member(org_id));

-- =========================================================
-- 4) CONVERSAS
-- =========================================================
CREATE TABLE public.wa_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel_id uuid REFERENCES public.wa_channels(id) ON DELETE SET NULL,
  contact_id uuid NOT NULL REFERENCES public.wa_contacts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'bot',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  handoff_reason text,
  handoff_at timestamptz,
  last_message_at timestamptz,
  unread_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wa_conversations_org_last ON public.wa_conversations (org_id, last_message_at DESC);
CREATE INDEX idx_wa_conversations_contact ON public.wa_conversations (contact_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_conversations TO authenticated;
GRANT ALL ON public.wa_conversations TO service_role;
ALTER TABLE public.wa_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read conversations"
  ON public.wa_conversations FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));
CREATE POLICY "org members insert conversations"
  ON public.wa_conversations FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(org_id));
CREATE POLICY "org members update conversations"
  ON public.wa_conversations FOR UPDATE TO authenticated
  USING (public.is_org_member(org_id))
  WITH CHECK (public.is_org_member(org_id));

-- =========================================================
-- 5) MÍDIA
-- =========================================================
CREATE TABLE public.wa_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider_media_id text,
  storage_path text,
  mime_type text,
  size_bytes bigint,
  sha256 text,
  transcript text,
  transcript_status text NOT NULL DEFAULT 'pending',
  download_status text NOT NULL DEFAULT 'pending',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wa_media_org ON public.wa_media (org_id, created_at DESC);
GRANT SELECT ON public.wa_media TO authenticated;
GRANT ALL ON public.wa_media TO service_role;
ALTER TABLE public.wa_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read media"
  ON public.wa_media FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));

-- =========================================================
-- 6) MENSAGENS
-- =========================================================
CREATE TABLE public.wa_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.wa_conversations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.wa_contacts(id) ON DELETE CASCADE,
  direction text NOT NULL,
  msg_type text NOT NULL DEFAULT 'text',
  body text,
  media_id uuid REFERENCES public.wa_media(id) ON DELETE SET NULL,
  provider_message_id text,
  reply_to text,
  status text NOT NULL DEFAULT 'received',
  error text,
  source text NOT NULL DEFAULT 'whatsapp',
  ai_meta jsonb,
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, provider_message_id)
);
CREATE INDEX idx_wa_messages_conv ON public.wa_messages (conversation_id, occurred_at DESC);
GRANT SELECT, INSERT ON public.wa_messages TO authenticated;
GRANT ALL ON public.wa_messages TO service_role;
ALTER TABLE public.wa_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read messages"
  ON public.wa_messages FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));
CREATE POLICY "org members insert messages"
  ON public.wa_messages FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(org_id));

-- =========================================================
-- 7) CONSENTIMENTO
-- =========================================================
CREATE TABLE public.wa_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.wa_contacts(id) ON DELETE CASCADE,
  action text NOT NULL,
  source text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wa_consents_contact ON public.wa_consents (contact_id, created_at DESC);
GRANT SELECT, INSERT ON public.wa_consents TO authenticated;
GRANT ALL ON public.wa_consents TO service_role;
ALTER TABLE public.wa_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read consents"
  ON public.wa_consents FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));
CREATE POLICY "org members insert consents"
  ON public.wa_consents FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(org_id));

-- =========================================================
-- 8) EVENTOS BRUTOS (idempotência) — sem acesso pelo app
-- =========================================================
CREATE TABLE public.wa_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  channel_id uuid REFERENCES public.wa_channels(id) ON DELETE SET NULL,
  provider_event_id text NOT NULL UNIQUE,
  event_kind text NOT NULL,
  payload jsonb NOT NULL,
  processed_at timestamptz,
  process_status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  error text,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wa_events_status ON public.wa_events (process_status, received_at);
GRANT ALL ON public.wa_events TO service_role;
ALTER TABLE public.wa_events ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 9) AUDITORIA — leitura só para admin/coord
-- =========================================================
CREATE TABLE public.wa_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wa_audit_org ON public.wa_audit_log (org_id, created_at DESC);
GRANT SELECT ON public.wa_audit_log TO authenticated;
GRANT ALL ON public.wa_audit_log TO service_role;
ALTER TABLE public.wa_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coord read audit"
  ON public.wa_audit_log FOR SELECT TO authenticated
  USING (public.is_org_member(org_id) AND public.is_admin_or_coord());

-- =========================================================
-- triggers updated_at
-- =========================================================
CREATE TRIGGER trg_organizations_uat BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER trg_wa_channels_uat BEFORE UPDATE ON public.wa_channels
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER trg_wa_contacts_uat BEFORE UPDATE ON public.wa_contacts
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER trg_wa_conversations_uat BEFORE UPDATE ON public.wa_conversations
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER trg_wa_media_uat BEFORE UPDATE ON public.wa_media
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();