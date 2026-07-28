ALTER TABLE public.device_subscriptions
  ADD COLUMN IF NOT EXISTS os text,
  ADD COLUMN IF NOT EXISTS device_type text NOT NULL DEFAULT 'desktop',
  ADD COLUMN IF NOT EXISTS is_pwa boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.push_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  meeting_id uuid,
  kind text NOT NULL DEFAULT 'test',
  title text NOT NULL,
  body text,
  device_names text[] NOT NULL DEFAULT '{}',
  delivered integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.push_log TO authenticated;
GRANT ALL ON public.push_log TO service_role;

ALTER TABLE public.push_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own push log" ON public.push_log
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS push_log_user_created_idx
  ON public.push_log (user_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.push_log;

CREATE OR REPLACE FUNCTION public.push_cron_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, cron, pg_catalog
AS $$
  SELECT jsonb_build_object(
    'active', COALESCE((SELECT bool_or(active) FROM cron.job WHERE jobname = 'orbit-reminders'), false),
    'schedule', (SELECT schedule FROM cron.job WHERE jobname = 'orbit-reminders' LIMIT 1),
    'last_run', (
      SELECT max(d.start_time)
      FROM cron.job_run_details d
      JOIN cron.job j ON j.jobid = d.jobid
      WHERE j.jobname = 'orbit-reminders'
    ),
    'last_status', (
      SELECT d.status
      FROM cron.job_run_details d
      JOIN cron.job j ON j.jobid = d.jobid
      WHERE j.jobname = 'orbit-reminders'
      ORDER BY d.start_time DESC
      LIMIT 1
    )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.push_cron_status() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.push_cron_status() TO authenticated;