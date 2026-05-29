-- M-3: handle_new_user previously trusted whatever string the client put
-- into raw_user_meta_data.role. A client calling
-- supabase.auth.signUp({ options: { data: { role: 'admin' }}}) ended up
-- with `public.users.role = 'admin'` even though our authorisation gate
-- is `is_admin` (a boolean). It contaminates the data model and breaks
-- code that branches on string `role`.
--
-- This migration whitelists role to one of ('customer', 'technician')
-- and falls back to 'customer' for anything else (incl. NULL / unknown).
-- Existing rows are untouched.
--
-- Rollback:
--   CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
--   LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN
--     INSERT INTO public.users (id, email, name, phone, role, deleted_at, created_at) VALUES (
--       NEW.id, NEW.email,
--       COALESCE(NEW.raw_user_meta_data->>'name', NEW.email, NEW.phone),
--       NEW.phone,
--       COALESCE(NEW.raw_user_meta_data->>'role', 'customer'),
--       NULL, NOW()
--     ) ON CONFLICT (id) DO UPDATE
--       SET deleted_at = NULL,
--           phone = COALESCE(EXCLUDED.phone, public.users.phone),
--           email = COALESCE(EXCLUDED.email, public.users.email);
--     RETURN NEW;
--   END; $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_input text := NEW.raw_user_meta_data->>'role';
  v_role text := CASE
    WHEN v_role_input IN ('customer', 'technician') THEN v_role_input
    ELSE 'customer'
  END;
BEGIN
  INSERT INTO public.users (id, email, name, phone, role, deleted_at, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email, NEW.phone),
    NEW.phone,
    v_role,
    NULL,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
    SET deleted_at = NULL,
        phone = COALESCE(EXCLUDED.phone, public.users.phone),
        email = COALESCE(EXCLUDED.email, public.users.email);
  RETURN NEW;
END;
$$;
