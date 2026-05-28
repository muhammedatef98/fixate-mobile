-- B-5 / Option A: rewrite SELECT policies on storage.objects for bucket
-- `orders` so they actually match the real upload path patterns produced
-- by the app. The bucket stays public for now; these policies only take
-- effect when it is flipped to private.
--
-- Effective viewers per pattern:
--   orders/{orderId}/<sub>/...      -> order participants + admin
--   chat-{orderId}/...              -> order participants + admin
--   {uploaderUid}/{ts}/...          -> uploader + order participants
--                                      (matched via orders.media_urls /
--                                      before_photos / after_photos
--                                      array-contains) + admin
--   market/{userId}/{ts}/...        -> any authenticated user (parity
--                                      with market_listings_browse_live)
--
-- Anything else is denied by default. INSERT policy is intentionally left
-- untouched to avoid changing upload paths in this pass.

DROP POLICY IF EXISTS "Order images visible to participants" ON storage.objects;

CREATE OR REPLACE FUNCTION public.orders_storage_extract_order_id(p_name text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_candidate text;
BEGIN
  IF p_name IS NULL THEN
    RETURN NULL;
  ELSIF p_name LIKE 'orders/%' THEN
    v_candidate := split_part(p_name, '/', 2);
  ELSIF p_name LIKE 'chat-%' THEN
    v_candidate := substring(split_part(p_name, '/', 1) FROM 6);
  ELSE
    RETURN NULL;
  END IF;
  IF v_candidate IS NULL OR v_candidate = '' THEN
    RETURN NULL;
  END IF;
  BEGIN
    RETURN v_candidate::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.orders_storage_extract_order_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.orders_storage_extract_order_id(text) TO authenticated;

DROP POLICY IF EXISTS "orders bucket: order participants read" ON storage.objects;
CREATE POLICY "orders bucket: order participants read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'orders'
  AND (objects.name LIKE 'orders/%' OR objects.name LIKE 'chat-%')
  AND (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.orders o
       WHERE o.id = public.orders_storage_extract_order_id(objects.name)
         AND (o.user_id = auth.uid() OR o.technician_id = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "orders bucket: uploader and participants read pre-upload" ON storage.objects;
CREATE POLICY "orders bucket: uploader and participants read pre-upload"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'orders'
  AND objects.name NOT LIKE 'orders/%'
  AND objects.name NOT LIKE 'chat-%'
  AND objects.name NOT LIKE 'market/%'
  AND (
    public.is_admin(auth.uid())
    OR (storage.foldername(objects.name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.orders o
       WHERE (o.user_id = auth.uid() OR o.technician_id = auth.uid())
         AND (
            EXISTS (SELECT 1 FROM unnest(COALESCE(o.media_urls,    ARRAY[]::text[])) u WHERE u LIKE '%' || objects.name)
         OR EXISTS (SELECT 1 FROM unnest(COALESCE(o.before_photos, ARRAY[]::text[])) u WHERE u LIKE '%' || objects.name)
         OR EXISTS (SELECT 1 FROM unnest(COALESCE(o.after_photos,  ARRAY[]::text[])) u WHERE u LIKE '%' || objects.name)
         )
    )
  )
);

DROP POLICY IF EXISTS "orders bucket: market listing photos visible" ON storage.objects;
CREATE POLICY "orders bucket: market listing photos visible"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'orders'
  AND objects.name LIKE 'market/%'
);
