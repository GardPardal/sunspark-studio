-- 0) Backup lógico
CREATE TABLE IF NOT EXISTS public.backup_leads_20260908 AS SELECT * FROM public.leads;
ALTER TABLE public.backup_leads_20260908 ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.backup_leads_20260908 TO service_role;

-- 1) Colunas do modelo único
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS telefone_e164 text,
  ADD COLUMN IF NOT EXISTS cpf_cnpj text,
  ADD COLUMN IF NOT EXISTS segmento text,
  ADD COLUMN IF NOT EXISTS origem_principal text,
  ADD COLUMN IF NOT EXISTS canal text,
  ADD COLUMN IF NOT EXISTS qualificado_por text,
  ADD COLUMN IF NOT EXISTS sistema_entrada text,
  ADD COLUMN IF NOT EXISTS campanha text,
  ADD COLUMN IF NOT EXISTS conjunto_anuncio text,
  ADD COLUMN IF NOT EXISTS anuncio text,
  ADD COLUMN IF NOT EXISTS meta_lead_id text,
  ADD COLUMN IF NOT EXISTS form_id text,
  ADD COLUMN IF NOT EXISTS wa_contact_id uuid,
  ADD COLUMN IF NOT EXISTS wa_conversation_id uuid,
  ADD COLUMN IF NOT EXISTS ploomes_contact_id bigint,
  ADD COLUMN IF NOT EXISTS ploomes_filial_id bigint,
  ADD COLUMN IF NOT EXISTS ploomes_captacao_id bigint,
  ADD COLUMN IF NOT EXISTS ploomes_produto_id bigint,
  ADD COLUMN IF NOT EXISTS ploomes_owner_id bigint,
  ADD COLUMN IF NOT EXISTS qualificacao_status text NOT NULL DEFAULT 'novo',
  ADD COLUMN IF NOT EXISTS qualificacao_motivo text,
  ADD COLUMN IF NOT EXISTS campos_pendentes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS etiquetas text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS qualificado_em timestamptz,
  ADD COLUMN IF NOT EXISTS ploomes_sync_status text NOT NULL DEFAULT 'nao_aplicavel',
  ADD COLUMN IF NOT EXISTS ploomes_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS ploomes_sync_error text,
  ADD COLUMN IF NOT EXISTS ploomes_sync_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duplicado_de uuid,
  ADD COLUMN IF NOT EXISTS valor_conta_num numeric;

ALTER TABLE public.wa_conversations ADD COLUMN IF NOT EXISTS lead_id uuid;

