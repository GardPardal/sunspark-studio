
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sdr';

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS objetivo text,
  ADD COLUMN IF NOT EXISTS padrao_eletrico text,
  ADD COLUMN IF NOT EXISTS fatura_url text,
  ADD COLUMN IF NOT EXISTS tipo_encaminhamento text;

CREATE OR REPLACE FUNCTION public.is_sdr_or_above()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role::text IN ('admin','coordenador','sdr')
  );
$$;

CREATE OR REPLACE FUNCTION public.spin_roulette(_unit unit_enum, _count integer)
 RETURNS TABLE(lead_id uuid, assigned_to uuid)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_consultores uuid[]; v_lead_ids uuid[]; v_i int; v_chosen uuid;
BEGIN
  IF NOT public.is_sdr_or_above() THEN RAISE EXCEPTION 'Acesso restrito a SDR/coordenação.'; END IF;
  SELECT COALESCE(array_agg(p.id), '{}'::uuid[]) INTO v_consultores
  FROM public.profiles p JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.unit = _unit AND p.status = 'active' AND ur.role = 'consultor';
  IF array_length(v_consultores, 1) IS NULL THEN RAISE EXCEPTION 'Nenhum consultor ativo na unidade %', _unit; END IF;
  SELECT COALESCE(array_agg(id), '{}'::uuid[]) INTO v_lead_ids FROM (
    SELECT id FROM public.leads
    WHERE assigned_to IS NULL AND stage = 'novo' AND is_offline = false
      AND COALESCE(tipo_encaminhamento,'orcamento') = 'orcamento'
    ORDER BY created_at ASC LIMIT _count FOR UPDATE SKIP LOCKED
  ) t;
  IF array_length(v_lead_ids, 1) IS NULL THEN RETURN; END IF;
  FOR v_i IN 1..array_length(v_lead_ids, 1) LOOP
    v_chosen := v_consultores[1 + floor(random() * array_length(v_consultores, 1))::int];
    UPDATE public.leads SET assigned_to = v_chosen, stage = 'atendimento' WHERE id = v_lead_ids[v_i];
    INSERT INTO public.lead_transfers (lead_id, from_user, to_user, performed_by, reason)
    VALUES (v_lead_ids[v_i], NULL, v_chosen, auth.uid(), 'Roleta SDR - ' || _unit::text);
    lead_id := v_lead_ids[v_i]; assigned_to := v_chosen; RETURN NEXT;
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.spin_visita_tecnica(_unit unit_enum, _count integer)
 RETURNS TABLE(lead_id uuid, assigned_to uuid)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_consultores uuid[]; v_lead_ids uuid[]; v_i int; v_chosen uuid;
BEGIN
  IF NOT public.is_sdr_or_above() THEN RAISE EXCEPTION 'Acesso restrito a SDR/coordenação.'; END IF;
  SELECT COALESCE(array_agg(p.id), '{}'::uuid[]) INTO v_consultores
  FROM public.profiles p JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.unit = _unit AND p.status = 'active' AND ur.role = 'consultor';
  IF array_length(v_consultores, 1) IS NULL THEN RAISE EXCEPTION 'Nenhum consultor ativo na unidade %', _unit; END IF;
  SELECT COALESCE(array_agg(id), '{}'::uuid[]) INTO v_lead_ids FROM (
    SELECT id FROM public.leads
    WHERE assigned_to IS NULL AND stage = 'novo'
      AND tipo_encaminhamento = 'visita_tecnica'
    ORDER BY created_at ASC LIMIT _count FOR UPDATE SKIP LOCKED
  ) t;
  IF array_length(v_lead_ids, 1) IS NULL THEN RETURN; END IF;
  FOR v_i IN 1..array_length(v_lead_ids, 1) LOOP
    v_chosen := v_consultores[1 + floor(random() * array_length(v_consultores, 1))::int];
    UPDATE public.leads SET assigned_to = v_chosen, stage = 'atendimento' WHERE id = v_lead_ids[v_i];
    INSERT INTO public.lead_transfers (lead_id, from_user, to_user, performed_by, reason)
    VALUES (v_lead_ids[v_i], NULL, v_chosen, auth.uid(), 'Visita técnica - ' || _unit::text);
    lead_id := v_lead_ids[v_i]; assigned_to := v_chosen; RETURN NEXT;
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.reassign_lead(_lead_id uuid, _to_user uuid, _reason text DEFAULT NULL)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_from uuid;
BEGIN
  IF NOT public.is_sdr_or_above() THEN RAISE EXCEPTION 'Acesso restrito a SDR/coordenação.'; END IF;
  SELECT assigned_to INTO v_from FROM public.leads WHERE id = _lead_id FOR UPDATE;
  UPDATE public.leads SET assigned_to = _to_user WHERE id = _lead_id;
  INSERT INTO public.lead_transfers (lead_id, from_user, to_user, performed_by, reason)
  VALUES (_lead_id, v_from, _to_user, auth.uid(), COALESCE(_reason,'Reatribuição manual SDR'));
END; $$;

DROP POLICY IF EXISTS "SDR pode ver todos os leads" ON public.leads;
CREATE POLICY "SDR pode ver todos os leads" ON public.leads
  FOR SELECT TO authenticated USING (public.is_sdr_or_above());

DROP POLICY IF EXISTS "SDR pode atualizar leads" ON public.leads;
CREATE POLICY "SDR pode atualizar leads" ON public.leads
  FOR UPDATE TO authenticated
  USING (public.is_sdr_or_above()) WITH CHECK (public.is_sdr_or_above());

DROP POLICY IF EXISTS "Faturas: SDR e consultor lêem" ON storage.objects;
CREATE POLICY "Faturas: SDR e consultor lêem" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'faturas' AND (public.is_sdr_or_above() OR public.has_role(auth.uid(),'consultor')));

DROP POLICY IF EXISTS "Faturas: SDR envia" ON storage.objects;
CREATE POLICY "Faturas: SDR envia" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'faturas' AND public.is_sdr_or_above());

DROP POLICY IF EXISTS "Faturas: SDR remove" ON storage.objects;
CREATE POLICY "Faturas: SDR remove" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'faturas' AND public.is_sdr_or_above());
