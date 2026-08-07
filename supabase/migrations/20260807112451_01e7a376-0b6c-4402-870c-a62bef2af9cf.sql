ALTER TABLE public.wa_conversations
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS summary_updated_at timestamptz;

ALTER TABLE public.wa_messages
  ADD COLUMN IF NOT EXISTS imported boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_generated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS content_hash text;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS retention_days integer NOT NULL DEFAULT 365,
  ADD COLUMN IF NOT EXISTS opt_out_keywords text[] NOT NULL DEFAULT ARRAY['sair','parar','descadastrar','remover','stop'];

CREATE TABLE public.wa_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source text NOT NULL,
  declaration text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  total integer NOT NULL DEFAULT 0,
  imported_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.wa_imports TO authenticated;
GRANT ALL ON public.wa_imports TO service_role;
ALTER TABLE public.wa_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read imports" ON public.wa_imports
  FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "org members create imports" ON public.wa_imports
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(org_id));

CREATE TABLE public.wa_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel_id uuid REFERENCES public.wa_channels(id) ON DELETE SET NULL,
  name text NOT NULL,
  template_name text NOT NULL,
  language_code text NOT NULL DEFAULT 'pt_BR',
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'rascunho',
  dry_run_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_count integer NOT NULL DEFAULT 0,
  blocked_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.wa_campaigns TO authenticated;
GRANT ALL ON public.wa_campaigns TO service_role;
ALTER TABLE public.wa_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members manage campaigns" ON public.wa_campaigns
  FOR ALL TO authenticated
  USING (public.is_org_member(org_id))
  WITH CHECK (public.is_org_member(org_id));

CREATE TABLE public.wa_campaign_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.wa_campaigns(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.wa_contacts(id) ON DELETE CASCADE,
  eligible boolean NOT NULL DEFAULT true,
  blocked_reason text,
  status text NOT NULL DEFAULT 'pendente',
  provider_message_id text,
  error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, contact_id)
);
GRANT SELECT ON public.wa_campaign_targets TO authenticated;
GRANT ALL ON public.wa_campaign_targets TO service_role;
ALTER TABLE public.wa_campaign_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read campaign targets" ON public.wa_campaign_targets
  FOR SELECT TO authenticated USING (public.is_org_member(org_id));

CREATE TRIGGER trg_wa_imports_uat BEFORE UPDATE ON public.wa_imports
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER trg_wa_campaigns_uat BEFORE UPDATE ON public.wa_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();