-- Let approved technicians preview the customer's request photos on
-- pending, unassigned orders, so they can judge the job before accepting.
--
-- Scope is deliberately narrow:
--   * read-only (SELECT), `orders` bucket only;
--   * only objects referenced by orders.media_urls (the customer's request
--     photos) -- not chat images (chat-%), technician before/after photos
--     (orders/%) or market photos (market/%);
--   * only while the order is still pending with no technician assigned;
--     access ends for everyone else the moment someone accepts it;
--   * only approved, non-deleted technicians that are not excluded or
--     suspended (same exclusions the available-orders screen applies).

CREATE POLICY "orders bucket: approved technicians preview pending order photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'orders'
  AND name NOT LIKE 'orders/%'
  AND name NOT LIKE 'chat-%'
  AND name NOT LIKE 'market/%'
  AND EXISTS (
    SELECT 1
    FROM public.technicians t
    WHERE t.user_id = (SELECT auth.uid())
      AND t.verification_status IN ('approved', 'verified')
      AND t.deleted_at IS NULL
      AND COALESCE(t.technician_status, '') NOT IN ('excluded', 'suspended')
  )
  AND EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.status = 'pending'
      AND o.technician_id IS NULL
      AND EXISTS (
        SELECT 1
        FROM unnest(COALESCE(o.media_urls, ARRAY[]::text[])) AS u(url)
        WHERE right(u.url, length(storage.objects.name) + 8) = '/orders/' || storage.objects.name
      )
  )
);
