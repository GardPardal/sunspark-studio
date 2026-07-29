
ALTER TABLE public.conversion_events
  ADD COLUMN IF NOT EXISTS event_id text,
  ADD COLUMN IF NOT EXISTS fbtrace_id text,
  ADD COLUMN IF NOT EXISTS request_payload jsonb,
  ADD COLUMN IF NOT EXISTS http_status integer,
  ADD COLUMN IF NOT EXISTS test_mode boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_conversion_events_created_at ON public.conversion_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversion_events_event_name ON public.conversion_events (event_name);
CREATE INDEX IF NOT EXISTS idx_conversion_events_lead_id ON public.conversion_events (lead_id);
CREATE INDEX IF NOT EXISTS idx_conversion_events_event_id ON public.conversion_events (event_id);

-- Permite que admin/coordenador leiam via /mod/meta-debug (RLS já ativo)
DROP POLICY IF EXISTS "conversion_events_admin_read" ON public.conversion_events;
CREATE POLICY "conversion_events_admin_read"
  ON public.conversion_events
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_coord());

GRANT SELECT ON public.conversion_events TO authenticated;
GRANT ALL ON public.conversion_events TO service_role;
