
ALTER TABLE public.traffic_spend
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS impressions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicks integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leads_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS objective text,
  ADD COLUMN IF NOT EXISTS platform_url text;

ALTER TABLE public.traffic_spend
  DROP CONSTRAINT IF EXISTS traffic_spend_status_check;
ALTER TABLE public.traffic_spend
  ADD CONSTRAINT traffic_spend_status_check
  CHECK (status IN ('active','paused','ended','draft'));

UPDATE public.traffic_spend SET start_date = spend_date WHERE start_date IS NULL;
