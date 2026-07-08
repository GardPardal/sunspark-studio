
-- Auto-cadastro do lead no formulário público do Ploomes
-- Endpoint: https://public-forms-api.ploomes.com/fc069cda7a6243dfa9359a00e40b29ba/form

-- Mapeamento unidade -> IntegerValue da opção "Origem do Lead" (filial no Ploomes)
CREATE OR REPLACE FUNCTION public.ploomes_filial_id(_unit public.unit_enum)
RETURNS bigint LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _unit
    WHEN 'wenceslau_braz' THEN 600965621
    WHEN 'ponta_grossa'   THEN 609092593
    WHEN 'londrina'       THEN 600965622
  END
$$;

-- Mapeamento de captação (utm/origem) -> IntegerValue
CREATE OR REPLACE FUNCTION public.ploomes_captacao_id(_utm_source text, _origem text)
RETURNS bigint LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN lower(coalesce(_utm_source,'')) IN ('facebook','instagram','meta','google','tiktok','ads','fb','ig')
      OR lower(coalesce(_origem,''))   ~ 'trafego|traffic|ads|meta|google|face|insta' THEN 600965618
    WHEN lower(coalesce(_origem,'')) ~ 'indica' THEN 600965617
    WHEN lower(coalesce(_origem,'')) ~ 'ligac|ativa' THEN 609758031
    WHEN lower(coalesce(_origem,'')) ~ 'feira' THEN 600965620
    ELSE 600965618  -- default tráfego pago
  END
$$;

-- Só dígitos do telefone
CREATE OR REPLACE FUNCTION public.only_digits(_s text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(coalesce(_s,''), '\D', '', 'g')
$$;

-- Trigger AFTER INSERT que dispara o POST para o Ploomes via pg_net
CREATE OR REPLACE FUNCTION public.leads_push_to_ploomes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_unit public.unit_enum;
  v_filial bigint;
  v_captacao bigint;
  v_gasto numeric;
  v_phone text;
  v_payload jsonb;
BEGIN
  -- Não reenviar se já veio do próprio Ploomes
  IF NEW.external_source = 'ploomes' OR NEW.external_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_unit := public.infer_unit_from_city(NEW.cidade);
  v_filial := public.ploomes_filial_id(v_unit);
  -- Se não deu para inferir filial pela cidade, usa Wenceslau (sede) como fallback
  IF v_filial IS NULL THEN v_filial := 600965621; END IF;

  v_captacao := public.ploomes_captacao_id(NEW.utm_source, NEW.origem);

  -- Valor da conta: extrai número (aceita "R$ 450,00", "450", "450.50")
  BEGIN
    v_gasto := NULLIF(
      regexp_replace(regexp_replace(coalesce(NEW.valor_conta,'0'), '[^0-9,\.]', '', 'g'), ',', '.', 'g'),
    '')::numeric;
  EXCEPTION WHEN OTHERS THEN v_gasto := 0;
  END;
  IF v_gasto IS NULL THEN v_gasto := 0; END IF;

  v_phone := public.only_digits(NEW.telefone);
  IF length(v_phone) < 8 THEN RETURN NEW; END IF;

  v_payload := jsonb_build_object(
    -- Nome (contact_name)
    'ac23c3e37e9c411fae5bbe85b31eee72', coalesce(NEW.nome,'Lead sem nome'),
    -- Telefone (contact_phones)
    '68faff25405a4f2298c71d05134f25af', jsonb_build_array(
        jsonb_build_object('phone', v_phone, 'mask', NULL, 'type', 1, 'invalid', false)
    ),
    -- Origem do Lead (Filial)
    '704adc1b5c694bd4b64b707aa70c128e', v_filial,
    -- Como feita a captação
    'fb00befa20c74d3995b5ce44bd2306b8', v_captacao,
    -- Produto de interesse (On-grid default)
    '237479c64d5245fca6dacf5bf0513249', 609639465,
    -- Gasto médio de energia
    '5262204eb35e4dc8b381d9d1f1f93ed7', v_gasto,
    -- Observação do Lead
    '41e77eae02d34440b8a558400492ca1e',
      concat_ws(E'\n',
        NULLIF(NEW.mensagem,''),
        CASE WHEN NEW.cidade IS NOT NULL THEN 'Cidade: '||NEW.cidade||coalesce('/'||NEW.estado,'') END,
        CASE WHEN NEW.email IS NOT NULL THEN 'Email: '||NEW.email END,
        CASE WHEN NEW.utm_source IS NOT NULL THEN 'UTM: '||coalesce(NEW.utm_source,'')||'/'||coalesce(NEW.utm_medium,'')||'/'||coalesce(NEW.utm_campaign,'') END,
        CASE WHEN NEW.page_url IS NOT NULL THEN 'Página: '||NEW.page_url END,
        'Origem: '||coalesce(NEW.origem,'—')
      ),
    -- Responsável (Stephany Martins - SDR) — a SDR distribui depois
    '300fb5e9f867471499e3fa93c0467696', 60022664
  );

  BEGIN
    PERFORM net.http_post(
      url := 'https://public-forms-api.ploomes.com/fc069cda7a6243dfa9359a00e40b29ba/form',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'Accept','application/json, text/plain, */*',
        'Origin','https://forms.ploomes.com',
        'Referer','https://forms.ploomes.com/'
      ),
      body := v_payload
    );
    INSERT INTO public.integration_sync_log (source, action, status, message, payload)
    VALUES ('ploomes_form','create_lead','sent','POST enviado', v_payload);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.integration_sync_log (source, action, status, message, payload)
    VALUES ('ploomes_form','create_lead','error', SQLERRM, v_payload);
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_push_ploomes ON public.leads;
CREATE TRIGGER trg_leads_push_ploomes
AFTER INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.leads_push_to_ploomes();
