
-- ============ LEADS: campos novos ============
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS is_offline boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============ Helper: papel do usuário atual ============
CREATE OR REPLACE FUNCTION public.current_user_roles()
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(array_agg(role::text), ARRAY[]::text[])
  FROM public.user_roles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_coord()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role::text IN ('admin','coordenador')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.current_user_roles() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_coord() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_roles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_coord() TO authenticated;

-- ============ CADENCE_STEPS ============
CREATE TABLE IF NOT EXISTS public.cadence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_offset int NOT NULL DEFAULT 0,
  channel text NOT NULL DEFAULT 'whatsapp',
  title text NOT NULL,
  description text,
  ordem int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cadence_steps TO authenticated;
GRANT ALL ON public.cadence_steps TO service_role;
ALTER TABLE public.cadence_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cadence_steps_read_auth" ON public.cadence_steps
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "cadence_steps_admin_write" ON public.cadence_steps
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

-- ============ LEAD_CADENCE_TASKS ============
CREATE TABLE IF NOT EXISTS public.lead_cadence_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  step_id uuid REFERENCES public.cadence_steps(id) ON DELETE SET NULL,
  title text NOT NULL,
  channel text,
  description text,
  due_at timestamptz NOT NULL,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lct_lead ON public.lead_cadence_tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_lct_due ON public.lead_cadence_tasks(due_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_cadence_tasks TO authenticated;
GRANT ALL ON public.lead_cadence_tasks TO service_role;
ALTER TABLE public.lead_cadence_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lct_read_scoped" ON public.lead_cadence_tasks
  FOR SELECT TO authenticated USING (
    public.is_admin_or_coord()
    OR EXISTS (
      SELECT 1 FROM public.leads l WHERE l.id = lead_cadence_tasks.lead_id
        AND (l.assigned_to = auth.uid() OR l.assigned_to IS NULL)
    )
  );

CREATE POLICY "lct_write_owner" ON public.lead_cadence_tasks
  FOR UPDATE TO authenticated USING (
    public.is_admin_or_coord()
    OR EXISTS (
      SELECT 1 FROM public.leads l WHERE l.id = lead_cadence_tasks.lead_id
        AND l.assigned_to = auth.uid()
    )
  );

-- ============ LEAD_TRANSFERS ============
CREATE TABLE IF NOT EXISTS public.lead_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  from_user uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  to_user uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transfers_lead ON public.lead_transfers(lead_id);

GRANT SELECT ON public.lead_transfers TO authenticated;
GRANT ALL ON public.lead_transfers TO service_role;
ALTER TABLE public.lead_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transfers_read_scoped" ON public.lead_transfers
  FOR SELECT TO authenticated USING (
    public.is_admin_or_coord() OR from_user = auth.uid() OR to_user = auth.uid()
  );

-- ============ TRAFFIC_SPEND ============
CREATE TABLE IF NOT EXISTS public.traffic_spend (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spend_date date NOT NULL,
  channel text NOT NULL,
  campaign text,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ts_date ON public.traffic_spend(spend_date);
CREATE INDEX IF NOT EXISTS idx_ts_channel ON public.traffic_spend(channel);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.traffic_spend TO authenticated;
GRANT ALL ON public.traffic_spend TO service_role;
ALTER TABLE public.traffic_spend ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ts_read_admin_coord" ON public.traffic_spend
  FOR SELECT TO authenticated USING (public.is_admin_or_coord());
CREATE POLICY "ts_write_admin_coord" ON public.traffic_spend
  FOR ALL TO authenticated
  USING (public.is_admin_or_coord())
  WITH CHECK (public.is_admin_or_coord());

-- ============ LEADS RLS (rescrever) ============
DROP POLICY IF EXISTS "leads_select_scoped" ON public.leads;
DROP POLICY IF EXISTS "leads_update_scoped" ON public.leads;
DROP POLICY IF EXISTS "leads_insert_offline" ON public.leads;
DROP POLICY IF EXISTS "leads_delete_admin" ON public.leads;

CREATE POLICY "leads_select_scoped" ON public.leads
  FOR SELECT TO authenticated USING (
    public.is_admin_or_coord()
    OR assigned_to = auth.uid()
    OR (assigned_to IS NULL AND EXISTS(
      SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()
        AND role::text IN ('consultor','coordenador','admin')
    ))
  );

CREATE POLICY "leads_update_scoped" ON public.leads
  FOR UPDATE TO authenticated USING (
    public.is_admin_or_coord()
    OR assigned_to = auth.uid()
    OR (assigned_to IS NULL AND EXISTS(
      SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'consultor'
    ))
  );

CREATE POLICY "leads_insert_offline" ON public.leads
  FOR INSERT TO authenticated WITH CHECK (
    is_offline = true AND created_by = auth.uid()
  );

CREATE POLICY "leads_delete_admin" ON public.leads
  FOR DELETE TO authenticated USING (public.is_admin_or_coord());

-- ============ TRIGGER: posse automática + gera cadência ============
CREATE OR REPLACE FUNCTION public.leads_claim_and_seed_cadence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  -- Auto-atribuição: se não tem dono e um consultor moveu, vira dono
  IF NEW.assigned_to IS NULL AND v_user IS NOT NULL AND NEW.stage IS DISTINCT FROM OLD.stage THEN
    NEW.assigned_to := v_user;
  END IF;

  -- Ao entrar em "atendimento" pela primeira vez, gera tarefas da cadência
  IF NEW.stage = 'atendimento' AND (OLD.stage IS NULL OR OLD.stage <> 'atendimento') THEN
    IF NOT EXISTS (SELECT 1 FROM public.lead_cadence_tasks WHERE lead_id = NEW.id) THEN
      INSERT INTO public.lead_cadence_tasks (lead_id, step_id, title, channel, description, due_at)
      SELECT NEW.id, s.id, s.title, s.channel, s.description,
             now() + (s.day_offset || ' days')::interval
      FROM public.cadence_steps s
      WHERE s.active = true
      ORDER BY s.ordem, s.day_offset;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_claim_cadence ON public.leads;
CREATE TRIGGER trg_leads_claim_cadence
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.leads_claim_and_seed_cadence();

-- ============ Semente de cadência padrão ============
INSERT INTO public.cadence_steps (day_offset, channel, title, description, ordem)
SELECT * FROM (VALUES
  (0, 'whatsapp', 'Primeiro contato via WhatsApp', 'Enviar mensagem de apresentação e confirmar interesse.', 1),
  (1, 'ligacao',  'Ligação de qualificação',       'Ligar para entender consumo e agendar visita.', 2),
  (3, 'whatsapp', 'Follow-up WhatsApp',            'Retomar conversa e enviar proposta preliminar.', 3),
  (7, 'ligacao',  'Última tentativa por telefone', 'Se ainda não respondeu, tentativa final.', 4),
  (14,'whatsapp', 'Encerrar cadência',             'Se não houve retorno, marcar como perdido.', 5)
) AS v(day_offset, channel, title, description, ordem)
WHERE NOT EXISTS (SELECT 1 FROM public.cadence_steps);
