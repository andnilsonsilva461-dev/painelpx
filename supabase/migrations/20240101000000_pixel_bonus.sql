DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('admin', 'sdr');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE public.payment_status AS ENUM ('pendente', 'aprovado', 'pago');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    role public.app_role NOT NULL DEFAULT 'sdr',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS qualified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS service TEXT;

CREATE TABLE IF NOT EXISTS public.bonus_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    min_meetings INTEGER NOT NULL,
    max_meetings INTEGER,
    bonus_amount NUMERIC NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.monthly_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    qualified_meetings INTEGER NOT NULL DEFAULT 0,
    bonus_amount NUMERIC NOT NULL DEFAULT 0,
    payment_status public.payment_status NOT NULL DEFAULT 'pendente',
    closed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, month, year)
);
