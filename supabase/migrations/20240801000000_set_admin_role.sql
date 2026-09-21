DO $$
DECLARE
    target_id UUID;
BEGIN
    SELECT id INTO target_id FROM auth.users WHERE email = 'andnilsonsilva461@gmail.com';

    IF target_id IS NOT NULL THEN
        INSERT INTO public.user_roles (user_id, role, active)
        VALUES (target_id, 'admin', true)
        ON CONFLICT (user_id) DO UPDATE SET role = 'admin', active = true;
    END IF;
END $$;
