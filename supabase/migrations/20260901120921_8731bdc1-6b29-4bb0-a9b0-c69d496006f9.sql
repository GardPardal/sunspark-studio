-- 1. Papel RH
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'rh';

-- 2. Helper (comparação textual: segura mesmo com valor de enum recém-criado)
CREATE OR REPLACE FUNCTION public.is_rh_or_above()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role::text IN ('admin','coordenador','rh')
  );
$$;

-- 3. Vagas
ALTER TABLE public.site_jobs
  ADD COLUMN IF NOT EXISTS stages jsonb NOT NULL DEFAULT '["Candidatura recebida","Triagem","Contato inicial","Entrevista","Avaliação comportamental","Avaliação final","Aprovado","Contratado","Não selecionado","Banco de talentos"]'::jsonb,
  ADD COLUMN IF NOT EXISTS disc_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

-- 4. Candidaturas
ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'Candidatura recebida',
  ADD COLUMN IF NOT EXISTS stage_updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS submission_key text;

CREATE UNIQUE INDEX IF NOT EXISTS job_applications_submission_key_idx
  ON public.job_applications (submission_key) WHERE submission_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS job_applications_job_email_idx
  ON public.job_applications (job_id, lower(email));
CREATE INDEX IF NOT EXISTS job_applications_stage_idx ON public.job_applications (stage);

-- 5. Histórico de etapas
CREATE TABLE IF NOT EXISTS public.application_stage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  from_stage text,
  to_stage text NOT NULL,
  note text,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.application_stage_events TO authenticated;
GRANT ALL ON public.application_stage_events TO service_role;
ALTER TABLE public.application_stage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stage events rh read" ON public.application_stage_events
  FOR SELECT TO authenticated USING (public.is_rh_or_above());
CREATE POLICY "stage events rh insert" ON public.application_stage_events
  FOR INSERT TO authenticated WITH CHECK (public.is_rh_or_above());

-- 6. Observações internas
CREATE TABLE IF NOT EXISTS public.application_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  body text NOT NULL,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_notes TO authenticated;
GRANT ALL ON public.application_notes TO service_role;
ALTER TABLE public.application_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notes rh all" ON public.application_notes
  FOR ALL TO authenticated USING (public.is_rh_or_above()) WITH CHECK (public.is_rh_or_above());

-- 7. Log de e-mails da candidatura
CREATE TABLE IF NOT EXISTS public.application_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES public.job_applications(id) ON DELETE CASCADE,
  to_email text NOT NULL,
  kind text NOT NULL DEFAULT 'nova-candidatura',
  status text NOT NULL DEFAULT 'queued',
  attempt integer NOT NULL DEFAULT 1,
  message_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.application_email_log TO authenticated;
GRANT ALL ON public.application_email_log TO service_role;
ALTER TABLE public.application_email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email log rh read" ON public.application_email_log
  FOR SELECT TO authenticated USING (public.is_rh_or_above());

-- 8. Avaliação comportamental interna (modelo DISC)
CREATE TABLE IF NOT EXISTS public.disc_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft',
  scoring_rule text NOT NULL DEFAULT 'Soma dos pesos das alternativas escolhidas por dimensão (D, I, S, C). O percentual é a pontuação da dimensão dividida pelo total. Avaliação comportamental interna de uso complementar — não é teste psicológico validado.',
  instructions text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disc_versions TO authenticated;
GRANT ALL ON public.disc_versions TO service_role;
ALTER TABLE public.disc_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disc versions rh all" ON public.disc_versions
  FOR ALL TO authenticated USING (public.is_rh_or_above()) WITH CHECK (public.is_rh_or_above());

CREATE TABLE IF NOT EXISTS public.disc_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.disc_versions(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  help text,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disc_questions TO authenticated;
GRANT ALL ON public.disc_questions TO service_role;
ALTER TABLE public.disc_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disc questions rh all" ON public.disc_questions
  FOR ALL TO authenticated USING (public.is_rh_or_above()) WITH CHECK (public.is_rh_or_above());

CREATE TABLE IF NOT EXISTS public.disc_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.disc_questions(id) ON DELETE CASCADE,
  label text NOT NULL,
  dimension text NOT NULL CHECK (dimension IN ('D','I','S','C')),
  weight numeric NOT NULL DEFAULT 1,
  ordem integer NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disc_options TO authenticated;
GRANT ALL ON public.disc_options TO service_role;
ALTER TABLE public.disc_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disc options rh all" ON public.disc_options
  FOR ALL TO authenticated USING (public.is_rh_or_above()) WITH CHECK (public.is_rh_or_above());

CREATE TABLE IF NOT EXISTS public.disc_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES public.disc_versions(id) ON DELETE RESTRICT,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'enviado',
  expires_at timestamptz NOT NULL,
  sent_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.disc_invites TO authenticated;
GRANT ALL ON public.disc_invites TO service_role;
ALTER TABLE public.disc_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disc invites rh all" ON public.disc_invites
  FOR ALL TO authenticated USING (public.is_rh_or_above()) WITH CHECK (public.is_rh_or_above());

CREATE TABLE IF NOT EXISTS public.disc_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid NOT NULL UNIQUE REFERENCES public.disc_invites(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES public.disc_versions(id) ON DELETE RESTRICT,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.disc_responses TO authenticated;
GRANT ALL ON public.disc_responses TO service_role;
ALTER TABLE public.disc_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disc responses rh read" ON public.disc_responses
  FOR SELECT TO authenticated USING (public.is_rh_or_above());

-- 9. Políticas existentes: incluir papel RH
DROP POLICY IF EXISTS "job_applications manage" ON public.job_applications;
CREATE POLICY "job_applications manage" ON public.job_applications
  FOR ALL TO authenticated USING (public.is_rh_or_above()) WITH CHECK (public.is_rh_or_above());

DROP POLICY IF EXISTS "site_jobs manage" ON public.site_jobs;
CREATE POLICY "site_jobs manage" ON public.site_jobs
  FOR ALL TO authenticated USING (public.is_rh_or_above()) WITH CHECK (public.is_rh_or_above());

DROP POLICY IF EXISTS "site_rh_questions manage" ON public.site_rh_questions;
CREATE POLICY "site_rh_questions manage" ON public.site_rh_questions
  FOR ALL TO authenticated USING (public.is_rh_or_above()) WITH CHECK (public.is_rh_or_above());

DROP POLICY IF EXISTS "resumes admin read" ON storage.objects;
CREATE POLICY "resumes rh read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'resumes' AND public.is_rh_or_above());

-- 10. Configuração dos destinatários do aviso de candidatura
INSERT INTO public.site_settings (key, value)
VALUES ('rh:notify_emails', 'paloma.stalen@lz7energia.com.br,alisonlz7@icloud.com')
ON CONFLICT (key) DO NOTHING;