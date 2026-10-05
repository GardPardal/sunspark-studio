-- Relatório diário dos leads do quiz (tráfego interno), gerado às 15h de Brasília.
CREATE TABLE IF NOT EXISTS public.relatorios_quiz (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gerado_em timestamptz NOT NULL DEFAULT now(),
  periodo_de timestamptz NOT NULL,
  periodo_ate timestamptz NOT NULL,
  total integer NOT NULL DEFAULT 0,
  origem text NOT NULL DEFAULT 'agendado',
  dados jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS relatorios_quiz_gerado_em_idx ON public.relatorios_quiz (gerado_em DESC);

GRANT SELECT ON public.relatorios_quiz TO authenticated;
GRANT ALL ON public.relatorios_quiz TO service_role;

ALTER TABLE public.relatorios_quiz ENABLE ROW LEVEL SECURITY;

CREATE POLICY "relatorios_quiz: gestão e SDR leem"
  ON public.relatorios_quiz FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'coordenador')
    OR public.has_role(auth.uid(), 'sdr')
  );

INSERT INTO public.internal_tokens (name, token)
SELECT 'relatorio_quiz_cron', encode(gen_random_bytes(32), 'hex')
WHERE NOT EXISTS (SELECT 1 FROM public.internal_tokens WHERE name = 'relatorio_quiz_cron');

-- 18h UTC = 15h em Brasília (sem horário de verão)
SELECT cron.unschedule('relatorio-quiz-diario')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'relatorio-quiz-diario');

SELECT cron.schedule(
  'relatorio-quiz-diario',
  '0 18 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://lz7energia.com.br/api/public/auditoria/relatorio-quiz',
    headers := jsonb_build_object('Content-Type','application/json','x-internal-token',(SELECT token FROM public.internal_tokens WHERE name='relatorio_quiz_cron')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cron$
);