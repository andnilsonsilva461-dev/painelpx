-- meetings: multiple reminder offsets (minutes before start)
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS reminder_offsets integer[] NOT NULL DEFAULT ARRAY[1440, 60, 15, 0];

-- push subscriptions
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own push subscriptions"
  ON public.push_subscriptions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- reminder dispatch log (dedupe)
CREATE TABLE public.reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  meeting_id uuid REFERENCES public.meetings(id) ON DELETE CASCADE,
  kind text NOT NULL,
  offset_minutes integer,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX reminder_log_unique
  ON public.reminder_log (meeting_id, kind, offset_minutes);
CREATE INDEX reminder_log_user_idx ON public.reminder_log (user_id, sent_at DESC);

GRANT SELECT ON public.reminder_log TO authenticated;
GRANT ALL ON public.reminder_log TO service_role;
ALTER TABLE public.reminder_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own reminder log"
  ON public.reminder_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- user settings
CREATE TABLE public.user_settings (
  user_id uuid PRIMARY KEY,
  default_reminder_offsets integer[] NOT NULL DEFAULT ARRAY[1440, 60, 15, 0],
  daily_digest boolean NOT NULL DEFAULT true,
  daily_digest_hour integer NOT NULL DEFAULT 8,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own settings"
  ON public.user_settings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- index for reminder sweeps
CREATE INDEX IF NOT EXISTS meetings_starts_at_idx ON public.meetings (starts_at);