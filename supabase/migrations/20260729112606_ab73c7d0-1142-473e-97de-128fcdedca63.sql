
CREATE TABLE IF NOT EXISTS public.system_diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  severity text NOT NULL CHECK (severity IN ('info','warning','error','critical')),
  source text NOT NULL,
  code text NOT NULL,
  message text NOT NULL,
  suggestion text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved','ignored')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_sysdiag_status_created ON public.system_diagnostics(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sysdiag_source_code ON public.system_diagnostics(source, code);

GRANT SELECT, UPDATE ON public.system_diagnostics TO authenticated;
GRANT ALL ON public.system_diagnostics TO service_role;

ALTER TABLE public.system_diagnostics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sysdiag_read ON public.system_diagnostics;
CREATE POLICY sysdiag_read ON public.system_diagnostics
  FOR SELECT TO authenticated
  USING (public.is_admin_or_coord());

DROP POLICY IF EXISTS sysdiag_update ON public.system_diagnostics;
CREATE POLICY sysdiag_update ON public.system_diagnostics
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_coord())
  WITH CHECK (public.is_admin_or_coord());
