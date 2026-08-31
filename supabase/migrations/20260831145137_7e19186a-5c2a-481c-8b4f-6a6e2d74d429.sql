DROP POLICY IF EXISTS hub_le ON public.hub_estado;
DROP POLICY IF EXISTS hub_escreve ON public.hub_estado;
DROP POLICY IF EXISTS hub_estado_read_priv ON public.hub_estado;
DROP POLICY IF EXISTS hub_estado_update_priv ON public.hub_estado;
REVOKE ALL ON public.hub_estado FROM anon;
GRANT SELECT, UPDATE ON public.hub_estado TO authenticated;
GRANT ALL ON public.hub_estado TO service_role;
ALTER TABLE public.hub_estado ENABLE ROW LEVEL SECURITY;
CREATE POLICY hub_estado_read_priv ON public.hub_estado FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador'));
CREATE POLICY hub_estado_update_priv ON public.hub_estado FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador'));