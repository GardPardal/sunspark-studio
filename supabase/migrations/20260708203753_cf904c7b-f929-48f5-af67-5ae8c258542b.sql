
-- 1) Novas colunas
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS atendimento_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS atendimento_confirmado_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_prioridade_emergencia boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_leads_deadline_open
  ON public.leads (atendimento_deadline)
  WHERE atendimento_confirmado_at IS NULL AND atendimento_deadline IS NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS queue_frozen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS queue_frozen_at timestamptz,
  ADD COLUMN IF NOT EXISTS queue_frozen_reason text;

-- 2) Soma 2h úteis (America/Sao_Paulo, seg-sex 8-18h, sáb 8-12h)
CREATE OR REPLACE FUNCTION public.add_business_hours(_from timestamptz, _hours numeric)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  tz constant text := 'America/Sao_Paulo';
  v_local timestamp := (_from AT TIME ZONE tz);
  v_remaining int := (_hours * 3600)::int;
  v_dow int;
  v_start timestamp;
  v_end timestamp;
  v_win int;
BEGIN
  WHILE v_remaining > 0 LOOP
    v_dow := EXTRACT(ISODOW FROM v_local)::int; -- 1=seg..7=dom
    IF v_dow = 7 THEN
      v_local := date_trunc('day', v_local) + interval '1 day' + interval '8 hours';
      CONTINUE;
    END IF;
    IF v_dow = 6 THEN
      v_start := date_trunc('day', v_local) + interval '8 hours';
      v_end   := date_trunc('day', v_local) + interval '12 hours';
    ELSE
      v_start := date_trunc('day', v_local) + interval '8 hours';
      v_end   := date_trunc('day', v_local) + interval '18 hours';
    END IF;
    IF v_local < v_start THEN v_local := v_start; END IF;
    IF v_local >= v_end THEN
      v_local := date_trunc('day', v_local) + interval '1 day' + interval '8 hours';
      CONTINUE;
    END IF;
    v_win := EXTRACT(EPOCH FROM (v_end - v_local))::int;
    IF v_remaining <= v_win THEN
      v_local := v_local + make_interval(secs => v_remaining);
      v_remaining := 0;
    ELSE
      v_remaining := v_remaining - v_win;
      v_local := date_trunc('day', v_local) + interval '1 day' + interval '8 hours';
    END IF;
  END LOOP;
  RETURN v_local AT TIME ZONE tz;
END;
$$;

