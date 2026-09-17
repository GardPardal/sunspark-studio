CREATE OR REPLACE FUNCTION public.prune_integration_sync_log()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.integration_sync_log WHERE created_at < now() - interval '7 days';
$$;
REVOKE ALL ON FUNCTION public.prune_integration_sync_log() FROM public, anon, authenticated;