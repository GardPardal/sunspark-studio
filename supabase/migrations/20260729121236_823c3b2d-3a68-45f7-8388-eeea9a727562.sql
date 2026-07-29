-- =========================================================
-- SOLAR OS v2 — Fundação de dados (Sprints 3, 4, 6, 7, 8, 9)
-- =========================================================

-- ---------- 1. TIMELINE UNIVERSAL ----------
CREATE TABLE IF NOT EXISTS public.timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  ts timestamptz NOT NULL DEFAULT now(),
  actor_id uuid,
  actor_name text,
  kind text NOT NULL,
  source text NOT NULL DEFAULT 'system',
  title text NOT NULL,
  summary text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS timeline_events_entity_idx
  ON public.timeline_events (entity_type, entity_id, ts DESC);
CREATE INDEX IF NOT EXISTS timeline_events_actor_idx
  ON public.timeline_events (actor_id, ts DESC);
CREATE INDEX IF NOT EXISTS timeline_events_kind_idx
  ON public.timeline_events (kind, ts DESC);

GRANT SELECT, INSERT ON public.timeline_events TO authenticated;
GRANT ALL ON public.timeline_events TO service_role;
ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timeline_events_read_authenticated"
  ON public.timeline_events FOR SELECT TO authenticated USING (true);

CREATE POLICY "timeline_events_insert_authenticated"
  ON public.timeline_events FOR INSERT TO authenticated
  WITH CHECK (
    actor_id IS NULL
    OR actor_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'coordenador'::app_role)
  );

