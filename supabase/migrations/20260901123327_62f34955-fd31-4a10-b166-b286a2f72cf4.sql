-- Ponte de envio de e-mails disparados pelo banco (novo lead, agenda, lembretes)
CREATE TABLE IF NOT EXISTS public.email_dispatch_config (
  id integer PRIMARY KEY DEFAULT 1,
  secret text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  endpoint_url text NOT NULL DEFAULT 'https://lz7energia.com.br/api/public/email/dispatch',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_dispatch_config_single_row CHECK (id = 1)
);

GRANT ALL ON public.email_dispatch_config TO service_role;

ALTER TABLE public.email_dispatch_config ENABLE ROW LEVEL SECURITY;

INSERT INTO public.email_dispatch_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.send_managed_email(payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, extensions
AS $fn$
DECLARE
  v_secret text;
  v_url text;
  v_request_id bigint;
BEGIN
  SELECT secret, endpoint_url INTO v_secret, v_url
  FROM public.email_dispatch_config WHERE id = 1;

  IF v_secret IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-email-dispatch-secret', v_secret
    ),
    body := payload
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.send_managed_email(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_managed_email(jsonb) TO service_role;

-- Redireciona os gatilhos existentes do enfileiramento antigo para o envio gerenciado
DO $do$
DECLARE
  r record;
  v_def text;
BEGIN
  FOR r IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosrc ILIKE '%enqueue_email%'
      AND p.proname <> 'enqueue_email'
  LOOP
    v_def := pg_get_functiondef(r.oid);
    v_def := regexp_replace(
      v_def,
      'public\.enqueue_email\(\s*''[a-z_]+''\s*,',
      'public.send_managed_email(',
      'g'
    );
    EXECUTE v_def;
  END LOOP;
END;
$do$;