-- 3) Notifica consultor por e-mail (via pgmq já existente)
CREATE OR REPLACE FUNCTION public.notify_consultor_novo_lead(_lead_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text; v_name text; v_lead record; v_deadline timestamptz;
BEGIN
  SELECT email, full_name INTO v_email, v_name FROM public.profiles WHERE id = _user_id;
  IF v_email IS NULL THEN RETURN; END IF;
  SELECT id, nome, telefone, cidade, estado, valor_conta, atendimento_deadline
    INTO v_lead FROM public.leads WHERE id = _lead_id;
  v_deadline := v_lead.atendimento_deadline;

  PERFORM public.enqueue_email('q_transactional_emails', jsonb_build_object(
    'to', v_email,
    'subject', '🔥 Novo lead LZ7 — você tem 2h úteis pra confirmar',
    'template', 'novo_lead_consultor',
    'data', jsonb_build_object(
      'consultor', v_name,
      'lead_nome', v_lead.nome,
      'lead_telefone', v_lead.telefone,
      'lead_cidade', v_lead.cidade,
      'lead_estado', v_lead.estado,
      'lead_valor_conta', v_lead.valor_conta,
      'deadline', v_deadline,
      'cta_url', 'https://z7energia.lovable.app/crm?lead=' || _lead_id::text
    )
  ));
  -- TODO WhatsApp: quando WHATSAPP_ACCESS_TOKEN for cadastrado, chamar edge fn de envio aqui.
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.integration_sync_log (source, action, status, message)
  VALUES ('notify_consultor', 'novo_lead', 'error', SQLERRM);
END;
$$;

-- 4) spin_roulette (pula frozen + grava deadline + notifica)
CREATE OR REPLACE FUNCTION public.spin_roulette(_unit unit_enum, _count integer)
RETURNS TABLE(lead_id uuid, assigned_to uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_ids uuid[]; v_i int; v_chosen uuid; v_max int; v_deadline timestamptz;
BEGIN
  IF NOT public.is_sdr_or_above() THEN RAISE EXCEPTION 'Acesso restrito a SDR/coordenação.'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.unit = _unit AND p.status = 'active'
      AND COALESCE(p.queue_frozen, false) = false
      AND ur.role = 'consultor'
  ) THEN RAISE EXCEPTION 'Nenhum consultor ativo (e não-congelado) na unidade %', _unit; END IF;

  SELECT COALESCE(array_agg(id), '{}'::uuid[]) INTO v_lead_ids FROM (
    SELECT id FROM public.leads
    WHERE assigned_to IS NULL AND stage = 'novo' AND is_offline = false
      AND COALESCE(tipo_encaminhamento,'orcamento') = 'orcamento'
      AND public.infer_unit_from_city(cidade) = _unit
    ORDER BY is_prioridade_emergencia DESC, created_at ASC
    LIMIT _count FOR UPDATE SKIP LOCKED
  ) t;
  IF array_length(v_lead_ids, 1) IS NULL THEN RETURN; END IF;

  FOR v_i IN 1..array_length(v_lead_ids, 1) LOOP
    SELECT p.id INTO v_chosen
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.unit = _unit AND p.status = 'active'
      AND COALESCE(p.queue_frozen, false) = false
      AND ur.role = 'consultor'
    ORDER BY p.queue_pos_orcamento ASC, p.created_at ASC
    LIMIT 1 FOR UPDATE OF p;

    SELECT COALESCE(MAX(p.queue_pos_orcamento), 0) INTO v_max
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.unit = _unit AND p.status = 'active' AND ur.role = 'consultor';

    UPDATE public.profiles SET queue_pos_orcamento = v_max + 10 WHERE id = v_chosen;

    v_deadline := public.add_business_hours(now(), 2);
    UPDATE public.leads
      SET assigned_to = v_chosen,
          stage = 'atendimento',
          atendimento_deadline = v_deadline,
          atendimento_confirmado_at = NULL
      WHERE id = v_lead_ids[v_i];

    INSERT INTO public.lead_transfers (lead_id, from_user, to_user, performed_by, reason)
    VALUES (v_lead_ids[v_i], NULL, v_chosen, auth.uid(), 'Roleta fila - ' || _unit::text);

    PERFORM public.notify_consultor_novo_lead(v_lead_ids[v_i], v_chosen);

    lead_id := v_lead_ids[v_i]; assigned_to := v_chosen; RETURN NEXT;
  END LOOP;
END;
$$;

-- 5) spin_visita_tecnica (mesma lógica)
CREATE OR REPLACE FUNCTION public.spin_visita_tecnica(_unit unit_enum, _count integer)
RETURNS TABLE(lead_id uuid, assigned_to uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_ids uuid[]; v_i int; v_chosen uuid; v_max int; v_deadline timestamptz;
BEGIN
  IF NOT public.is_sdr_or_above() THEN RAISE EXCEPTION 'Acesso restrito a SDR/coordenação.'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.unit = _unit AND p.status = 'active'
      AND COALESCE(p.queue_frozen, false) = false
      AND ur.role = 'consultor'
  ) THEN RAISE EXCEPTION 'Nenhum consultor ativo (e não-congelado) na unidade %', _unit; END IF;

  SELECT COALESCE(array_agg(id), '{}'::uuid[]) INTO v_lead_ids FROM (
    SELECT id FROM public.leads
    WHERE assigned_to IS NULL AND stage = 'novo'
      AND tipo_encaminhamento = 'visita_tecnica'
      AND public.infer_unit_from_city(cidade) = _unit
    ORDER BY is_prioridade_emergencia DESC, created_at ASC
    LIMIT _count FOR UPDATE SKIP LOCKED
  ) t;
  IF array_length(v_lead_ids, 1) IS NULL THEN RETURN; END IF;

  FOR v_i IN 1..array_length(v_lead_ids, 1) LOOP
    SELECT p.id INTO v_chosen
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.unit = _unit AND p.status = 'active'
      AND COALESCE(p.queue_frozen, false) = false
      AND ur.role = 'consultor'
    ORDER BY p.queue_pos_visita ASC, p.created_at ASC
    LIMIT 1 FOR UPDATE OF p;

    SELECT COALESCE(MAX(p.queue_pos_visita), 0) INTO v_max
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.unit = _unit AND p.status = 'active' AND ur.role = 'consultor';

    UPDATE public.profiles SET queue_pos_visita = v_max + 10 WHERE id = v_chosen;

    v_deadline := public.add_business_hours(now(), 2);
    UPDATE public.leads
      SET assigned_to = v_chosen,
          stage = 'atendimento',
          atendimento_deadline = v_deadline,
          atendimento_confirmado_at = NULL
      WHERE id = v_lead_ids[v_i];

    INSERT INTO public.lead_transfers (lead_id, from_user, to_user, performed_by, reason)
    VALUES (v_lead_ids[v_i], NULL, v_chosen, auth.uid(), 'Fila visita técnica - ' || _unit::text);

    PERFORM public.notify_consultor_novo_lead(v_lead_ids[v_i], v_chosen);

    lead_id := v_lead_ids[v_i]; assigned_to := v_chosen; RETURN NEXT;
  END LOOP;