-- 2) Funções utilitárias
CREATE OR REPLACE FUNCTION public.norm_phone_e164(_raw text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE d text; ddd text; rest text;
BEGIN
  IF _raw IS NULL THEN RETURN NULL; END IF;
  d := regexp_replace(_raw, '\D', '', 'g');
  IF d = '' THEN RETURN NULL; END IF;
  d := regexp_replace(d, '^0+', '');
  IF length(d) IN (10,11) THEN d := '55' || d; END IF;
  IF left(d,2) <> '55' OR length(d) NOT IN (12,13) THEN
    RETURN CASE WHEN length(d) BETWEEN 8 AND 15 THEN '+' || d ELSE NULL END;
  END IF;
  ddd := substr(d,3,2); rest := substr(d,5);
  IF length(rest) = 8 AND left(rest,1) IN ('6','7','8','9') THEN rest := '9' || rest; END IF;
  RETURN '+55' || ddd || rest;
END $$;

CREATE OR REPLACE FUNCTION public.lead_name_is_generic(_n text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT _n IS NULL OR btrim(_n) = '' OR lower(btrim(_n)) IN
    ('cliente','cliente whatsapp','lead whatsapp','whatsapp','lead','não informado','nao informado','sem nome','contato','usuário','usuario')
    OR btrim(_n) ~ '^\+?\d[\d\s\-\(\)]{6,}$';
$$;

CREATE OR REPLACE FUNCTION public.parse_money_br(_v text)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE s text;
BEGIN
  IF _v IS NULL THEN RETURN NULL; END IF;
  s := regexp_replace(_v, '[^0-9,\.]', '', 'g');
  IF s = '' THEN RETURN NULL; END IF;
  IF s ~ ',\d{1,2}$' THEN s := replace(replace(s,'.',''),',','.');
  ELSE s := replace(s, ',', ''); END IF;
  BEGIN RETURN s::numeric; EXCEPTION WHEN OTHERS THEN RETURN NULL; END;
END $$;

CREATE OR REPLACE FUNCTION public.norm_padrao_eletrico(_v text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _v IS NULL THEN NULL
    WHEN lower(_v) ~ 'trif' THEN 'trifasico'
    WHEN lower(_v) ~ 'bif' THEN 'bifasico'
    WHEN lower(_v) ~ 'monof' THEN 'monofasico'
    ELSE NULL END;
$$;

-- 3) Trigger BEFORE: normalização (nunca inventa; só padroniza)
CREATE OR REPLACE FUNCTION public.leads_normalize_before()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.telefone_e164 := public.norm_phone_e164(NEW.telefone);
  NEW.valor_conta_num := COALESCE(NEW.valor_conta_num, public.parse_money_br(NEW.valor_conta));
  NEW.padrao_eletrico := public.norm_padrao_eletrico(NEW.padrao_eletrico);
  IF NEW.cpf_cnpj IS NOT NULL THEN NEW.cpf_cnpj := NULLIF(regexp_replace(NEW.cpf_cnpj,'\D','','g'),''); END IF;
  IF NEW.email IS NOT NULL THEN NEW.email := NULLIF(lower(btrim(NEW.email)),''); END IF;
  IF NEW.origem_principal IS NULL THEN NEW.origem_principal := NEW.origem; END IF;
  IF NEW.external_source = 'ploomes' THEN
    IF NEW.ploomes_contact_id IS NULL AND NEW.external_id ~ '^\d+$' THEN NEW.ploomes_contact_id := NEW.external_id::bigint; END IF;
    IF TG_OP = 'INSERT' THEN NEW.ploomes_sync_status := 'sincronizado'; NEW.ploomes_synced_at := COALESCE(NEW.ploomes_synced_at, now()); END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_leads_normalize_before ON public.leads;
CREATE TRIGGER trg_leads_normalize_before BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.leads_normalize_before();

-- Backfill
UPDATE public.leads SET telefone_e164 = public.norm_phone_e164(telefone) WHERE telefone_e164 IS NULL;
UPDATE public.leads SET valor_conta_num = public.parse_money_br(valor_conta) WHERE valor_conta_num IS NULL AND valor_conta IS NOT NULL;
UPDATE public.leads SET ploomes_contact_id = external_id::bigint WHERE external_source='ploomes' AND external_id ~ '^\d+$' AND ploomes_contact_id IS NULL;
UPDATE public.leads SET ploomes_sync_status='sincronizado', ploomes_synced_at = COALESCE(last_synced_at, created_at) WHERE (external_source='ploomes' OR ploomes_deal_id IS NOT NULL) AND ploomes_sync_status='nao_aplicavel';
UPDATE public.leads SET origem_principal = origem WHERE origem_principal IS NULL;
UPDATE public.leads SET padrao_eletrico = public.norm_padrao_eletrico(padrao_eletrico) WHERE padrao_eletrico IS NOT NULL;

CREATE INDEX IF NOT EXISTS leads_telefone_e164_idx ON public.leads (telefone_e164) WHERE duplicado_de IS NULL;
CREATE INDEX IF NOT EXISTS leads_qualificacao_status_idx ON public.leads (qualificacao_status);
CREATE INDEX IF NOT EXISTS leads_ploomes_sync_status_idx ON public.leads (ploomes_sync_status);
CREATE INDEX IF NOT EXISTS leads_wa_contact_idx ON public.leads (wa_contact_id);

-- 4) Fila de sincronização
CREATE TABLE IF NOT EXISTS public.lead_sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  action text NOT NULL DEFAULT 'ploomes_upsert',
  status text NOT NULL DEFAULT 'pendente',
  reason text,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 6,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  last_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lead_sync_queue TO authenticated;
GRANT ALL ON public.lead_sync_queue TO service_role;
ALTER TABLE public.lead_sync_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lsq_select_team" ON public.lead_sync_queue;
CREATE POLICY "lsq_select_team" ON public.lead_sync_queue FOR SELECT TO authenticated USING (public.is_sdr_or_above());
CREATE UNIQUE INDEX IF NOT EXISTS lead_sync_queue_open_uniq ON public.lead_sync_queue (lead_id, action) WHERE status IN ('pendente','processando');
CREATE INDEX IF NOT EXISTS lead_sync_queue_due_idx ON public.lead_sync_queue (status, next_attempt_at);
DROP TRIGGER IF EXISTS trg_lsq_touch ON public.lead_sync_queue;
CREATE TRIGGER trg_lsq_touch BEFORE UPDATE ON public.lead_sync_queue FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Trilha de eventos
CREATE TABLE IF NOT EXISTS public.lead_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  phone_masked text,
  event text NOT NULL,
  source text,
  step text,
  result text,
  external_ids jsonb NOT NULL DEFAULT '{}'::jsonb,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lead_events TO authenticated;
GRANT ALL ON public.lead_events TO service_role;
ALTER TABLE public.lead_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lev_select_team" ON public.lead_events;
CREATE POLICY "lev_select_team" ON public.lead_events FOR SELECT TO authenticated USING (public.is_sdr_or_above());
CREATE INDEX IF NOT EXISTS lead_events_lead_idx ON public.lead_events (lead_id, created_at DESC);

-- 6) Enfileirar / reservar
CREATE OR REPLACE FUNCTION public.lead_enqueue_sync(_lead_id uuid, _reason text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.lead_sync_queue (lead_id, action, status, reason, next_attempt_at)
  VALUES (_lead_id, 'ploomes_upsert', 'pendente', _reason, now())
  ON CONFLICT (lead_id, action) WHERE status IN ('pendente','processando') DO NOTHING
  RETURNING id INTO v_id;
  UPDATE public.leads SET ploomes_sync_status = 'pendente', ploomes_sync_error = NULL
   WHERE id = _lead_id AND ploomes_sync_status IN ('nao_aplicavel','erro','revisao_manual','pendente');
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.lead_sync_claim(_limit integer DEFAULT 10, _worker text DEFAULT 'worker')
RETURNS SETOF public.lead_sync_queue LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.lead_sync_queue SET status='pendente', locked_at=NULL, locked_by=NULL, last_error='trava expirada'
   WHERE status='processando' AND locked_at < now() - interval '10 minutes';
  RETURN QUERY
  UPDATE public.lead_sync_queue q SET status='processando', locked_at=now(), locked_by=_worker, attempts=attempts+1
   WHERE q.id IN (SELECT id FROM public.lead_sync_queue WHERE status='pendente' AND next_attempt_at <= now()
                  ORDER BY created_at LIMIT _limit FOR UPDATE SKIP LOCKED)
  RETURNING q.*;
END $$;

-- 7) Upsert atômico por telefone (dedupe + nunca sobrescreve com vazio)
CREATE OR REPLACE FUNCTION public.lead_upsert_by_phone(_p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_phone text; v_email text; v_doc text; v_lead public.leads; v_created boolean := false; v_nome text; v_wac uuid; v_wcv uuid;
BEGIN
  v_phone := public.norm_phone_e164(_p->>'telefone');
  IF v_phone IS NULL THEN RAISE EXCEPTION 'telefone inválido'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('lead:' || v_phone));
  v_email := NULLIF(lower(btrim(COALESCE(_p->>'email',''))),'');
  v_doc := NULLIF(regexp_replace(COALESCE(_p->>'cpf_cnpj',''),'\D','','g'),'');
  v_nome := NULLIF(btrim(COALESCE(_p->>'nome','')),'');
  v_wac := NULLIF(_p->>'wa_contact_id','')::uuid;
  v_wcv := NULLIF(_p->>'wa_conversation_id','')::uuid;

  SELECT * INTO v_lead FROM public.leads
   WHERE duplicado_de IS NULL AND (
     telefone_e164 = v_phone
     OR (v_doc IS NOT NULL AND cpf_cnpj = v_doc)
     OR (v_email IS NOT NULL AND email = v_email)
     OR (v_wac IS NOT NULL AND wa_contact_id = v_wac))
   ORDER BY (telefone_e164 = v_phone) DESC, (ploomes_deal_id IS NOT NULL) DESC, created_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.leads (
      nome, telefone, email, cidade, estado, valor_conta, cpf_cnpj, padrao_eletrico, segmento,
      origem, origem_principal, canal, qualificado_por, sistema_entrada, campanha, conjunto_anuncio, anuncio,
      meta_lead_id, form_id, wa_contact_id, wa_conversation_id,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content, fbclid, fbp, fbc, page_url, referrer, user_agent,
      mensagem, produto_interesse, fatura_url, captacao_metodo, external_source, external_id, created_by,
      ploomes_filial_id, ploomes_captacao_id, ploomes_produto_id, ploomes_owner_id, stage, ploomes_sync_status)
    VALUES (
      COALESCE(v_nome, 'Não informado'), COALESCE(NULLIF(_p->>'telefone',''), v_phone), v_email,
      NULLIF(btrim(COALESCE(_p->>'cidade','')),''), NULLIF(upper(btrim(COALESCE(_p->>'estado',''))),''),
      NULLIF(btrim(COALESCE(_p->>'valor_conta','')),''), v_doc, _p->>'padrao_eletrico', NULLIF(_p->>'segmento',''),
      COALESCE(NULLIF(_p->>'origem',''), NULLIF(_p->>'origem_principal','')), COALESCE(NULLIF(_p->>'origem_principal',''), NULLIF(_p->>'origem','')),
      NULLIF(_p->>'canal',''), NULLIF(_p->>'qualificado_por',''), NULLIF(_p->>'sistema_entrada',''),
      NULLIF(_p->>'campanha',''), NULLIF(_p->>'conjunto_anuncio',''), NULLIF(_p->>'anuncio',''),
      NULLIF(_p->>'meta_lead_id',''), NULLIF(_p->>'form_id',''), v_wac, v_wcv,
      NULLIF(_p->>'utm_source',''), NULLIF(_p->>'utm_medium',''), NULLIF(_p->>'utm_campaign',''), NULLIF(_p->>'utm_term',''), NULLIF(_p->>'utm_content',''),
      NULLIF(_p->>'fbclid',''), NULLIF(_p->>'fbp',''), NULLIF(_p->>'fbc',''), NULLIF(_p->>'page_url',''), NULLIF(_p->>'referrer',''), NULLIF(_p->>'user_agent',''),
      NULLIF(_p->>'mensagem',''), NULLIF(_p->>'produto_interesse',''), NULLIF(_p->>'fatura_url',''), NULLIF(_p->>'captacao_metodo',''),
      NULLIF(_p->>'external_source',''), NULLIF(_p->>'external_id',''), NULLIF(_p->>'created_by','')::uuid,
      NULLIF(_p->>'ploomes_filial_id','')::bigint, NULLIF(_p->>'ploomes_captacao_id','')::bigint, NULLIF(_p->>'ploomes_produto_id','')::bigint, NULLIF(_p->>'ploomes_owner_id','')::bigint,
      'novo', 'nao_aplicavel')
    RETURNING * INTO v_lead;
    v_created := true;
  ELSE
    UPDATE public.leads SET
      nome = CASE WHEN public.lead_name_is_generic(nome) AND NOT public.lead_name_is_generic(v_nome) THEN v_nome ELSE nome END,
      email = COALESCE(email, v_email),
      cidade = COALESCE(cidade, NULLIF(btrim(COALESCE(_p->>'cidade','')),'')),
      estado = COALESCE(estado, NULLIF(upper(btrim(COALESCE(_p->>'estado',''))),'')),
      valor_conta = COALESCE(valor_conta, NULLIF(btrim(COALESCE(_p->>'valor_conta','')),'')),
      valor_conta_num = COALESCE(valor_conta_num, public.parse_money_br(_p->>'valor_conta')),
      cpf_cnpj = COALESCE(cpf_cnpj, v_doc),
      padrao_eletrico = COALESCE(padrao_eletrico, _p->>'padrao_eletrico'),
      segmento = COALESCE(segmento, NULLIF(_p->>'segmento','')),
      origem = COALESCE(origem, NULLIF(_p->>'origem','')),
      origem_principal = COALESCE(origem_principal, NULLIF(_p->>'origem_principal',''), NULLIF(_p->>'origem','')),
      canal = COALESCE(canal, NULLIF(_p->>'canal','')),
      qualificado_por = COALESCE(NULLIF(_p->>'qualificado_por',''), qualificado_por),
      sistema_entrada = COALESCE(sistema_entrada, NULLIF(_p->>'sistema_entrada','')),
      campanha = COALESCE(campanha, NULLIF(_p->>'campanha','')),
      conjunto_anuncio = COALESCE(conjunto_anuncio, NULLIF(_p->>'conjunto_anuncio','')),
      anuncio = COALESCE(anuncio, NULLIF(_p->>'anuncio','')),
      meta_lead_id = COALESCE(meta_lead_id, NULLIF(_p->>'meta_lead_id','')),
      form_id = COALESCE(form_id, NULLIF(_p->>'form_id','')),
      wa_contact_id = COALESCE(wa_contact_id, v_wac),
      wa_conversation_id = COALESCE(v_wcv, wa_conversation_id),
      utm_source = COALESCE(utm_source, NULLIF(_p->>'utm_source','')),
      utm_medium = COALESCE(utm_medium, NULLIF(_p->>'utm_medium','')),
      utm_campaign = COALESCE(utm_campaign, NULLIF(_p->>'utm_campaign','')),
      utm_term = COALESCE(utm_term, NULLIF(_p->>'utm_term','')),
      utm_content = COALESCE(utm_content, NULLIF(_p->>'utm_content','')),
      fbclid = COALESCE(fbclid, NULLIF(_p->>'fbclid','')),
      fbp = COALESCE(fbp, NULLIF(_p->>'fbp','')),
      fbc = COALESCE(fbc, NULLIF(_p->>'fbc','')),
      page_url = COALESCE(page_url, NULLIF(_p->>'page_url','')),
      mensagem = COALESCE(mensagem, NULLIF(_p->>'mensagem','')),
      produto_interesse = COALESCE(produto_interesse, NULLIF(_p->>'produto_interesse','')),
      fatura_url = COALESCE(fatura_url, NULLIF(_p->>'fatura_url','')),
      captacao_metodo = COALESCE(captacao_metodo, NULLIF(_p->>'captacao_metodo','')),
      ploomes_filial_id = COALESCE(ploomes_filial_id, NULLIF(_p->>'ploomes_filial_id','')::bigint),
      ploomes_captacao_id = COALESCE(ploomes_captacao_id, NULLIF(_p->>'ploomes_captacao_id','')::bigint),
      ploomes_produto_id = COALESCE(ploomes_produto_id, NULLIF(_p->>'ploomes_produto_id','')::bigint),
      ploomes_owner_id = COALESCE(ploomes_owner_id, NULLIF(_p->>'ploomes_owner_id','')::bigint),
      updated_at = now()
    WHERE id = v_lead.id
    RETURNING * INTO v_lead;
  END IF;

  IF v_wac IS NOT NULL THEN UPDATE public.wa_contacts SET lead_id = v_lead.id WHERE id = v_wac AND lead_id IS DISTINCT FROM v_lead.id; END IF;
  IF v_wcv IS NOT NULL THEN UPDATE public.wa_conversations SET lead_id = v_lead.id WHERE id = v_wcv AND lead_id IS DISTINCT FROM v_lead.id; END IF;

  RETURN jsonb_build_object('id', v_lead.id, 'created', v_created, 'lead', to_jsonb(v_lead));
