ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS produto_interesse text,
  ADD COLUMN IF NOT EXISTS captacao_metodo text;