END;
$$;

-- 6) Consultor confirma atendimento
CREATE OR REPLACE FUNCTION public.confirmar_atendimento(_lead_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_owner uuid; v_uid uuid := auth.uid();
BEGIN
  SELECT assigned_to INTO v_owner FROM public.leads WHERE id = _lead_id FOR UPDATE;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Lead sem responsável.'; END IF;
  IF v_owner <> v_uid AND NOT public.is_sdr_or_above() THEN
    RAISE EXCEPTION 'Só o consultor responsável ou SDR/coord pode confirmar.';
  END IF;
  UPDATE public.leads
    SET atendimento_confirmado_at = now(),
        atendimento_deadline = NULL,
        is_prioridade_emergencia = false
    WHERE id = _lead_id;
END;
$$;

-- 7) Cron: devolve leads vencidos e congela consultor
CREATE OR REPLACE FUNCTION public.check_atendimento_deadlines()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record; v_count int := 0;
BEGIN
  FOR r IN
    SELECT id, assigned_to, cidade
    FROM public.leads
    WHERE atendimento_confirmado_at IS NULL
      AND atendimento_deadline IS NOT NULL
      AND atendimento_deadline < now()
      AND assigned_to IS NOT NULL
      AND stage IN ('atendimento','nao_atendido')
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Congela consultor
    UPDATE public.profiles
      SET queue_frozen = true,
          queue_frozen_at = now(),
          queue_frozen_reason = 'Estourou prazo de 2h úteis no lead ' || r.id::text
      WHERE id = r.assigned_to;

    -- Devolve lead pra fila com emergência
    UPDATE public.leads
      SET assigned_to = NULL,
          stage = 'novo',
          is_prioridade_emergencia = true,
          atendimento_deadline = NULL
      WHERE id = r.id;

    INSERT INTO public.lead_transfers (lead_id, from_user, to_user, performed_by, reason)
    VALUES (r.id, r.assigned_to, NULL, NULL, 'AUTO: 2h úteis sem confirmação — devolvido ao SDR com emergência');

    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- 8) SDR devolve consultor à fila
CREATE OR REPLACE FUNCTION public.unfreeze_consultant(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_sdr_or_above() THEN RAISE EXCEPTION 'Acesso restrito a SDR/coordenação.'; END IF;
  UPDATE public.profiles
    SET queue_frozen = false,
        queue_frozen_at = NULL,
        queue_frozen_reason = NULL
    WHERE id = _user_id;
END;
$$;

-- 9) Cron 15 em 15 min
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-atendimento-deadlines') THEN
    PERFORM cron.unschedule('check-atendimento-deadlines');
  END IF;
  PERFORM cron.schedule(
    'check-atendimento-deadlines',
    '*/15 * * * *',
    $cron$ SELECT public.check_atendimento_deadlines(); $cron$
  );
END $$;
