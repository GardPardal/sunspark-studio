select cron.unschedule('meta-sheets-daily') where exists (select 1 from cron.job where jobname = 'meta-sheets-daily');

select cron.schedule(
  'meta-sheets-daily',
  '5 3 * * *',
  $$
  select net.http_post(
    url := 'https://z7energia.lovable.app/api/public/hooks/meta-sheets',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3d29zcHpudXRmYnhjYmJjcWZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNTA4MDgsImV4cCI6MjA5ODkyNjgwOH0.S-pUCNquKJAy83OnuOLokcvB2MlZYT6CibN1ufPbY_M"}'::jsonb,
    body := '{"days": 3}'::jsonb
  );
  $$
);