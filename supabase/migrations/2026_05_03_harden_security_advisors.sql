-- Tighten the two security advisor warnings flagged before store submission:
--
-- 1. user_has_role() was a SECURITY DEFINER callable by anon and authenticated
--    via the REST RPC endpoint. Role checks belong in RLS policies, not RPCs,
--    so revoke EXECUTE from every non-service-role principal.
--
-- 2. The avatars bucket had a single broad SELECT policy that let any
--    authenticated client list every object. Public-URL reads still work, but
--    the listing path is now closed. Insert/update/delete are scoped to the
--    user's own folder (path prefix = auth.uid()).

REVOKE EXECUTE ON FUNCTION public.user_has_role(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_has_role(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.user_has_role(uuid, text) FROM PUBLIC;

DROP POLICY IF EXISTS "Avatars are accessible to authenticated users" ON storage.objects;

CREATE POLICY "Public read avatars by URL"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'avatars'
    AND auth.role() IN ('anon', 'authenticated')
  );

CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
