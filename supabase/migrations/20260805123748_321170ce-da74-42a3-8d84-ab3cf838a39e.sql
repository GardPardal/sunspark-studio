ALTER TABLE public.manual_sales
  ADD COLUMN IF NOT EXISTS invoiced_date date,
  ADD COLUMN IF NOT EXISTS ploomes_invoice_deal_id bigint;

CREATE INDEX IF NOT EXISTS manual_sales_sale_date_idx ON public.manual_sales (sale_date);
CREATE INDEX IF NOT EXISTS manual_sales_invoiced_date_idx ON public.manual_sales (invoiced_date);
CREATE UNIQUE INDEX IF NOT EXISTS manual_sales_ploomes_invoice_deal_id_uidx
  ON public.manual_sales (ploomes_invoice_deal_id)
  WHERE ploomes_invoice_deal_id IS NOT NULL;