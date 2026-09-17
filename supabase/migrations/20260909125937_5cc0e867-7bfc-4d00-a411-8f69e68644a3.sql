DELETE FROM public.integration_sync_log WHERE created_at < now() - interval '14 days';

CREATE INDEX IF NOT EXISTS idx_integration_sync_log_created ON public.integration_sync_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_sync_log_provider_created ON public.integration_sync_log (provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_posts_origin_created ON public.site_posts (origin, created_at DESC);

DROP INDEX IF EXISTS public.wa_events_status_received_idx;

CREATE OR REPLACE FUNCTION public.prune_integration_sync_log()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.integration_sync_log WHERE created_at < now() - interval '14 days';
$$;

REVOKE ALL ON FUNCTION public.prune_integration_sync_log() FROM public, anon, authenticated;

SELECT cron.schedule('prune-integration-sync-log', '0 4 * * *', $$SELECT public.prune_integration_sync_log();$$)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prune-integration-sync-log');

ANALYZE public.integration_sync_log;
ANALYZE public.site_posts;