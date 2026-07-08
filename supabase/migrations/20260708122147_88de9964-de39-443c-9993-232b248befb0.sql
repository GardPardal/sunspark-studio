
-- Duas filas separadas
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS queue_pos_orcamento integer NOT NULL DEFAULT 100;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS queue_pos_visita integer NOT NULL DEFAULT 100;

-- Inicializa filas com o ranking atual (se existir)
UPDATE public.profiles SET queue_pos_orcamento = roulette_priority, queue_pos_visita = roulette_priority
WHERE queue_pos_orcamento = 100 AND queue_pos_visita = 100;

CREATE INDEX IF NOT EXISTS idx_profiles_queue_orc ON public.profiles(unit, queue_pos_orcamento);
CREATE INDEX IF NOT EXISTS idx_profiles_queue_visita ON public.profiles(unit, queue_pos_visita);

-- Atualiza set_roulette_priority para setar as duas filas iniciais também
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
  UPDATE public.profiles
    SET roulette_priority = COALESCE(_priority, 100),
        queue_pos_orcamento = COALESCE(_priority, 100),
        queue_pos_visita = COALESCE(_priority, 100)
  WHERE id = _user_id;
END;
$$;

-- Roleta orçamento: pega o consultor de menor queue_pos_orcamento, joga pro fim da fila
CREATE OR REPLACE FUNCTION public.spin_roulette(_unit unit_enum, _count integer)
RETURNS TABLE(lead_id uuid, assigned_to uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_ids uuid[]; v_i int; v_chosen uuid; v_max int;
BEGIN
  IF NOT public.is_sdr_or_above() THEN RAISE EXCEPTION 'Acesso restrito a SDR/coordenação.'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.unit = _unit AND p.status = 'active' AND ur.role = 'consultor'
  ) THEN RAISE EXCEPTION 'Nenhum consultor ativo na unidade %', _unit; END IF;

  SELECT COALESCE(array_agg(id), '{}'::uuid[]) INTO v_lead_ids FROM (
    SELECT id FROM public.leads
    WHERE assigned_to IS NULL AND stage = 'novo' AND is_offline = false
      AND COALESCE(tipo_encaminhamento,'orcamento') = 'orcamento'
      AND public.infer_unit_from_city(cidade) = _unit
    ORDER BY created_at ASC LIMIT _count FOR UPDATE SKIP LOCKED
  ) t;
  IF array_length(v_lead_ids, 1) IS NULL THEN RETURN; END IF;

  FOR v_i IN 1..array_length(v_lead_ids, 1) LOOP
    -- pega o primeiro da fila
    SELECT p.id INTO v_chosen
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.unit = _unit AND p.status = 'active' AND ur.role = 'consultor'
    ORDER BY p.queue_pos_orcamento ASC, p.created_at ASC
    LIMIT 1 FOR UPDATE OF p;

    -- manda pro fim da fila (max+10)
    SELECT COALESCE(MAX(p.queue_pos_orcamento), 0) INTO v_max
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.unit = _unit AND p.status = 'active' AND ur.role = 'consultor';

    UPDATE public.profiles SET queue_pos_orcamento = v_max + 10 WHERE id = v_chosen;

    UPDATE public.leads SET assigned_to = v_chosen, stage = 'atendimento' WHERE id = v_lead_ids[v_i];
    INSERT INTO public.lead_transfers (lead_id, from_user, to_user, performed_by, reason)
    VALUES (v_lead_ids[v_i], NULL, v_chosen, auth.uid(), 'Roleta fila - ' || _unit::text);
    lead_id := v_lead_ids[v_i]; assigned_to := v_chosen; RETURN NEXT;
  END LOOP;
END; $$;

-- Roleta visita técnica: mesma lógica, fila separada
CREATE OR REPLACE FUNCTION public.spin_visita_tecnica(_unit unit_enum, _count integer)
RETURNS TABLE(lead_id uuid, assigned_to uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_ids uuid[]; v_i int; v_chosen uuid; v_max int;
BEGIN
  IF NOT public.is_sdr_or_above() THEN RAISE EXCEPTION 'Acesso restrito a SDR/coordenação.'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.unit = _unit AND p.status = 'active' AND ur.role = 'consultor'
  ) THEN RAISE EXCEPTION 'Nenhum consultor ativo na unidade %', _unit; END IF;

  SELECT COALESCE(array_agg(id), '{}'::uuid[]) INTO v_lead_ids FROM (
    SELECT id FROM public.leads
    WHERE assigned_to IS NULL AND stage = 'novo'
      AND tipo_encaminhamento = 'visita_tecnica'
      AND public.infer_unit_from_city(cidade) = _unit
    ORDER BY created_at ASC LIMIT _count FOR UPDATE SKIP LOCKED
  ) t;
  IF array_length(v_lead_ids, 1) IS NULL THEN RETURN; END IF;

  FOR v_i IN 1..array_length(v_lead_ids, 1) LOOP
    SELECT p.id INTO v_chosen
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.unit = _unit AND p.status = 'active' AND ur.role = 'consultor'
    ORDER BY p.queue_pos_visita ASC, p.created_at ASC
    LIMIT 1 FOR UPDATE OF p;

    SELECT COALESCE(MAX(p.queue_pos_visita), 0) INTO v_max
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.unit = _unit AND p.status = 'active' AND ur.role = 'consultor';

    UPDATE public.profiles SET queue_pos_visita = v_max + 10 WHERE id = v_chosen;

    UPDATE public.leads SET assigned_to = v_chosen, stage = 'atendimento' WHERE id = v_lead_ids[v_i];
    INSERT INTO public.lead_transfers (lead_id, from_user, to_user, performed_by, reason)
    VALUES (v_lead_ids[v_i], NULL, v_chosen, auth.uid(), 'Fila visita técnica - ' || _unit::text);
    lead_id := v_lead_ids[v_i]; assigned_to := v_chosen; RETURN NEXT;
  END LOOP;
END; $$;
