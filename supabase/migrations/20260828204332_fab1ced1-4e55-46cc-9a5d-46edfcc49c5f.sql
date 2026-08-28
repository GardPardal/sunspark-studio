CREATE TABLE IF NOT EXISTS public.mcp_admin_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  kind text NOT NULL,
  statement text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mcp_admin_audit TO authenticated;
GRANT ALL ON public.mcp_admin_audit TO service_role;
ALTER TABLE public.mcp_admin_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read audit" ON public.mcp_admin_audit;
CREATE POLICY "Admins read audit" ON public.mcp_admin_audit
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.mcp_admin_query(_sql text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  clean text := btrim(_sql, E' \t\n\r;');
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores';
  END IF;
  IF clean !~* '^(select|with)\s' THEN
    RAISE EXCEPTION 'Apenas consultas SELECT/WITH são permitidas aqui';
  END IF;
  INSERT INTO public.mcp_admin_audit(user_id, kind, statement) VALUES (auth.uid(), 'query', clean);
  EXECUTE format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from (%s) t', clean) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.mcp_admin_execute(_sql text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected bigint;
  clean text := btrim(_sql, E' \t\n\r;');
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores';
  END IF;
  IF clean ~* '^\s*(drop\s+(database|schema)|alter\s+system)' THEN
    RAISE EXCEPTION 'Operação bloqueada';
  END IF;
  INSERT INTO public.mcp_admin_audit(user_id, kind, statement) VALUES (auth.uid(), 'execute', clean);
  EXECUTE clean;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'rows_affected', affected);
END;
$$;

REVOKE ALL ON FUNCTION public.mcp_admin_query(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mcp_admin_execute(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mcp_admin_query(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_admin_execute(text) TO authenticated;