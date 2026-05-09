CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT u.is_admin FROM public.users u WHERE u.id = uid), false);
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO postgres, service_role;

DROP POLICY IF EXISTS "Admins read all users" ON public.users;
DROP POLICY IF EXISTS "Admins read all technicians" ON public.technicians;
DROP POLICY IF EXISTS "Admins manage technician verification" ON public.technicians;
DROP POLICY IF EXISTS "Users see their own thread" ON public.support_threads;
DROP POLICY IF EXISTS "Users / admins update threads" ON public.support_threads;
DROP POLICY IF EXISTS "Read messages in own thread" ON public.support_messages;
DROP POLICY IF EXISTS "Insert messages into own thread" ON public.support_messages;

CREATE POLICY "Admins read all users" ON public.users FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins read all technicians" ON public.technicians FOR SELECT
  USING ((available = true) OR (auth.uid() = user_id) OR public.is_admin(auth.uid()));
CREATE POLICY "Admins manage technician verification" ON public.technicians FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Users see their own thread" ON public.support_threads FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Users / admins update threads" ON public.support_threads FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Read messages in own thread" ON public.support_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.support_threads t WHERE t.id = support_messages.thread_id
    AND (t.user_id = auth.uid() OR public.is_admin(auth.uid()))));
CREATE POLICY "Insert messages into own thread" ON public.support_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.support_threads t WHERE t.id = support_messages.thread_id
    AND (t.user_id = auth.uid() OR public.is_admin(auth.uid()))));