END $$;
REVOKE ALL ON FUNCTION public.lead_upsert_by_phone(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lead_sync_claim(integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lead_enqueue_sync(uuid, text) FROM PUBLIC, anon;

-- 8) Caminho único para o Ploomes: desativa o envio direto pelo banco e enfileira
ALTER TABLE public.leads DISABLE TRIGGER trg_leads_push_ploomes;

CREATE OR REPLACE FUNCTION public.leads_enqueue_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.external_source = 'ploomes' OR NEW.external_id IS NOT NULL OR NEW.ploomes_deal_id IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.sistema_entrada = 'zapi' OR NEW.qualificado_por = 'liz' THEN RETURN NEW; END IF; -- decidido pelo motor de qualificação
  IF COALESCE(NEW.origem,'') ILIKE 'wpp%' OR COALESCE(NEW.origem,'') ILIKE 'whatsapp%' OR COALESCE(NEW.page_url,'') ILIKE '%/wpp%' THEN RETURN NEW; END IF;
  IF NEW.duplicado_de IS NOT NULL THEN RETURN NEW; END IF;
  IF COALESCE(NEW.estado,'') <> '' AND upper(NEW.estado) NOT IN ('PR','SP') THEN
    INSERT INTO public.lead_events (lead_id, phone_masked, event, source, step, result, detail)
    VALUES (NEW.id, regexp_replace(COALESCE(NEW.telefone_e164,''), '\d(?=\d{4})', '*', 'g'), 'sync.skipped', COALESCE(NEW.origem_principal, NEW.origem), 'fila', 'fora da área de atuação', jsonb_build_object('estado', NEW.estado));
    RETURN NEW;
  END IF;
  PERFORM public.lead_enqueue_sync(NEW.id, 'novo lead: ' || COALESCE(NEW.origem_principal, NEW.origem, 'origem não informada'));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_leads_enqueue_after_insert ON public.leads;
CREATE TRIGGER trg_leads_enqueue_after_insert AFTER INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.leads_enqueue_after_insert();

-- 9) Regras editáveis
INSERT INTO public.site_settings (key, value) VALUES ('leads:min_fatura', '200') ON CONFLICT (key) DO NOTHING;
INSERT INTO public.site_settings (key, value) VALUES ('ploomes:default_owner_id', '60022664') ON CONFLICT (key) DO NOTHING;
INSERT INTO public.site_settings (key, value) VALUES ('leads:exigir_fatura', 'false') ON CONFLICT (key) DO NOTHING;

-- 10) Realtime
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.leads; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_sync_queue; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_events; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;