select cron.unschedule('editorial-regional') where exists (select 1 from cron.job where jobname = 'editorial-regional');

select cron.schedule(
  'editorial-regional',
  '5 */3 * * *',
  $$
  select net.http_post(
    url := 'https://z7energia.lovable.app/api/public/editorial/regional',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"maxPosts": 5}'::jsonb
  );
  $$
);