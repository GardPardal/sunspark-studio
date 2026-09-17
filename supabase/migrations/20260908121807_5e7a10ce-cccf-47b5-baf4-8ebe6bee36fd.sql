CREATE OR REPLACE FUNCTION public.leads_dashboard(_days integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb; since timestamptz := now() - make_interval(days => GREATEST(_days,1));
BEGIN
  IF NOT public.is_sdr_or_above() THEN RAISE EXCEPTION 'sem permissão'; END IF;
  SELECT jsonb_build_object(
    'atualizado_em', now(),
    'periodo_dias', _days,
    'total', (SELECT count(*) FROM leads WHERE duplicado_de IS NULL AND created_at >= since),
    'novos', (SELECT count(*) FROM leads WHERE duplicado_de IS NULL AND created_at >= since AND qualificacao_status='novo'),
    'em_qualificacao', (SELECT count(*) FROM leads WHERE duplicado_de IS NULL AND created_at >= since AND qualificacao_status IN ('em_qualificacao','pendente')),
    'qualificados', (SELECT count(*) FROM leads WHERE duplicado_de IS NULL AND created_at >= since AND qualificacao_status='qualificado'),
    'qualificados_liz', (SELECT count(*) FROM leads WHERE duplicado_de IS NULL AND created_at >= since AND qualificacao_status='qualificado' AND qualificado_por='liz'),
    'com_pendencias', (SELECT count(*) FROM leads WHERE duplicado_de IS NULL AND created_at >= since AND cardinality(campos_pendentes) > 0 AND qualificacao_status NOT IN ('desqualificado')),
    'humano', (SELECT count(*) FROM leads WHERE duplicado_de IS NULL AND created_at >= since AND qualificacao_status='humano'),
    'desqualificados', (SELECT count(*) FROM leads WHERE duplicado_de IS NULL AND created_at >= since AND qualificacao_status='desqualificado'),
    'ploomes_sincronizados', (SELECT count(*) FROM leads WHERE duplicado_de IS NULL AND created_at >= since AND ploomes_sync_status='sincronizado'),
    'ploomes_pendentes', (SELECT count(*) FROM leads WHERE duplicado_de IS NULL AND ploomes_sync_status='pendente'),
    'ploomes_erro', (SELECT count(*) FROM leads WHERE duplicado_de IS NULL AND ploomes_sync_status IN ('erro','revisao_manual')),
    'duplicados', (SELECT count(*) FROM leads WHERE duplicado_de IS NOT NULL),
    'por_origem', (SELECT COALESCE(jsonb_agg(jsonb_build_object('k', k, 'n', n) ORDER BY n DESC), '[]') FROM (SELECT COALESCE(origem_principal, origem, 'Não informada') k, count(*) n FROM leads WHERE duplicado_de IS NULL AND created_at >= since GROUP BY 1 ORDER BY 2 DESC LIMIT 12) x),
    'por_cidade', (SELECT COALESCE(jsonb_agg(jsonb_build_object('k', k, 'n', n) ORDER BY n DESC), '[]') FROM (SELECT COALESCE(cidade, 'Não informada') k, count(*) n FROM leads WHERE duplicado_de IS NULL AND created_at >= since GROUP BY 1 ORDER BY 2 DESC LIMIT 12) x),
    'por_status', (SELECT COALESCE(jsonb_agg(jsonb_build_object('k', k, 'n', n) ORDER BY n DESC), '[]') FROM (SELECT qualificacao_status k, count(*) n FROM leads WHERE duplicado_de IS NULL AND created_at >= since GROUP BY 1) x),
    'por_etapa', (SELECT COALESCE(jsonb_agg(jsonb_build_object('k', k, 'n', n) ORDER BY n DESC), '[]') FROM (SELECT stage::text k, count(*) n FROM leads WHERE duplicado_de IS NULL AND created_at >= since GROUP BY 1) x),
    'por_responsavel', (SELECT COALESCE(jsonb_agg(jsonb_build_object('k', k, 'n', n) ORDER BY n DESC), '[]') FROM (SELECT COALESCE(p.full_name, 'Sem responsável') k, count(*) n FROM leads l LEFT JOIN profiles p ON p.id = l.assigned_to WHERE l.duplicado_de IS NULL AND l.created_at >= since GROUP BY 1 ORDER BY 2 DESC LIMIT 12) x),
    'fila', jsonb_build_object(
      'pendente', (SELECT count(*) FROM lead_sync_queue WHERE status='pendente'),
      'processando', (SELECT count(*) FROM lead_sync_queue WHERE status='processando'),
      'sincronizado', (SELECT count(*) FROM lead_sync_queue WHERE status='sincronizado'),
      'revisao_manual', (SELECT count(*) FROM lead_sync_queue WHERE status='revisao_manual'),
      'mais_antigo_pendente', (SELECT min(created_at) FROM lead_sync_queue WHERE status='pendente'),
      'ultimo_sucesso', (SELECT max(updated_at) FROM lead_sync_queue WHERE status='sincronizado'),
      'ultimo_erro', (SELECT last_error FROM lead_sync_queue WHERE last_error IS NOT NULL ORDER BY updated_at DESC LIMIT 1)
    )
  ) INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.leads_dashboard(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leads_dashboard(integer) TO authenticated, service_role;