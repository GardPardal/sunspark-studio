GRANT SELECT, INSERT, UPDATE ON public.hub_dados TO authenticated;
GRANT SELECT, INSERT ON public.hub_dados_hist TO authenticated;

DROP POLICY IF EXISTS "Admins podem gravar os dados do hub" ON public.hub_dados;
CREATE POLICY "Admins podem gravar os dados do hub" ON public.hub_dados
  FOR ALL TO authenticated
  USING (public.is_admin_or_coord())
  WITH CHECK (public.is_admin_or_coord());

DROP POLICY IF EXISTS "Admins leem historico do hub" ON public.hub_dados_hist;
CREATE POLICY "Admins leem historico do hub" ON public.hub_dados_hist
  FOR SELECT TO authenticated
  USING (public.is_admin_or_coord());

DROP POLICY IF EXISTS "Admins gravam historico do hub" ON public.hub_dados_hist;
CREATE POLICY "Admins gravam historico do hub" ON public.hub_dados_hist
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_coord());