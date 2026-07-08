
-- Mapa cidade -> unidade responsável
CREATE TABLE IF NOT EXISTS public.city_unit_map (
  cidade_norm text PRIMARY KEY,
  cidade_label text NOT NULL,
  unit public.unit_enum NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.city_unit_map TO authenticated;
GRANT ALL ON public.city_unit_map TO service_role;

ALTER TABLE public.city_unit_map ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "city_unit_map read auth" ON public.city_unit_map;
CREATE POLICY "city_unit_map read auth" ON public.city_unit_map FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "city_unit_map manage sdr" ON public.city_unit_map;
CREATE POLICY "city_unit_map manage sdr" ON public.city_unit_map FOR ALL TO authenticated
  USING (public.is_sdr_or_above()) WITH CHECK (public.is_sdr_or_above());

-- Normalização básica: minúsculas, sem acentos, trim
CREATE OR REPLACE FUNCTION public.norm_city(_c text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(regexp_replace(
    translate(lower(coalesce(_c,'')),
      'áàãâäéèêëíìîïóòõôöúùûüçÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇ',
      'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'),
    '[^a-z0-9 ]', '', 'g'))
$$;

CREATE OR REPLACE FUNCTION public.infer_unit_from_city(_cidade text)
RETURNS public.unit_enum LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT unit FROM public.city_unit_map WHERE cidade_norm = public.norm_city(_cidade) LIMIT 1
$$;

-- Seed inicial (norte pioneiro, campos gerais, norte pioneiro alto)
INSERT INTO public.city_unit_map (cidade_norm, cidade_label, unit) VALUES
  -- Wenceslau Braz e região (Norte Pioneiro Alto)
  ('wenceslau braz','Wenceslau Braz','wenceslau_braz'),
  ('santo antonio da platina','Santo Antônio da Platina','wenceslau_braz'),
  ('jacarezinho','Jacarezinho','wenceslau_braz'),
  ('siqueira campos','Siqueira Campos','wenceslau_braz'),
  ('tomazina','Tomazina','wenceslau_braz'),
  ('carlopolis','Carlópolis','wenceslau_braz'),
  ('ibaiti','Ibaiti','wenceslau_braz'),
  ('pinhalao','Pinhalão','wenceslau_braz'),
  ('ribeirao claro','Ribeirão Claro','wenceslau_braz'),
  ('salto do itarare','Salto do Itararé','wenceslau_braz'),
  ('sao jose da boa vista','São José da Boa Vista','wenceslau_braz'),
  ('guapirama','Guapirama','wenceslau_braz'),
  ('joaquim tavora','Joaquim Távora','wenceslau_braz'),
  ('quatigua','Quatiguá','wenceslau_braz'),
  ('conselheiro mairinck','Conselheiro Mairinck','wenceslau_braz'),
  ('japira','Japira','wenceslau_braz'),
  ('jaboti','Jaboti','wenceslau_braz'),
  ('figueira','Figueira','wenceslau_braz'),
  ('curiuva','Curiúva','wenceslau_braz'),
  -- Ponta Grossa (Campos Gerais)
  ('ponta grossa','Ponta Grossa','ponta_grossa'),
  ('castro','Castro','ponta_grossa'),
  ('carambei','Carambeí','ponta_grossa'),
  ('palmeira','Palmeira','ponta_grossa'),
  ('tibagi','Tibagi','ponta_grossa'),
  ('telemaco borba','Telêmaco Borba','ponta_grossa'),
  ('ortigueira','Ortigueira','ponta_grossa'),
  ('pirai do sul','Piraí do Sul','ponta_grossa'),
  ('jaguariaiva','Jaguariaíva','ponta_grossa'),
  ('senges','Sengés','ponta_grossa'),
  ('arapoti','Arapoti','ponta_grossa'),
  ('imbau','Imbaú','ponta_grossa'),
  ('reserva','Reserva','ponta_grossa'),
  ('ivai','Ivaí','ponta_grossa'),
  -- Londrina e região (Norte Central)
  ('londrina','Londrina','londrina'),
  ('cambe','Cambé','londrina'),
  ('ibipora','Ibiporã','londrina'),
  ('rolandia','Rolândia','londrina'),
  ('arapongas','Arapongas','londrina'),
  ('apucarana','Apucarana','londrina'),
  ('cornelio procopio','Cornélio Procópio','londrina'),
  ('bandeirantes','Bandeirantes','londrina'),
  ('sertanopolis','Sertanópolis','londrina'),
  ('tamarana','Tamarana','londrina'),
  ('jataizinho','Jataizinho','londrina'),
  ('assai','Assaí','londrina'),
  ('nova fatima','Nova Fátima','londrina'),
  ('santa mariana','Santa Mariana','londrina'),
  ('andira','Andirá','londrina'),
  ('bela vista do paraiso','Bela Vista do Paraíso','londrina'),
  ('primeiro de maio','Primeiro de Maio','londrina'),
  ('alvorada do sul','Alvorada do Sul','londrina'),
  ('sabaudia','Sabáudia','londrina')
ON CONFLICT (cidade_norm) DO NOTHING;

-- Atualiza roleta de orçamento para filtrar por cidade -> unidade
CREATE OR REPLACE FUNCTION public.spin_roulette(_unit unit_enum, _count integer)
 RETURNS TABLE(lead_id uuid, assigned_to uuid)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
      AND public.infer_unit_from_city(cidade) = _unit
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
END; $function$;

CREATE OR REPLACE FUNCTION public.spin_visita_tecnica(_unit unit_enum, _count integer)
 RETURNS TABLE(lead_id uuid, assigned_to uuid)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
      AND public.infer_unit_from_city(cidade) = _unit
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
END; $function$;
