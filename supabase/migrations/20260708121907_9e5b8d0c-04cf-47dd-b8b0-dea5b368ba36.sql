
-- 1) Adicionar coluna de prioridade
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS roulette_priority integer NOT NULL DEFAULT 100;
CREATE INDEX IF NOT EXISTS idx_profiles_roulette_priority ON public.profiles(unit, roulette_priority);

-- 2) Função para atualizar prioridade (SDR/coord/admin)
CREATE OR REPLACE FUNCTION public.set_roulette_priority(_user_id uuid, _priority integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_sdr_or_above() THEN
    RAISE EXCEPTION 'Acesso restrito a SDR/coordenação.';
  END IF;
  UPDATE public.profiles SET roulette_priority = COALESCE(_priority, 100) WHERE id = _user_id;
END;
$$;

-- 3) Reescrever spin_roulette para respeitar prioridade (round-robin ordenado)
CREATE OR REPLACE FUNCTION public.spin_roulette(_unit unit_enum, _count integer)
RETURNS TABLE(lead_id uuid, assigned_to uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_consultores uuid[]; v_lead_ids uuid[]; v_i int; v_chosen uuid; v_n int;
BEGIN
  IF NOT public.is_sdr_or_above() THEN RAISE EXCEPTION 'Acesso restrito a SDR/coordenação.'; END IF;
  SELECT COALESCE(array_agg(p.id ORDER BY p.roulette_priority ASC, p.created_at ASC), '{}'::uuid[])
    INTO v_consultores
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.unit = _unit AND p.status = 'active' AND ur.role = 'consultor';
  v_n := array_length(v_consultores, 1);
  IF v_n IS NULL THEN RAISE EXCEPTION 'Nenhum consultor ativo na unidade %', _unit; END IF;

  SELECT COALESCE(array_agg(id), '{}'::uuid[]) INTO v_lead_ids FROM (
    SELECT id FROM public.leads
    WHERE assigned_to IS NULL AND stage = 'novo' AND is_offline = false
      AND COALESCE(tipo_encaminhamento,'orcamento') = 'orcamento'
      AND public.infer_unit_from_city(cidade) = _unit
    ORDER BY created_at ASC LIMIT _count FOR UPDATE SKIP LOCKED
  ) t;
  IF array_length(v_lead_ids, 1) IS NULL THEN RETURN; END IF;

  FOR v_i IN 1..array_length(v_lead_ids, 1) LOOP
    v_chosen := v_consultores[1 + ((v_i - 1) % v_n)];
    UPDATE public.leads SET assigned_to = v_chosen, stage = 'atendimento' WHERE id = v_lead_ids[v_i];
    INSERT INTO public.lead_transfers (lead_id, from_user, to_user, performed_by, reason)
    VALUES (v_lead_ids[v_i], NULL, v_chosen, auth.uid(), 'Roleta SDR (prioridade) - ' || _unit::text);
    lead_id := v_lead_ids[v_i]; assigned_to := v_chosen; RETURN NEXT;
  END LOOP;
END; $$;

-- 4) Mesma lógica para visita técnica
CREATE OR REPLACE FUNCTION public.spin_visita_tecnica(_unit unit_enum, _count integer)
RETURNS TABLE(lead_id uuid, assigned_to uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_consultores uuid[]; v_lead_ids uuid[]; v_i int; v_chosen uuid; v_n int;
BEGIN
  IF NOT public.is_sdr_or_above() THEN RAISE EXCEPTION 'Acesso restrito a SDR/coordenação.'; END IF;
  SELECT COALESCE(array_agg(p.id ORDER BY p.roulette_priority ASC, p.created_at ASC), '{}'::uuid[])
    INTO v_consultores
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.unit = _unit AND p.status = 'active' AND ur.role = 'consultor';
  v_n := array_length(v_consultores, 1);
  IF v_n IS NULL THEN RAISE EXCEPTION 'Nenhum consultor ativo na unidade %', _unit; END IF;

  SELECT COALESCE(array_agg(id), '{}'::uuid[]) INTO v_lead_ids FROM (
    SELECT id FROM public.leads
    WHERE assigned_to IS NULL AND stage = 'novo'
      AND tipo_encaminhamento = 'visita_tecnica'
      AND public.infer_unit_from_city(cidade) = _unit
    ORDER BY created_at ASC LIMIT _count FOR UPDATE SKIP LOCKED
  ) t;
  IF array_length(v_lead_ids, 1) IS NULL THEN RETURN; END IF;

  FOR v_i IN 1..array_length(v_lead_ids, 1) LOOP
    v_chosen := v_consultores[1 + ((v_i - 1) % v_n)];
    UPDATE public.leads SET assigned_to = v_chosen, stage = 'atendimento' WHERE id = v_lead_ids[v_i];
    INSERT INTO public.lead_transfers (lead_id, from_user, to_user, performed_by, reason)
    VALUES (v_lead_ids[v_i], NULL, v_chosen, auth.uid(), 'Visita técnica (prioridade) - ' || _unit::text);
    lead_id := v_lead_ids[v_i]; assigned_to := v_chosen; RETURN NEXT;
  END LOOP;
END; $$;
