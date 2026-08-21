DROP POLICY IF EXISTS "Consultores view all leads" ON public.leads;
DROP POLICY IF EXISTS "Consultores update leads" ON public.leads;
DROP POLICY IF EXISTS "SDR pode ver todos os leads" ON public.leads;
DROP POLICY IF EXISTS "SDR pode atualizar leads" ON public.leads;

DROP POLICY IF EXISTS "leads_select_scoped" ON public.leads;
CREATE POLICY "leads_select_scoped" ON public.leads
FOR SELECT TO authenticated
USING (
  public.is_admin_or_coord()
  OR assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR (assigned_to IS NULL AND public.is_sdr_or_above())
);

DROP POLICY IF EXISTS "leads_update_scoped" ON public.leads;
CREATE POLICY "leads_update_scoped" ON public.leads
FOR UPDATE TO authenticated
USING (
  public.is_admin_or_coord()
  OR assigned_to = auth.uid()
  OR (assigned_to IS NULL AND public.is_sdr_or_above())
)
WITH CHECK (
  public.is_admin_or_coord()
  OR assigned_to = auth.uid()
  OR assigned_to IS NULL
);