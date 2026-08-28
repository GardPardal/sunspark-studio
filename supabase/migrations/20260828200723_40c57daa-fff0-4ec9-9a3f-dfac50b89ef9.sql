CREATE TABLE IF NOT EXISTS public.hub_dados (
  id integer PRIMARY KEY DEFAULT 1,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  origem text,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hub_dados_singleton CHECK (id = 1)
);

GRANT ALL ON public.hub_dados TO service_role;

ALTER TABLE public.hub_dados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ler os dados do hub"
ON public.hub_dados FOR SELECT TO authenticated
USING (public.is_admin_or_coord());

INSERT INTO public.hub_dados (id, dados) VALUES (1, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;