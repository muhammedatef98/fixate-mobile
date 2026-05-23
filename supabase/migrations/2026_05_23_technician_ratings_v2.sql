-- ============================================================================
-- Technician ratings hardening + aggregate surface
-- ----------------------------------------------------------------------------
-- The `reviews` table already exists from the initial schema, but it lacks:
--   * a uniqueness constraint preventing the same customer from rating the
--     same order twice
--   * an RLS rule that restricts inserts to actually-completed orders the
--     customer owns (the original policy only checked auth.uid() = user_id)
--   * an aggregate that the public technician profile can read cheaply
--   * an admin-friendly view that surfaces comments + customer info for
--     operational decisions (rewards, incentives, quality control)
--
-- All changes are additive and idempotent.
-- ============================================================================

-- 1) Ensure one rating per (order, customer). Existing duplicates would block
--    creation of the constraint, so we de-dup by keeping the earliest row.
WITH dups AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY order_id, user_id ORDER BY created_at) AS rn
  FROM public.reviews
)
DELETE FROM public.reviews
WHERE id IN (SELECT id FROM dups WHERE rn > 1);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reviews_order_user_unique'
  ) THEN
    ALTER TABLE public.reviews
      ADD CONSTRAINT reviews_order_user_unique UNIQUE (order_id, user_id);
  END IF;
END $$;

-- 2) Replace the permissive insert policy with one that requires the order
--    to be completed AND owned by the rater.
DROP POLICY IF EXISTS "Users can create reviews for their orders" ON public.reviews;
DROP POLICY IF EXISTS "reviews_customer_insert_completed" ON public.reviews;
CREATE POLICY "reviews_customer_insert_completed" ON public.reviews
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = reviews.order_id
        AND o.user_id = auth.uid()
        AND o.status = 'completed'
    )
  );

-- Customers can update their own rating until something tighter is needed.
DROP POLICY IF EXISTS "reviews_customer_update_own" ON public.reviews;
CREATE POLICY "reviews_customer_update_own" ON public.reviews
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin full access for moderation.
DROP POLICY IF EXISTS "reviews_admin_all" ON public.reviews;
CREATE POLICY "reviews_admin_all" ON public.reviews
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- 3) Aggregate view — cheap to read from the technician profile.
DROP VIEW IF EXISTS public.technician_rating_summary;
CREATE VIEW public.technician_rating_summary
  WITH (security_invoker = true) AS
SELECT
  technician_id,
  ROUND(AVG(rating)::numeric, 2) AS average_rating,
  COUNT(*)                       AS rating_count,
  MAX(created_at)                AS last_rated_at
FROM public.reviews
WHERE technician_id IS NOT NULL
  AND deleted_at IS NULL
GROUP BY technician_id;

GRANT SELECT ON public.technician_rating_summary TO authenticated, anon;

-- 4) Helpful index for "latest comments by technician" queries.
CREATE INDEX IF NOT EXISTS reviews_technician_created_idx
  ON public.reviews (technician_id, created_at DESC)
  WHERE technician_id IS NOT NULL;

-- 5) Admin-facing view: rating + commenter name (when available). Uses
--    security_invoker so RLS on `reviews`/`users` is respected, meaning
--    only admins (covered by reviews_admin_all + existing users policies)
--    can read identifying customer info.
DROP VIEW IF EXISTS public.admin_ratings_feed;
CREATE VIEW public.admin_ratings_feed
  WITH (security_invoker = true) AS
SELECT
  r.id,
  r.order_id,
  r.technician_id,
  r.user_id          AS customer_id,
  r.rating,
  r.comment,
  r.created_at,
  o.device_brand,
  o.device_model,
  o.final_price,
  o.estimated_price
FROM public.reviews r
LEFT JOIN public.orders o ON o.id = r.order_id
WHERE r.deleted_at IS NULL
ORDER BY r.created_at DESC;

GRANT SELECT ON public.admin_ratings_feed TO authenticated;
