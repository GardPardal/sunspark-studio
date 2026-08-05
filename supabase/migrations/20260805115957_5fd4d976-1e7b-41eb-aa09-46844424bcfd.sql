ALTER TABLE public.manual_sales
  ADD COLUMN IF NOT EXISTS ploomes_deal_id bigint,
  ADD COLUMN IF NOT EXISTS ploomes_owner_name text;

CREATE UNIQUE INDEX IF NOT EXISTS manual_sales_ploomes_deal_id_key
  ON public.manual_sales (ploomes_deal_id) WHERE ploomes_deal_id IS NOT NULL;