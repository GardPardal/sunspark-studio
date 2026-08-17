select cron.unschedule('editorial-scan') where exists (select 1 from cron.job where jobname = 'editorial-scan');
select cron.unschedule('editorial-worker') where exists (select 1 from cron.job where jobname = 'editorial-worker');

select cron.schedule(
  'editorial-scan',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://z7energia.lovable.app/api/public/editorial/scan',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'editorial-worker',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://z7energia.lovable.app/api/public/editorial/worker',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);