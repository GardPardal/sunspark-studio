ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS quiz_data jsonb;
COMMENT ON COLUMN public.leads.quiz_data IS 'Respostas do Quiz Solar (quando o lead veio do quiz). Null para os demais.';