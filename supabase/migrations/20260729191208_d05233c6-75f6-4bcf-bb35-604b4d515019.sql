
ALTER TABLE public.conversion_events
  ADD COLUMN IF NOT EXISTS status_detail text,
  ADD COLUMN IF NOT EXISTS match_quality numeric,
  ADD COLUMN IF NOT EXISTS validation_errors jsonb,
  ADD COLUMN IF NOT EXISTS retry_of uuid REFERENCES public.conversion_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conversion_events_status_detail ON public.conversion_events(status_detail);
CREATE INDEX IF NOT EXISTS idx_conversion_events_created_at ON public.conversion_events(created_at DESC);
