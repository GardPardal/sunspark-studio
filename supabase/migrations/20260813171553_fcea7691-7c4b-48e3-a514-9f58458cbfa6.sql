CREATE OR REPLACE FUNCTION public.leads_push_to_ploomes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_unit public.unit_enum;
  v_filial bigint;
  v_captacao bigint;
  v_gasto numeric;
  v_phone text;
  v_owner bigint;
  v_payload jsonb;
BEGIN
  IF NEW.external_source = 'ploomes' OR NEW.external_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF coalesce(NEW.origem,'') ILIKE 'wpp%'
     OR coalesce(NEW.origem,'') ILIKE 'whatsapp%'
     OR coalesce(NEW.page_url,'') ILIKE '%/wpp%' THEN
    RETURN NEW;
  END IF;

  IF coalesce(NEW.estado,'') NOT IN ('PR','SP') THEN
    INSERT INTO public.integration_sync_log (source, action, status, message, payload)
    VALUES ('ploomes_form','create_lead','skipped','Estado fora da área de atuação: '||coalesce(NEW.estado,'—'), jsonb_build_object('lead_id', NEW.id, 'estado', NEW.estado));
    RETURN NEW;
  END IF;

  v_unit := public.infer_unit_from_city(NEW.cidade);
  IF v_unit IS NULL THEN
    INSERT INTO public.integration_sync_log (source, action, status, message, payload)
    VALUES ('ploomes_form','create_lead','skipped','Cidade não mapeada para unidade: '||coalesce(NEW.cidade,'—'), jsonb_build_object('lead_id', NEW.id, 'cidade', NEW.cidade));
    RETURN NEW;
  END IF;

  v_filial := public.ploomes_filial_id(v_unit);
  IF v_filial IS NULL THEN
    INSERT INTO public.integration_sync_log (source, action, status, message, payload)
    VALUES ('ploomes_form','create_lead','skipped','Filial não encontrada para unidade: '||v_unit::text, jsonb_build_object('lead_id', NEW.id, 'unit', v_unit));
    RETURN NEW;
  END IF;

  v_captacao := public.ploomes_captacao_id(NEW.utm_source, NEW.origem);

  BEGIN
    v_gasto := NULLIF(
      regexp_replace(regexp_replace(coalesce(NEW.valor_conta,'0'), '[^0-9,\.]', '', 'g'), ',', '.', 'g'),
    '')::numeric;
  EXCEPTION WHEN OTHERS THEN v_gasto := 0;
  END;
  IF v_gasto IS NULL THEN v_gasto := 0; END IF;

  v_phone := public.only_digits(NEW.telefone);
  IF length(v_phone) < 8 THEN RETURN NEW; END IF;

  BEGIN
    SELECT NULLIF(value,'')::bigint INTO v_owner
    FROM public.site_settings WHERE key = 'ploomes:default_owner_id';
  EXCEPTION WHEN OTHERS THEN v_owner := NULL;
  END;
  IF v_owner IS NULL THEN v_owner := 60029893; END IF;

  v_payload := jsonb_build_object(
    'ac23c3e37e9c411fae5bbe85b31eee72', coalesce(NEW.nome,'Lead sem nome'),
    '68faff25405a4f2298c71d05134f25af', jsonb_build_array(
        jsonb_build_object('phone', v_phone, 'mask', NULL, 'type', 1, 'invalid', false)
    ),
    '704adc1b5c694bd4b64b707aa70c128e', v_filial,
    'fb00befa20c74d3995b5ce44bd2306b8', v_captacao,
    '237479c64d5245fca6dacf5bf0513249', 609639465,
    '5262204eb35e4dc8b381d9d1f1f93ed7', v_gasto,
    '41e77eae02d34440b8a558400492ca1e',
      concat_ws(E'\n',
        NULLIF(NEW.mensagem,''),
        CASE WHEN NEW.cidade IS NOT NULL THEN 'Cidade: '||NEW.cidade||coalesce('/'||NEW.estado,'') END,
        CASE WHEN NEW.email IS NOT NULL THEN 'Email: '||NEW.email END,
        CASE WHEN NEW.utm_source IS NOT NULL THEN 'UTM: '||coalesce(NEW.utm_source,'')||'/'||coalesce(NEW.utm_medium,'')||'/'||coalesce(NEW.utm_campaign,'') END,
        CASE WHEN NEW.page_url IS NOT NULL THEN 'Página: '||NEW.page_url END,
        'Origem: '||coalesce(NEW.origem,'—')
      ),
    '300fb5e9f867471499e3fa93c0467696', v_owner
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
$function$;
