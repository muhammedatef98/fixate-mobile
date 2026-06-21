-- Admins (users.is_admin = true) need to read other users' rows so the
-- verifications screen and any other admin tooling can show the submitter's
-- name/phone alongside their technician profile.
CREATE POLICY "Admins read all users"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users me
      WHERE me.id = auth.uid() AND me.is_admin = true
    )
  );
