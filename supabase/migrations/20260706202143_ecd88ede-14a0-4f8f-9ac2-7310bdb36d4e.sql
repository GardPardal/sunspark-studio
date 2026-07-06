
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS gclid text,
  ADD COLUMN IF NOT EXISTS fbclid text,
  ADD COLUMN IF NOT EXISTS fbp text,
  ADD COLUMN IF NOT EXISTS fbc text,
  ADD COLUMN IF NOT EXISTS page_url text,
  ADD COLUMN IF NOT EXISTS referrer text,
  ADD COLUMN IF NOT EXISTS user_agent text;

DROP POLICY IF EXISTS "Anyone can submit leads" ON public.leads;
CREATE POLICY "Anyone can submit leads" ON public.leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(nome) between 1 and 200
    AND length(telefone) between 6 and 30
    AND (email IS NULL OR length(email) <= 200)
    AND (cidade IS NULL OR length(cidade) <= 120)
    AND (estado IS NULL OR length(estado) <= 60)
    AND (valor_conta IS NULL OR length(valor_conta) <= 60)
    AND (mensagem IS NULL OR length(mensagem) <= 2000)
    AND (origem IS NULL OR length(origem) <= 60)
    AND (utm_source IS NULL OR length(utm_source) <= 200)
    AND (utm_medium IS NULL OR length(utm_medium) <= 200)
    AND (utm_campaign IS NULL OR length(utm_campaign) <= 200)
    AND (utm_term IS NULL OR length(utm_term) <= 200)
    AND (utm_content IS NULL OR length(utm_content) <= 200)
    AND (gclid IS NULL OR length(gclid) <= 400)
    AND (fbclid IS NULL OR length(fbclid) <= 400)
    AND (fbp IS NULL OR length(fbp) <= 200)
    AND (fbc IS NULL OR length(fbc) <= 400)
    AND (page_url IS NULL OR length(page_url) <= 2000)
    AND (referrer IS NULL OR length(referrer) <= 2000)
    AND (user_agent IS NULL OR length(user_agent) <= 500)
  );

INSERT INTO public.site_settings (key, value) VALUES
  ('ga4_measurement_id', ''),
  ('google_ads_id', ''),
  ('google_ads_conversion_label', ''),
  ('meta_pixel_id', '')
ON CONFLICT (key) DO NOTHING;
