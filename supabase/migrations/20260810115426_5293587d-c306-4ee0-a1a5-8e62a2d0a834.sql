ALTER TABLE public.manual_sales
  ADD COLUMN IF NOT EXISTS lead_origin text,
  ADD COLUMN IF NOT EXISTS ploomes_creator_id bigint,
  ADD COLUMN IF NOT EXISTS ploomes_creator_name text,
  ADD COLUMN IF NOT EXISTS branch text;

CREATE INDEX IF NOT EXISTS manual_sales_lead_origin_idx ON public.manual_sales (lead_origin);
CREATE INDEX IF NOT EXISTS manual_sales_creator_idx ON public.manual_sales (ploomes_creator_id);