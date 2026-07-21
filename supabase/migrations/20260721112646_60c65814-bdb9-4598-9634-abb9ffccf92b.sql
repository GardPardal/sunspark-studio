
ALTER TABLE public.manual_sales
  ADD COLUMN traffic_spend_id uuid REFERENCES public.traffic_spend(id) ON DELETE SET NULL;
CREATE INDEX idx_manual_sales_traffic ON public.manual_sales(traffic_spend_id);

UPDATE public.manual_sales
SET campaign_ref = 'Meta Ads 20/07/2026 — criativo não identificado',
    notes = 'Venda originada da campanha Meta Ads → WhatsApp de 20/07/2026. O criativo específico ainda não foi identificado; atualize quando souber.'
WHERE sale_date = '2026-07-20';
