CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('wa-queue-process')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'wa-queue-process');

SELECT cron.schedule(
  'wa-queue-process',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--1052bf05-ce78-4cd4-ba28-e672abd97ea2.lovable.app/api/public/wa/queue/process',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3d29zcHpudXRmYnhjYmJjcWZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNTA4MDgsImV4cCI6MjA5ODkyNjgwOH0.S-pUCNquKJAy83OnuOLokcvB2MlZYT6CibN1ufPbY_M'
    ),
    body := '{}'::jsonb
  );
  $$
);