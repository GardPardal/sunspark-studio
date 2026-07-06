
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS external_source TEXT,
  ADD COLUMN IF NOT EXISTS pipeline_id BIGINT,
  ADD COLUMN IF NOT EXISTS pipeline_stage_id BIGINT,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS leads_external_source_id_idx
  ON public.leads (external_source, external_id)
  WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.ploomes_pipelines (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  stages JSONB NOT NULL DEFAULT '[]'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ploomes_pipelines TO authenticated;
GRANT ALL ON public.ploomes_pipelines TO service_role;
ALTER TABLE public.ploomes_pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem os funis do Ploomes"
  ON public.ploomes_pipelines FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.integration_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  items_imported INTEGER NOT NULL DEFAULT 0,
  items_updated INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  triggered_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.integration_sync_log TO authenticated;
GRANT ALL ON public.integration_sync_log TO service_role;
ALTER TABLE public.integration_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem o histórico de sincronização"
  ON public.integration_sync_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
