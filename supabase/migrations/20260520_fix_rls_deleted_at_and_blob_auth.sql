-- Fix RLS policies and handle_new_user trigger
-- Applied: 2026-05-20
-- Fixes: users not visible after OTP login, blob error on login

-- 1. Make sure deleted_at defaults to NULL properly on users table
ALTER TABLE public.users ALTER COLUMN deleted_at SET DEFAULT NULL;

-- 2. Fix any existing users where deleted_at might be wrong
UPDATE public.users SET deleted_at = NULL WHERE deleted_at IS NOT NULL AND id IN (
  SELECT id FROM auth.users
);

-- 3. Fix technicians table too
ALTER TABLE public.technicians ALTER COLUMN deleted_at SET DEFAULT NULL;

-- 4. Update handle_new_user to explicitly set deleted_at = NULL
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, phone, role, deleted_at, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email, NEW.phone),
    NEW.phone,
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer'),
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

-- 5. Fix SELECT policy on users - remove deleted_at restriction so users can always see themselves
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- 6. Fix orders SELECT policy - allow user, technician, and admin to see orders
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
CREATE POLICY "Users can view their own orders"
  ON public.orders FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.uid() = technician_id
    OR is_admin(auth.uid())
  );
