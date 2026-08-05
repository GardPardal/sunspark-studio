CREATE TABLE public.ploomes_users (
  ploomes_id bigint PRIMARY KEY,
  name text NOT NULL,
  email text,
  active boolean NOT NULL DEFAULT true,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  seller_id uuid REFERENCES public.sales_sellers(id) ON DELETE SET NULL,
  unit public.unit_enum,
  source text NOT NULL DEFAULT 'ploomes_form',
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ploomes_users TO authenticated;
GRANT ALL ON public.ploomes_users TO service_role;

ALTER TABLE public.ploomes_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem responsaveis ploomes"
  ON public.ploomes_users FOR SELECT TO authenticated USING (true);

CREATE POLICY "SDR ou acima gerencia responsaveis ploomes"
  ON public.ploomes_users FOR ALL TO authenticated
  USING (public.is_sdr_or_above())
  WITH CHECK (public.is_sdr_or_above());

CREATE TRIGGER trg_ploomes_users_uat
  BEFORE UPDATE ON public.ploomes_users
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();