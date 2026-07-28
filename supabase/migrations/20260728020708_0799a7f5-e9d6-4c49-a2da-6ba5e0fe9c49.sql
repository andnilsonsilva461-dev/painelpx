CREATE TYPE public.prospect_outcome AS ENUM ('pendente','agendou','ligar_depois','nao_atendeu','sem_interesse','vai_pensar','virou_cliente','numero_errado','sem_whatsapp');

CREATE TABLE public.live_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text,
  goal integer NOT NULL DEFAULT 100,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_sessions TO authenticated;
GRANT ALL ON public.live_sessions TO service_role;
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own live sessions" ON public.live_sessions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id uuid REFERENCES public.live_sessions(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  meeting_id uuid REFERENCES public.meetings(id) ON DELETE SET NULL,
  name text NOT NULL,
  phone text,
  instagram text,
  company text,
  notes text,
  source lead_source NOT NULL DEFAULT 'live',
  outcome prospect_outcome NOT NULL DEFAULT 'pendente',
  callback_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospects TO authenticated;
GRANT ALL ON public.prospects TO service_role;
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prospects" ON public.prospects FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX prospects_user_created_idx ON public.prospects (user_id, created_at DESC);
CREATE INDEX prospects_session_idx ON public.prospects (session_id);

CREATE TRIGGER prospects_updated_at BEFORE UPDATE ON public.prospects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER live_sessions_updated_at BEFORE UPDATE ON public.live_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS daily_prospect_goal integer NOT NULL DEFAULT 100;

ALTER PUBLICATION supabase_realtime ADD TABLE public.prospects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_sessions;