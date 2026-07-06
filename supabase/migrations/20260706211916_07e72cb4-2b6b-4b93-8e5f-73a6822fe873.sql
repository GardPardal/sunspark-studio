DROP POLICY IF EXISTS "Consultores view assigned leads" ON public.leads;
DROP POLICY IF EXISTS "Consultores update assigned leads" ON public.leads;

CREATE POLICY "Consultores view all leads"
  ON public.leads FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'consultor'::public.app_role));

CREATE POLICY "Consultores update leads"
  ON public.leads FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'consultor'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'consultor'::public.app_role));