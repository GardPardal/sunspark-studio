ALTER TABLE public.integration_sync_log
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS action text,
  ADD COLUMN IF NOT EXISTS payload jsonb;

ALTER TABLE public.integration_sync_log
  ALTER COLUMN provider DROP NOT NULL;

UPDATE public.integration_sync_log SET source = provider WHERE source IS NULL AND provider IS NOT NULL;