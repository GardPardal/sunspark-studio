ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS ploomes_deal_id bigint,
  ADD COLUMN IF NOT EXISTS lead_quality text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS lead_quality_reason text,
  ADD COLUMN IF NOT EXISTS lead_quality_at timestamptz;

CREATE INDEX IF NOT EXISTS leads_ploomes_deal_id_idx ON public.leads (ploomes_deal_id);