CREATE TABLE public.hub_dados_hist (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dados jsonb NOT NULL,
  origem text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.hub_dados_hist TO service_role;

ALTER TABLE public.hub_dados_hist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sem acesso público ao histórico do hub"
  ON public.hub_dados_hist
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);