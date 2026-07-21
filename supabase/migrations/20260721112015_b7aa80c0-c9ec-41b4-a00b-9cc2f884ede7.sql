
CREATE TABLE public.sales_sellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  unit public.unit_enum,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_sellers TO authenticated;
GRANT ALL ON public.sales_sellers TO service_role;
ALTER TABLE public.sales_sellers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sellers_read" ON public.sales_sellers FOR SELECT TO authenticated USING (true);
CREATE POLICY "sellers_write" ON public.sales_sellers FOR ALL TO authenticated
  USING (public.is_admin_or_coord() OR public.is_sdr_or_above())
  WITH CHECK (public.is_admin_or_coord() OR public.is_sdr_or_above());
CREATE TRIGGER trg_sellers_updated BEFORE UPDATE ON public.sales_sellers
  FOR EACH ROW EXECUTE FUNCTION public.agenda_touch_updated_at();

CREATE TABLE public.manual_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid REFERENCES public.sales_sellers(id) ON DELETE SET NULL,
  sale_date date NOT NULL DEFAULT current_date,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  city text,
  campaign_ref text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manual_sales TO authenticated;
GRANT ALL ON public.manual_sales TO service_role;
ALTER TABLE public.manual_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manual_sales_read" ON public.manual_sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "manual_sales_write" ON public.manual_sales FOR ALL TO authenticated
  USING (public.is_admin_or_coord() OR public.is_sdr_or_above())
  WITH CHECK (public.is_admin_or_coord() OR public.is_sdr_or_above());
CREATE TRIGGER trg_manual_sales_updated BEFORE UPDATE ON public.manual_sales
  FOR EACH ROW EXECUTE FUNCTION public.agenda_touch_updated_at();
CREATE INDEX idx_manual_sales_date ON public.manual_sales(sale_date);
CREATE INDEX idx_manual_sales_seller ON public.manual_sales(seller_id);

-- Seed dos 3 vendedores (linkando ao profile quando existir)
INSERT INTO public.sales_sellers (name, unit, profile_id) VALUES
  ('Mikaela', 'londrina', 'ef89656a-12a6-48de-8a2c-df4e90db2bc6'),
  ('Augusto', 'ponta_grossa', '84f00991-bf48-427a-a1d8-9c5c2c296b21'),
  ('Daniele', 'wenceslau_braz', NULL);

-- Seed das 3 vendas informadas (20/07/2026)
INSERT INTO public.manual_sales (seller_id, sale_date, amount, city, campaign_ref, notes)
SELECT s.id, '2026-07-20'::date, v.amount, v.city,
       'Meta Ads → WhatsApp (20/07/2026)',
       'Venda registrada manualmente — leads Meta Ads que ainda não passam pelo CRM.'
FROM public.sales_sellers s
JOIN (VALUES
  ('Mikaela', 7826.00::numeric,  'Londrina'),
  ('Augusto', 11563.43::numeric, 'Ponta Grossa'),
  ('Daniele', 15800.00::numeric, 'Wenceslau Braz')
) AS v(name, amount, city) ON s.name = v.name;