CREATE OR REPLACE FUNCTION public.record_event(
  _entity_type text,
  _entity_id text,
  _kind text,
  _title text,
  _summary text DEFAULT NULL,
  _source text DEFAULT 'system',
  _payload jsonb DEFAULT '{}'::jsonb,
  _actor_id uuid DEFAULT NULL,
  _actor_name text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _actor uuid;
BEGIN
  _actor := COALESCE(_actor_id, auth.uid());
  INSERT INTO public.timeline_events (entity_type, entity_id, kind, title, summary, source, payload, actor_id, actor_name)
  VALUES (_entity_type, _entity_id, _kind, _title, _summary, _source, COALESCE(_payload, '{}'::jsonb), _actor, _actor_name)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_event(text, text, text, text, text, text, jsonb, uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tg_lead_stage_to_timeline()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.stage IS DISTINCT FROM OLD.stage) THEN
    PERFORM public.record_event(
      'lead', NEW.id::text, 'stage_change',
      'Etapa: ' || COALESCE(OLD.stage::text,'—') || ' → ' || COALESCE(NEW.stage::text,'—'),
      NULL, 'system',
      jsonb_build_object('from', OLD.stage, 'to', NEW.stage),
      auth.uid(), NULL
    );
  ELSIF (TG_OP = 'INSERT') THEN
    PERFORM public.record_event(
      'lead', NEW.id::text, 'form_submit',
      'Lead criado: ' || COALESCE(NEW.nome, 'sem nome'),
      COALESCE(NEW.cidade, '') || CASE WHEN NEW.origem IS NOT NULL THEN ' · ' || NEW.origem ELSE '' END,
      COALESCE(NEW.external_source, 'manual'),
      jsonb_build_object('cidade', NEW.cidade, 'origem', NEW.origem, 'utm_campaign', NEW.utm_campaign),
      auth.uid(), NULL
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_leads_timeline ON public.leads;
CREATE TRIGGER trg_leads_timeline
  AFTER INSERT OR UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.tg_lead_stage_to_timeline();

CREATE OR REPLACE FUNCTION public.tg_appt_to_timeline()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.lead_id IS NOT NULL THEN
    PERFORM public.record_event(
      'lead', NEW.lead_id::text, 'meeting',
      COALESCE(NEW.title, 'Agendamento'),
      'Tipo: ' || NEW.type::text || ' · ' || to_char(NEW.starts_at, 'DD/MM HH24:MI'),
      'manual',
      jsonb_build_object('type', NEW.type, 'status', NEW.status, 'starts_at', NEW.starts_at, 'appointment_id', NEW.id),
      NEW.consultor_id, NULL
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_appt_timeline ON public.agenda_appointments;
CREATE TRIGGER trg_appt_timeline
  AFTER INSERT ON public.agenda_appointments
  FOR EACH ROW EXECUTE FUNCTION public.tg_appt_to_timeline();

-- ---------- 2. GLOBAL SEARCH ----------
CREATE OR REPLACE VIEW public.search_index AS
  SELECT
    'lead'::text AS entity_type,
    l.id::text AS entity_id,
    l.nome AS title,
    COALESCE(l.cidade, '') || CASE WHEN l.telefone IS NOT NULL THEN ' · ' || l.telefone ELSE '' END AS subtitle,
    l.stage::text AS badge,
    l.updated_at AS ts,
    setweight(to_tsvector('portuguese', public.unaccent(coalesce(l.nome,''))), 'A')
      || setweight(to_tsvector('simple', coalesce(l.telefone,'')), 'B')
      || setweight(to_tsvector('portuguese', public.unaccent(coalesce(l.cidade,''))), 'C')
      || setweight(to_tsvector('simple', coalesce(l.email,'')), 'B') AS document
  FROM public.leads l
  UNION ALL
  SELECT
    'sale', ms.id::text, COALESCE(ss.name, 'Venda'),
    'R$ ' || ms.amount::text || COALESCE(' · ' || ms.city, ''),
    'venda', ms.updated_at,
    setweight(to_tsvector('portuguese', public.unaccent(coalesce(ss.name,''))), 'A')
      || setweight(to_tsvector('portuguese', public.unaccent(coalesce(ms.city,''))), 'B')
  FROM public.manual_sales ms
  LEFT JOIN public.sales_sellers ss ON ss.id = ms.seller_id
  UNION ALL
  SELECT
    'user', p.id::text, COALESCE(p.full_name, p.email, '—'),
    COALESCE(p.email, '') || COALESCE(' · ' || p.unit::text, ''),
    p.status::text, p.updated_at,
    setweight(to_tsvector('portuguese', public.unaccent(coalesce(p.full_name,''))), 'A')
      || setweight(to_tsvector('simple', coalesce(p.email,'')), 'B')
  FROM public.profiles p
  UNION ALL
  SELECT
    'campaign', c.id, c.name,
    COALESCE(c.objective, '') || COALESCE(' · ' || c.effective_status, ''),
    c.effective_status, c.synced_at,
    setweight(to_tsvector('portuguese', public.unaccent(coalesce(c.name,''))), 'A')
      || setweight(to_tsvector('simple', coalesce(c.objective,'')), 'C')
  FROM public.meta_campaigns c
  UNION ALL
  SELECT
    'creative', cr.id, COALESCE(cr.name, cr.title, 'Criativo'),
    COALESCE(cr.body, ''), NULL, cr.synced_at,
    setweight(to_tsvector('portuguese', public.unaccent(coalesce(cr.name,''))), 'A')
      || setweight(to_tsvector('portuguese', public.unaccent(coalesce(cr.title,''))), 'B')
      || setweight(to_tsvector('portuguese', public.unaccent(coalesce(cr.body,''))), 'C')
  FROM public.meta_creatives cr
  UNION ALL
  SELECT
    'appointment', a.id::text, a.title,
    to_char(a.starts_at, 'DD/MM HH24:MI') || ' · ' || a.type::text,
    a.status::text, a.updated_at,
    setweight(to_tsvector('portuguese', public.unaccent(coalesce(a.title,''))), 'A')
      || setweight(to_tsvector('portuguese', public.unaccent(coalesce(a.notes,''))), 'C')
  FROM public.agenda_appointments a;

CREATE OR REPLACE FUNCTION public.global_search(_q text, _limit int DEFAULT 20)
RETURNS TABLE(entity_type text, entity_id text, title text, subtitle text, badge text, ts timestamptz, rank real)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _query tsquery;
  _plain text;
BEGIN
  _plain := trim(coalesce(_q, ''));
  IF length(_plain) = 0 THEN
    RETURN;
  END IF;
  _query := websearch_to_tsquery('portuguese', public.unaccent(_plain));
  RETURN QUERY
  SELECT s.entity_type, s.entity_id, s.title, s.subtitle, s.badge, s.ts,
         ts_rank(s.document, _query) AS rank
  FROM public.search_index s
  WHERE s.document @@ _query
     OR s.title ILIKE '%' || _plain || '%'
  ORDER BY rank DESC NULLS LAST, s.ts DESC NULLS LAST
  LIMIT LEAST(GREATEST(_limit, 1), 50);
END $$;

GRANT EXECUTE ON FUNCTION public.global_search(text, int) TO authenticated;

-- ---------- 3. SYSTEM HEALTH ----------
CREATE TABLE IF NOT EXISTS public.system_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'unknown',
  message text,
  latency_ms int,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.system_health TO authenticated;
GRANT ALL ON public.system_health TO service_role;
ALTER TABLE public.system_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_health_read_authenticated"
  ON public.system_health FOR SELECT TO authenticated USING (true);
CREATE POLICY "system_health_admin_write"
  ON public.system_health FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.upsert_health(
  _service text, _status text, _message text DEFAULT NULL, _latency_ms int DEFAULT NULL, _meta jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.system_health (service, status, message, latency_ms, meta, last_checked_at, updated_at)
  VALUES (_service, _status, _message, _latency_ms, COALESCE(_meta, '{}'::jsonb), now(), now())
  ON CONFLICT (service) DO UPDATE SET
    status = EXCLUDED.status,
    message = EXCLUDED.message,
    latency_ms = EXCLUDED.latency_ms,
    meta = EXCLUDED.meta,
    last_checked_at = EXCLUDED.last_checked_at,
    updated_at = now();
END $$;

GRANT EXECUTE ON FUNCTION public.upsert_health(text, text, text, int, jsonb) TO authenticated, service_role;

INSERT INTO public.system_health (service, status, message) VALUES
  ('db', 'ok', 'Banco de dados operacional'),
  ('auth', 'ok', 'Autenticação operacional'),
  ('email', 'unknown', 'Aguardando primeira verificação'),
  ('whatsapp', 'unknown', 'Aguardando primeira verificação'),
  ('meta', 'unknown', 'Aguardando primeira verificação'),
  ('google', 'unknown', 'Aguardando primeira verificação'),
  ('ai', 'ok', 'Lovable AI Gateway'),
  ('webhook', 'unknown', 'Aguardando primeira verificação')
ON CONFLICT (service) DO NOTHING;

-- ---------- 4. WORKFLOW ENGINE ----------
CREATE TABLE IF NOT EXISTS public.workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT false,
  trigger jsonb NOT NULL,
  steps jsonb NOT NULL,
  version int NOT NULL DEFAULT 1,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  entity_type text,
  entity_id text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  logs jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text
);

CREATE INDEX IF NOT EXISTS workflow_runs_wf_idx ON public.workflow_runs (workflow_id, started_at DESC);
CREATE INDEX IF NOT EXISTS workflow_runs_entity_idx ON public.workflow_runs (entity_type, entity_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflows TO authenticated;
GRANT ALL ON public.workflows TO service_role;
GRANT SELECT ON public.workflow_runs TO authenticated;
GRANT ALL ON public.workflow_runs TO service_role;

ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workflows_read_authenticated"
  ON public.workflows FOR SELECT TO authenticated USING (true);
CREATE POLICY "workflows_admin_write"
  ON public.workflows FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'coordenador'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'coordenador'::app_role));

CREATE POLICY "workflow_runs_read_authenticated"
  ON public.workflow_runs FOR SELECT TO authenticated USING (true);

-- ---------- 5. ACTIONABLE INSIGHTS ----------
CREATE TABLE IF NOT EXISTS public.ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  narrative text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  recommendation text,
  status text NOT NULL DEFAULT 'open',
  linked_workflow_id uuid REFERENCES public.workflows(id) ON DELETE SET NULL,
  linked_entity_type text,
  linked_entity_id text,
  created_by uuid,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS ai_insights_status_idx ON public.ai_insights (status, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_insights_category_idx ON public.ai_insights (category, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.ai_insights TO authenticated;
GRANT ALL ON public.ai_insights TO service_role;
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insights_read_authenticated"
  ON public.ai_insights FOR SELECT TO authenticated USING (status <> 'ignored' OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "insights_manage_admin_or_coord"
  ON public.ai_insights FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'coordenador'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'coordenador'::app_role));

-- ---------- 6. CLIENT PORTAL ----------
CREATE TABLE IF NOT EXISTS public.client_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_ref text NOT NULL,
  client_name text NOT NULL,
  client_email text,
  subject text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  assigned_to uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS client_tickets_status_idx ON public.client_tickets (status, created_at DESC);
CREATE INDEX IF NOT EXISTS client_tickets_ref_idx ON public.client_tickets (client_ref);

GRANT SELECT, INSERT, UPDATE ON public.client_tickets TO authenticated;
GRANT ALL ON public.client_tickets TO service_role;
ALTER TABLE public.client_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tickets_read_authenticated"
  ON public.client_tickets FOR SELECT TO authenticated USING (true);
CREATE POLICY "tickets_write_admin_coord"
  ON public.client_tickets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'coordenador'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'coordenador'::app_role));

-- updated_at trigger genérico
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_workflows_uat ON public.workflows;
CREATE TRIGGER trg_workflows_uat BEFORE UPDATE ON public.workflows
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

DROP TRIGGER IF EXISTS trg_insights_uat ON public.ai_insights;
CREATE TRIGGER trg_insights_uat BEFORE UPDATE ON public.ai_insights
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

DROP TRIGGER IF EXISTS trg_tickets_uat ON public.client_tickets;
CREATE TRIGGER trg_tickets_uat BEFORE UPDATE ON public.client_tickets
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

DROP TRIGGER IF EXISTS trg_system_health_uat ON public.system_health;
CREATE TRIGGER trg_system_health_uat BEFORE UPDATE ON public.system_health
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();