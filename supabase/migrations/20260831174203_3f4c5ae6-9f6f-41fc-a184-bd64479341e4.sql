CREATE TABLE IF NOT EXISTS public.forum_liz_log (
  id bigint generated always as identity primary key,
  perguntas_encontradas integer not null default 0,
  perguntas_respondidas integer not null default 0,
  erro text,
  created_at timestamptz not null default now()
);

GRANT SELECT ON public.forum_liz_log TO authenticated;
GRANT ALL ON public.forum_liz_log TO service_role;

ALTER TABLE public.forum_liz_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_coord_le_log_forum" ON public.forum_liz_log;
CREATE POLICY "admin_coord_le_log_forum" ON public.forum_liz_log
  FOR SELECT TO authenticated
  USING (public.is_admin_or_coord());

CREATE TABLE IF NOT EXISTS public.internal_tokens (
  name text primary key,
  token text not null default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);

GRANT ALL ON public.internal_tokens TO service_role;
ALTER TABLE public.internal_tokens ENABLE ROW LEVEL SECURITY;

INSERT INTO public.internal_tokens (name) VALUES ('liz_forum_cron')
ON CONFLICT (name) DO NOTHING;