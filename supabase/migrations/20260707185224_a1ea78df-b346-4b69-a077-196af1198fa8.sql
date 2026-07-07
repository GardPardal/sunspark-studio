
-- ============ META ADS: entidades e insights ============

-- Contas conectadas
CREATE TABLE IF NOT EXISTS public.meta_ad_accounts (
  id text PRIMARY KEY,              -- ex: act_123456789
  name text NOT NULL DEFAULT '',
  currency text,
  timezone text,
  status text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_ad_accounts TO authenticated;
GRANT ALL ON public.meta_ad_accounts TO service_role;
ALTER TABLE public.meta_ad_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gerenciam contas Meta" ON public.meta_ad_accounts
  FOR ALL TO authenticated USING (public.is_admin_or_coord()) WITH CHECK (public.is_admin_or_coord());

-- Campanhas
CREATE TABLE IF NOT EXISTS public.meta_campaigns (
  id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES public.meta_ad_accounts(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  objective text,
  status text,
  effective_status text,
  daily_budget numeric,
  lifetime_budget numeric,
  start_time timestamptz,
  stop_time timestamptz,
  buying_type text,
  raw jsonb,
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meta_campaigns_account ON public.meta_campaigns(account_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_campaigns TO authenticated;
GRANT ALL ON public.meta_campaigns TO service_role;
ALTER TABLE public.meta_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins veem campanhas Meta" ON public.meta_campaigns
  FOR ALL TO authenticated USING (public.is_admin_or_coord()) WITH CHECK (public.is_admin_or_coord());

-- Conjuntos de anúncios
CREATE TABLE IF NOT EXISTS public.meta_adsets (
  id text PRIMARY KEY,
  campaign_id text NOT NULL REFERENCES public.meta_campaigns(id) ON DELETE CASCADE,
  account_id text NOT NULL,
  name text NOT NULL DEFAULT '',
  status text,
  effective_status text,
  daily_budget numeric,
  lifetime_budget numeric,
  optimization_goal text,
  billing_event text,
  bid_strategy text,
  targeting jsonb,
  start_time timestamptz,
  end_time timestamptz,
  raw jsonb,
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meta_adsets_campaign ON public.meta_adsets(campaign_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_adsets TO authenticated;
GRANT ALL ON public.meta_adsets TO service_role;
ALTER TABLE public.meta_adsets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins veem conjuntos Meta" ON public.meta_adsets
  FOR ALL TO authenticated USING (public.is_admin_or_coord()) WITH CHECK (public.is_admin_or_coord());

-- Anúncios
CREATE TABLE IF NOT EXISTS public.meta_ads (
  id text PRIMARY KEY,
  adset_id text NOT NULL REFERENCES public.meta_adsets(id) ON DELETE CASCADE,
  campaign_id text NOT NULL,
  account_id text NOT NULL,
  name text NOT NULL DEFAULT '',
  status text,
  effective_status text,
  creative_id text,
  preview_url text,
  raw jsonb,
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meta_ads_adset ON public.meta_ads(adset_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_campaign ON public.meta_ads(campaign_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_ads TO authenticated;
GRANT ALL ON public.meta_ads TO service_role;
ALTER TABLE public.meta_ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins veem anuncios Meta" ON public.meta_ads
  FOR ALL TO authenticated USING (public.is_admin_or_coord()) WITH CHECK (public.is_admin_or_coord());

-- Criativos
CREATE TABLE IF NOT EXISTS public.meta_creatives (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  name text,
  title text,
  body text,
  image_url text,
  video_id text,
  thumbnail_url text,
  call_to_action_type text,
  object_story_spec jsonb,
  raw jsonb,
  synced_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_creatives TO authenticated;
GRANT ALL ON public.meta_creatives TO service_role;
ALTER TABLE public.meta_creatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins veem criativos Meta" ON public.meta_creatives
  FOR ALL TO authenticated USING (public.is_admin_or_coord()) WITH CHECK (public.is_admin_or_coord());

-- Insights diários (grão: ad + dia)
CREATE TABLE IF NOT EXISTS public.meta_insights_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  account_id text NOT NULL,
  campaign_id text,
  adset_id text,
  ad_id text,
  spend numeric NOT NULL DEFAULT 0,
  impressions bigint NOT NULL DEFAULT 0,
  reach bigint NOT NULL DEFAULT 0,
  frequency numeric NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  ctr numeric NOT NULL DEFAULT 0,
  cpc numeric NOT NULL DEFAULT 0,
  cpm numeric NOT NULL DEFAULT 0,
  leads bigint NOT NULL DEFAULT 0,
  purchases bigint NOT NULL DEFAULT 0,
  purchase_value numeric NOT NULL DEFAULT 0,
  actions jsonb,
  action_values jsonb,
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_meta_insights_ad_day ON public.meta_insights_daily(date, ad_id)
  WHERE ad_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meta_insights_date ON public.meta_insights_daily(date DESC);
CREATE INDEX IF NOT EXISTS idx_meta_insights_campaign ON public.meta_insights_daily(campaign_id);
CREATE INDEX IF NOT EXISTS idx_meta_insights_account ON public.meta_insights_daily(account_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_insights_daily TO authenticated;
GRANT ALL ON public.meta_insights_daily TO service_role;
ALTER TABLE public.meta_insights_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins veem insights Meta" ON public.meta_insights_daily
  FOR ALL TO authenticated USING (public.is_admin_or_coord()) WITH CHECK (public.is_admin_or_coord());

-- Estado de sincronização
CREATE TABLE IF NOT EXISTS public.meta_sync_state (
  entity text PRIMARY KEY,          -- 'entities' | 'insights'
  last_run_at timestamptz,
  last_status text,
  last_message text,
  items_processed integer DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_sync_state TO authenticated;
GRANT ALL ON public.meta_sync_state TO service_role;
ALTER TABLE public.meta_sync_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins veem estado sync Meta" ON public.meta_sync_state
  FOR ALL TO authenticated USING (public.is_admin_or_coord()) WITH CHECK (public.is_admin_or_coord());
