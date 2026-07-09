
-- ==== AGENDA: disponibilidade recorrente ====
CREATE TABLE public.agenda_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0=domingo..6=sábado
  start_time TIME NOT NULL,
  end_time TIME NOT NULL CHECK (end_time > start_time),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_availability TO authenticated;
GRANT ALL ON public.agenda_availability TO service_role;
ALTER TABLE public.agenda_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own availability read" ON public.agenda_availability FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_sdr_or_above());
CREATE POLICY "own availability write" ON public.agenda_availability FOR ALL TO authenticated USING (user_id = auth.uid() OR public.is_sdr_or_above()) WITH CHECK (user_id = auth.uid() OR public.is_sdr_or_above());
CREATE INDEX idx_agenda_availability_user ON public.agenda_availability(user_id, weekday);

-- ==== AGENDA: compromissos ====
CREATE TYPE public.agenda_appointment_type AS ENUM ('ligacao','visita_tecnica','reuniao','outro');
CREATE TYPE public.agenda_appointment_status AS ENUM ('agendado','concluido','cancelado');

CREATE TABLE public.agenda_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  type public.agenda_appointment_type NOT NULL DEFAULT 'ligacao',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL CHECK (ends_at > starts_at),
  notes TEXT,
  status public.agenda_appointment_status NOT NULL DEFAULT 'agendado',
  reminder_sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_appointments TO authenticated;
GRANT ALL ON public.agenda_appointments TO service_role;
ALTER TABLE public.agenda_appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own appts read" ON public.agenda_appointments FOR SELECT TO authenticated USING (consultor_id = auth.uid() OR created_by = auth.uid() OR public.is_sdr_or_above());
CREATE POLICY "own appts write" ON public.agenda_appointments FOR INSERT TO authenticated WITH CHECK (consultor_id = auth.uid() OR public.is_sdr_or_above());
CREATE POLICY "own appts update" ON public.agenda_appointments FOR UPDATE TO authenticated USING (consultor_id = auth.uid() OR public.is_sdr_or_above());
CREATE POLICY "own appts delete" ON public.agenda_appointments FOR DELETE TO authenticated USING (consultor_id = auth.uid() OR public.is_sdr_or_above());
CREATE INDEX idx_agenda_appts_consultor_starts ON public.agenda_appointments(consultor_id, starts_at);
CREATE INDEX idx_agenda_appts_lead ON public.agenda_appointments(lead_id);
CREATE INDEX idx_agenda_appts_reminder ON public.agenda_appointments(starts_at) WHERE reminder_sent_at IS NULL AND status='agendado';

CREATE OR REPLACE FUNCTION public.agenda_touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path='public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_agenda_appts_updated BEFORE UPDATE ON public.agenda_appointments FOR EACH ROW EXECUTE FUNCTION public.agenda_touch_updated_at();

