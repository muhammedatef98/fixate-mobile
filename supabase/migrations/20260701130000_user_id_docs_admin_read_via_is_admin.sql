-- The admin read policy on the private ID-documents bucket gated on the raw
-- users.is_admin column, whereas every other admin gate in the app uses
-- public.is_admin(), which ALSO recognizes RBAC staff who hold
-- 'full_admin_access' (but may have users.is_admin = false). An RBAC-only
-- admin could therefore open a verification row (its table policy has the same
-- gap, fixed below) yet fail to load the ID/selfie images, because
-- createSignedUrl needs SELECT on the storage object.
--
-- Realign both the storage read policy and the user_verifications admin
-- policies with is_admin() so every admin the app recognizes can review
-- submitted documents. (The primary "images are blank" bug was zero-byte
-- uploads, fixed in the client; this is defence-in-depth so the RLS layer
-- can't reintroduce a blank-image symptom for differently-provisioned admins.)

-- 1. Storage: admins read ID documents.
DROP POLICY IF EXISTS "user_id_docs_select_admin" ON storage.objects;
CREATE POLICY "user_id_docs_select_admin"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'user-id-documents'
    AND public.is_admin(auth.uid())
  );

-- 2. user_verifications: admins read every application.
DROP POLICY IF EXISTS "user_verifications_select_admin" ON public.user_verifications;
CREATE POLICY "user_verifications_select_admin"
  ON public.user_verifications FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- 3. user_verifications: admins update (approve / reject).
DROP POLICY IF EXISTS "user_verifications_update_admin" ON public.user_verifications;
CREATE POLICY "user_verifications_update_admin"
  ON public.user_verifications FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
