-- lovable-cron-fallback-reviewed: 96 runs/day; fila com retentativas com atraso progressivo (1min–12h) após falha do Ploomes exige varredura periódica; o disparo principal é por trigger no enqueue
INSERT INTO public.internal_tokens (name, token)
SELECT 'lead_sync_cron', encode(gen_random_bytes(32), 'hex')
WHERE NOT EXISTS (SELECT 1 FROM public.internal_tokens WHERE name = 'lead_sync_cron');

CREATE OR REPLACE FUNCTION public.lead_sync_queue_wake()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_token text;
BEGIN
  IF NEW.status = 'pendente' AND NEW.next_attempt_at <= now() + interval '5 seconds' THEN
    SELECT token INTO v_token FROM public.internal_tokens WHERE name = 'lead_sync_cron';
    IF v_token IS NOT NULL THEN
      PERFORM net.http_post(
        url := 'https://lz7energia.com.br/api/public/leads/sync-worker',
        headers := jsonb_build_object('Content-Type','application/json','x-internal-token', v_token),
        body := '{}'::jsonb
      );
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_lead_sync_queue_wake ON public.lead_sync_queue;
CREATE TRIGGER trg_lead_sync_queue_wake AFTER INSERT ON public.lead_sync_queue
FOR EACH ROW EXECUTE FUNCTION public.lead_sync_queue_wake();

DO $$ BEGIN PERFORM cron.unschedule('lead-sync-worker'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'lead-sync-worker',
  '*/15 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://lz7energia.com.br/api/public/leads/sync-worker',
    headers := jsonb_build_object('Content-Type','application/json','x-internal-token',(SELECT token FROM public.internal_tokens WHERE name='lead_sync_cron')),
    body := '{}'::jsonb
  )
  WHERE EXISTS (SELECT 1 FROM public.lead_sync_queue WHERE status = 'pendente' AND next_attempt_at <= now());
  $cron$
);