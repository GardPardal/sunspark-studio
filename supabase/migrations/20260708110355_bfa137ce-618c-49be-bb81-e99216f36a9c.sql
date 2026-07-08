
-- 1. Enums
DO $$ BEGIN
  CREATE TYPE public.unit_enum AS ENUM ('londrina','ponta_grossa','wenceslau_braz');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.user_status AS ENUM ('pending','active','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Adicionar colunas em profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS unit public.unit_enum,
  ADD COLUMN IF NOT EXISTS status public.user_status NOT NULL DEFAULT 'active';

-- 3. Tabela de aprovações
CREATE TABLE IF NOT EXISTS public.account_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  requested_unit public.unit_enum,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',   -- pending | approved | rejected
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  decided_at timestamptz,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.account_approvals TO authenticated;
GRANT ALL ON public.account_approvals TO service_role;

ALTER TABLE public.account_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins view approvals" ON public.account_approvals;
CREATE POLICY "admins view approvals" ON public.account_approvals
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins update approvals" ON public.account_approvals;
CREATE POLICY "admins update approvals" ON public.account_approvals
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_approvals_token ON public.account_approvals(token);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON public.account_approvals(status);

-- 4. Atualizar trigger handle_new_user_profile — cria profile PENDING + approval quando origem = 'self_signup'
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_unit public.unit_enum;
  v_status public.user_status := 'active';
  v_self boolean := COALESCE((NEW.raw_user_meta_data->>'self_signup')::boolean, false);
  v_token text;
BEGIN
  -- Extrai unidade do metadata (se vier)
  BEGIN
    v_unit := (NEW.raw_user_meta_data->>'unit')::public.unit_enum;
  EXCEPTION WHEN others THEN v_unit := NULL; END;

  -- Se for self-signup, começa pendente
  IF v_self THEN v_status := 'pending'; END IF;

  INSERT INTO public.profiles (id, email, full_name, unit, status)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), v_unit, v_status)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    unit = COALESCE(public.profiles.unit, EXCLUDED.unit),
    status = CASE WHEN v_self THEN 'pending'::public.user_status ELSE public.profiles.status END;

  -- Cria approval request se for self signup
  IF v_self THEN
    v_token := encode(gen_random_bytes(24), 'hex');
    INSERT INTO public.account_approvals (user_id, email, full_name, requested_unit, token)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), v_unit, v_token);
  END IF;

  RETURN NEW;
END;
$function$;

-- Criar trigger se não existir
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created_profile'
  ) THEN
    CREATE TRIGGER on_auth_user_created_profile
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();
  END IF;
END $$;

-- 5. Função helper: obter cidade/unidade
CREATE OR REPLACE FUNCTION public.get_user_unit(_user_id uuid)
RETURNS public.unit_enum
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT unit FROM public.profiles WHERE id = _user_id $$;

-- 6. Função de distribuição por roleta (SDR)
CREATE OR REPLACE FUNCTION public.spin_roulette(_unit public.unit_enum, _count int)
RETURNS TABLE(lead_id uuid, assigned_to uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_consultores uuid[];
  v_lead_ids uuid[];
  v_i int;
  v_chosen uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'coordenador'::public.app_role)) THEN
    RAISE EXCEPTION 'Acesso restrito a coordenadores.';
  END IF;

  -- Consultores ativos da unidade
  SELECT COALESCE(array_agg(p.id), '{}'::uuid[]) INTO v_consultores
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.unit = _unit AND p.status = 'active' AND ur.role = 'consultor';

  IF array_length(v_consultores, 1) IS NULL OR array_length(v_consultores, 1) = 0 THEN
    RAISE EXCEPTION 'Nenhum consultor ativo na unidade %', _unit;
  END IF;

  -- Trava e escolhe os N leads mais antigos, de tráfego, sem dono, no estágio novo
  SELECT COALESCE(array_agg(id), '{}'::uuid[]) INTO v_lead_ids
  FROM (
    SELECT id FROM public.leads
    WHERE assigned_to IS NULL
      AND stage = 'novo'
      AND is_offline = false
    ORDER BY created_at ASC
    LIMIT _count
    FOR UPDATE SKIP LOCKED
  ) t;

  IF array_length(v_lead_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Distribui em round-robin randomizado
  FOR v_i IN 1..array_length(v_lead_ids, 1) LOOP
    v_chosen := v_consultores[1 + floor(random() * array_length(v_consultores, 1))::int];
    UPDATE public.leads SET assigned_to = v_chosen, stage = 'atendimento' WHERE id = v_lead_ids[v_i];
    INSERT INTO public.lead_transfers (lead_id, from_user, to_user, performed_by, reason)
    VALUES (v_lead_ids[v_i], NULL, v_chosen, auth.uid(), 'Roleta SDR - ' || _unit::text);
    lead_id := v_lead_ids[v_i];
    assigned_to := v_chosen;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.spin_roulette(public.unit_enum, int) TO authenticated;
