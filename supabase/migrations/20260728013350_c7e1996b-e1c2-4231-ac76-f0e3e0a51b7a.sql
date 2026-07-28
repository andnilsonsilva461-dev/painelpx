ALTER TABLE public.push_subscriptions RENAME TO device_subscriptions;

ALTER TABLE public.device_subscriptions
  ADD COLUMN IF NOT EXISTS device_name text,
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS browser text,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamp with time zone NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS device_subscriptions_user_idx
  ON public.device_subscriptions (user_id, last_seen_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS reminder_log_digest_unique
  ON public.reminder_log (user_id, kind)
  WHERE meeting_id IS NULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.history_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.device_subscriptions;