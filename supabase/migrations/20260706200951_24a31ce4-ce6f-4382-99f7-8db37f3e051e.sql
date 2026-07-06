
-- 1) Tighten leads INSERT policy: replace WITH CHECK (true) with basic validation
DROP POLICY IF EXISTS "Anyone can submit leads" ON public.leads;
CREATE POLICY "Anyone can submit leads"
ON public.leads
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(nome) BETWEEN 1 AND 200
  AND length(telefone) BETWEEN 6 AND 30
  AND (email IS NULL OR length(email) <= 200)
  AND (cidade IS NULL OR length(cidade) <= 120)
  AND (estado IS NULL OR length(estado) <= 60)
  AND (valor_conta IS NULL OR length(valor_conta) <= 60)
  AND (mensagem IS NULL OR length(mensagem) <= 2000)
  AND (origem IS NULL OR length(origem) <= 60)
);

-- 2) Restrict has_role EXECUTE: it must only be callable in the RLS context, not exposed via the API for arbitrary user probing
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
-- Note: SECURITY DEFINER functions referenced inside RLS policies are evaluated by the policy engine
-- and do not require the invoking role to hold EXECUTE, so RLS keeps working.

-- 3) Add explicit deny-write policies on user_roles to prevent role escalation
-- (RLS is already fail-closed with no policies, but explicit policies make intent visible and future-proof)
CREATE POLICY "Deny all inserts on user_roles"
ON public.user_roles
FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "Deny all updates on user_roles"
ON public.user_roles
FOR UPDATE
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny all deletes on user_roles"
ON public.user_roles
FOR DELETE
TO anon, authenticated
USING (false);
