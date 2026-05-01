
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'fleetiq-simulate',
  '*/1 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://hycrujlnybmtbmbkfdhn.supabase.co/functions/v1/simulate-telemetry',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{"ticks": 6}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'fleetiq-predict',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://hycrujlnybmtbmbkfdhn.supabase.co/functions/v1/predict-maintenance',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
