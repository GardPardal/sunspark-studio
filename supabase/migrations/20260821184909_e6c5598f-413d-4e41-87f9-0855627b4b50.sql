-- 1. client_tickets: restrict SELECT to admin/coordenador
DROP POLICY IF EXISTS "tickets_read_authenticated" ON public.client_tickets;
CREATE POLICY "tickets_read_admin_coord" ON public.client_tickets
  FOR SELECT TO authenticated
  USING (public.is_admin_or_coord());

-- 2. finance_sales: restrict SELECT to admin/coordenador
DROP POLICY IF EXISTS "Autenticados podem ver vendas" ON public.finance_sales;
CREATE POLICY "Gestores podem ver vendas" ON public.finance_sales
  FOR SELECT TO authenticated
  USING (public.is_admin_or_coord());

-- 3. liz_aprendizados: scope writes to owner or admin/coord
DROP POLICY IF EXISTS "Time logado grava aprendizados" ON public.liz_aprendizados;
DROP POLICY IF EXISTS "Time logado atualiza aprendizados" ON public.liz_aprendizados;
CREATE POLICY "Autor grava aprendizados" ON public.liz_aprendizados
  FOR INSERT TO authenticated
  WITH CHECK (criado_por = auth.uid() OR public.is_admin_or_coord());
CREATE POLICY "Autor ou gestor atualiza aprendizados" ON public.liz_aprendizados
  FOR UPDATE TO authenticated
  USING (criado_por = auth.uid() OR public.is_admin_or_coord())
  WITH CHECK (criado_por = auth.uid() OR public.is_admin_or_coord());

-- 4. ploomes_users: restrict SELECT to sdr or above
DROP POLICY IF EXISTS "Autenticados leem responsaveis ploomes" ON public.ploomes_users;
CREATE POLICY "SDR ou acima le responsaveis ploomes" ON public.ploomes_users
  FOR SELECT TO authenticated
  USING (public.is_sdr_or_above());

-- 5. Fix mutable search_path on remaining public functions
ALTER FUNCTION public.add_business_hours(timestamp with time zone, numeric) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq, extensions;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq, extensions;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq, extensions;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq, extensions;
ALTER FUNCTION public.norm_city(text) SET search_path = public;
ALTER FUNCTION public.only_digits(text) SET search_path = public;
ALTER FUNCTION public.ploomes_captacao_id(text, text) SET search_path = public;
ALTER FUNCTION public.ploomes_filial_id(unit_enum) SET search_path = public;

-- 6. Remove anonymous EXECUTE on SECURITY DEFINER functions in public schema
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.oid NOT IN (SELECT objid FROM pg_depend WHERE deptype = 'e')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END $$;