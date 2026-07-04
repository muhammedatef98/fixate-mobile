-- Allow the courier role through the signup trigger (previously collapsed to
-- 'customer'). The signup edge function's users upsert also backfills, but
-- the trigger should be first-class so no window exists with a wrong role.
-- Applied to remote 2026-07-04.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role_input text := NEW.raw_user_meta_data->>'role';
  v_role text := CASE
    WHEN v_role_input IN ('customer', 'technician', 'courier') THEN v_role_input
    ELSE 'customer'
  END;
  v_metadata_name text := NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), '');
BEGIN
  INSERT INTO public.users (id, email, name, phone, role, deleted_at, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(v_metadata_name, ''),
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
$function$;