-- ==== Slots livres ====
CREATE OR REPLACE FUNCTION public.get_agenda_free_slots(
  _user_id UUID, _from TIMESTAMPTZ, _to TIMESTAMPTZ, _slot_minutes INT DEFAULT 60
) RETURNS TABLE(slot_start TIMESTAMPTZ, slot_end TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='public' AS $$
DECLARE
  tz CONSTANT text := 'America/Sao_Paulo';
  d date;
  wd int;
  av record;
  slot_s timestamptz;
  slot_e timestamptz;
BEGIN
  IF _slot_minutes < 15 THEN _slot_minutes := 60; END IF;
  d := (_from AT TIME ZONE tz)::date;
  WHILE d <= (_to AT TIME ZONE tz)::date LOOP
    wd := EXTRACT(DOW FROM d)::int;
    FOR av IN
      SELECT start_time, end_time FROM public.agenda_availability
      WHERE user_id = _user_id AND weekday = wd
    LOOP
      slot_s := (d + av.start_time) AT TIME ZONE tz;
      WHILE slot_s + make_interval(mins => _slot_minutes) <= ((d + av.end_time) AT TIME ZONE tz) LOOP
        slot_e := slot_s + make_interval(mins => _slot_minutes);
        IF slot_s >= _from AND slot_e <= _to
           AND NOT EXISTS (
             SELECT 1 FROM public.agenda_appointments a
             WHERE a.consultor_id = _user_id
               AND a.status = 'agendado'
               AND a.starts_at < slot_e AND a.ends_at > slot_s
           )
        THEN
          slot_start := slot_s; slot_end := slot_e; RETURN NEXT;
        END IF;
        slot_s := slot_e;
      END LOOP;
    END LOOP;
    d := d + 1;
  END LOOP;
END; $$;

-- ==== SDR/coord marca compromisso ====
CREATE OR REPLACE FUNCTION public.book_appointment(
  _consultor_id UUID, _lead_id UUID, _title TEXT, _type public.agenda_appointment_type,
  _starts_at TIMESTAMPTZ, _ends_at TIMESTAMPTZ, _notes TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'não autenticado'; END IF;
  IF auth.uid() <> _consultor_id AND NOT public.is_sdr_or_above() THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.agenda_appointments a
    WHERE a.consultor_id = _consultor_id AND a.status = 'agendado'
      AND a.starts_at < _ends_at AND a.ends_at > _starts_at
  ) THEN RAISE EXCEPTION 'conflito com outro compromisso'; END IF;
  INSERT INTO public.agenda_appointments(consultor_id, lead_id, title, type, starts_at, ends_at, notes, created_by)
  VALUES (_consultor_id, _lead_id, _title, _type, _starts_at, _ends_at, _notes, auth.uid())
  RETURNING id INTO v_id;
  -- Enfileira email de confirmação para o consultor
  PERFORM public.notify_appointment_created(v_id);
  RETURN v_id;
END; $$;

-- ==== Notificação: novo appointment agendado ====
CREATE OR REPLACE FUNCTION public.notify_appointment_created(_appt_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE v_appt record; v_email text; v_name text; v_lead_name text;
BEGIN
  SELECT * INTO v_appt FROM public.agenda_appointments WHERE id = _appt_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT email, full_name INTO v_email, v_name FROM public.profiles WHERE id = v_appt.consultor_id;
  IF v_email IS NULL THEN RETURN; END IF;
  IF v_appt.lead_id IS NOT NULL THEN
    SELECT nome INTO v_lead_name FROM public.leads WHERE id = v_appt.lead_id;
  END IF;
  PERFORM public.enqueue_email('q_transactional_emails', jsonb_build_object(
    'to', v_email,
    'subject', '📅 Novo compromisso na sua agenda — ' || to_char(v_appt.starts_at AT TIME ZONE 'America/Sao_Paulo','DD/MM HH24:MI'),
    'template', 'agenda-compromisso',
    'data', jsonb_build_object(
      'consultor', v_name,
      'title', v_appt.title,
      'tipo', v_appt.type,
      'starts_at', v_appt.starts_at,
      'ends_at', v_appt.ends_at,
      'notes', v_appt.notes,
      'lead_nome', v_lead_name,
      'cta_url', 'https://z7energia.lovable.app/agenda'
    )
  ));
END; $$;

-- ==== Cron: lembrete 30min antes ====
CREATE OR REPLACE FUNCTION public.dispatch_agenda_reminders() RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE r record; v_email text; v_name text; v_lead_name text; v_count int := 0;
BEGIN
  FOR r IN
    SELECT * FROM public.agenda_appointments
    WHERE status = 'agendado'
      AND reminder_sent_at IS NULL
      AND starts_at BETWEEN now() + interval '28 minutes' AND now() + interval '32 minutes'
    FOR UPDATE SKIP LOCKED
  LOOP
    SELECT email, full_name INTO v_email, v_name FROM public.profiles WHERE id = r.consultor_id;
    IF v_email IS NULL THEN CONTINUE; END IF;
    v_lead_name := NULL;
    IF r.lead_id IS NOT NULL THEN SELECT nome INTO v_lead_name FROM public.leads WHERE id = r.lead_id; END IF;
    PERFORM public.enqueue_email('q_transactional_emails', jsonb_build_object(
      'to', v_email,
      'subject', '⏰ Em 30 min: ' || r.title,
      'template', 'agenda-lembrete',
      'data', jsonb_build_object(
        'consultor', v_name, 'title', r.title, 'tipo', r.type,
        'starts_at', r.starts_at, 'ends_at', r.ends_at,
        'notes', r.notes, 'lead_nome', v_lead_name,
        'cta_url', 'https://z7energia.lovable.app/agenda'
      )
    ));
    UPDATE public.agenda_appointments SET reminder_sent_at = now() WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END; $$;

-- ==== FIX: notify_consultor_novo_lead ====
CREATE OR REPLACE FUNCTION public.notify_consultor_novo_lead(_lead_id uuid, _user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_email text; v_name text; v_lead record; v_deadline timestamptz;
  v_unit public.unit_enum; v_sdr_email text;
  COORD_EMAIL constant text := 'alisonlz7@icloud.com';
BEGIN
  SELECT email, full_name INTO v_email, v_name FROM public.profiles WHERE id = _user_id;
  IF v_email IS NULL THEN RETURN; END IF;
  SELECT id, nome, telefone, cidade, estado, valor_conta, atendimento_deadline
    INTO v_lead FROM public.leads WHERE id = _lead_id;
  v_deadline := v_lead.atendimento_deadline;
  v_unit := public.infer_unit_from_city(v_lead.cidade);

  -- Consultor (template correto no registry: novo-lead-consultor)
  PERFORM public.enqueue_email('q_transactional_emails', jsonb_build_object(
    'to', v_email,
    'subject', '🔥 Novo lead LZ7 — você tem 2h úteis pra confirmar',
    'template', 'novo-lead-consultor',
    'data', jsonb_build_object(
      'consultor', v_name, 'lead_nome', v_lead.nome, 'lead_telefone', v_lead.telefone,
      'lead_cidade', v_lead.cidade, 'lead_estado', v_lead.estado,
      'lead_valor_conta', v_lead.valor_conta, 'deadline', v_deadline,
      'cta_url', 'https://z7energia.lovable.app/crm?lead=' || _lead_id::text
    )
  ));

  -- Coordenação
  BEGIN
    PERFORM public.enqueue_email('q_transactional_emails', jsonb_build_object(
      'to', COORD_EMAIL,
      'subject', '[cópia coord] Novo lead → ' || COALESCE(v_name,'consultor'),
      'template', 'novo-lead-consultor',
      'data', jsonb_build_object(
        'consultor', v_name, 'lead_nome', v_lead.nome, 'lead_telefone', v_lead.telefone,
        'lead_cidade', v_lead.cidade, 'lead_estado', v_lead.estado,
        'lead_valor_conta', v_lead.valor_conta, 'deadline', v_deadline,
        'cta_url', 'https://z7energia.lovable.app/crm?lead=' || _lead_id::text
      )
    ));
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- SDR da unidade
  BEGIN
    IF v_unit IS NOT NULL THEN
      SELECT p.email INTO v_sdr_email
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'sdr'
      WHERE p.unit = v_unit AND p.status = 'active'
      LIMIT 1;
      IF v_sdr_email IS NOT NULL AND v_sdr_email <> v_email THEN
        PERFORM public.enqueue_email('q_transactional_emails', jsonb_build_object(
          'to', v_sdr_email,
          'subject', '[cópia SDR] Novo lead atribuído → ' || COALESCE(v_name,'consultor'),
          'template', 'novo-lead-consultor',
          'data', jsonb_build_object(
            'consultor', v_name, 'lead_nome', v_lead.nome, 'lead_telefone', v_lead.telefone,
            'lead_cidade', v_lead.cidade, 'lead_estado', v_lead.estado,
            'lead_valor_conta', v_lead.valor_conta, 'deadline', v_deadline,
            'cta_url', 'https://z7energia.lovable.app/crm?lead=' || _lead_id::text
          )
        ));
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL; END;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.integration_sync_log (source, action, status, message)
  VALUES ('notify_consultor', 'novo_lead', 'error', SQLERRM);
END; $$;

-- ==== Cron a cada minuto para lembretes ====
SELECT cron.unschedule('agenda-reminders') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='agenda-reminders');
SELECT cron.schedule('agenda-reminders', '* * * * *', $cron$ SELECT public.dispatch_agenda_reminders(); $cron$);
