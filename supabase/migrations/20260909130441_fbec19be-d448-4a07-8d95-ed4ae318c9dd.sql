CREATE UNIQUE INDEX IF NOT EXISTS leads_external_source_external_id_key
  ON public.leads (external_source, external_id);
DROP INDEX IF EXISTS public.leads_external_source_id_idx;