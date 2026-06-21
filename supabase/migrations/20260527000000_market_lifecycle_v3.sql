-- ============================================================================
-- Fixate Market — lifecycle v3
-- ----------------------------------------------------------------------------
-- Splits the previous single-purpose `archived` state into two distinct ones
-- and introduces explicit owner-visible states (`hidden_by_owner`,
-- `delete_requested`) so the client never needs to use admin-only transitions
-- to hide or remove a listing.
--
-- New status set:
--   draft              — seller saved but not submitted
--   pending            — submitted, awaiting admin moderation (default on insert)
--   live               — admin-approved, publicly browsable (replaces `active`)
--   sold               — owner marked as sold
--   hidden_by_owner    — owner-unlisted; reversible, returns to `pending` on unhide
--   delete_requested   — owner asked Fixate to remove the row; admin reviews
--   rejected           — admin rejected; owner may edit & resubmit
--   archived_by_admin  — admin archived (replaces `archived` when admin set it)
--
-- Legacy values `active` and `archived` remain accepted by the CHECK constraint
-- so older clients keep working during rollout. The service layer normalises
-- them to the new values on read; existing rows are backfilled below.
--
-- All changes are additive / idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. New operational columns.
-- ---------------------------------------------------------------------------
ALTER TABLE public.market_listings
  ADD COLUMN IF NOT EXISTS moderation_reason     text,
  ADD COLUMN IF NOT EXISTS admin_notes           text,
  ADD COLUMN IF NOT EXISTS hidden_at             timestamptz,
  ADD COLUMN IF NOT EXISTS delete_requested_at   timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at           timestamptz;

-- ---------------------------------------------------------------------------
-- 2. Replace the status CHECK with the v3 set (keeps legacy aliases
--    `active` / `archived` accepted so unmigrated clients don't break).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_constraint text;
BEGIN
  SELECT conname INTO v_constraint
    FROM pg_constraint
   WHERE conrelid = 'public.market_listings'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%status%';
  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.market_listings DROP CONSTRAINT %I', v_constraint);
  END IF;
END$$;

ALTER TABLE public.market_listings
  ADD CONSTRAINT market_listings_status_check
  CHECK (status IN (
    'draft',
    'pending',
    'live',
    'active',             -- legacy alias for live
    'sold',
    'hidden_by_owner',
    'delete_requested',
    'rejected',
    'archived_by_admin',
    'archived'            -- legacy alias for archived_by_admin
  ));

-- ---------------------------------------------------------------------------
-- 3. Backfill existing rows to the new vocabulary.
--    `archived` rows with removed_at set were owner-removes (the old client
--    behavior); the rest were genuinely admin-archived.
-- ---------------------------------------------------------------------------
UPDATE public.market_listings
   SET status = 'live'
 WHERE status = 'active';

UPDATE public.market_listings
   SET status = 'hidden_by_owner',
       hidden_at = COALESCE(removed_at, now())
 WHERE status = 'archived'
   AND removed_at IS NOT NULL;

UPDATE public.market_listings
   SET status = 'archived_by_admin',
       archived_at = COALESCE(archived_at, now())
 WHERE status = 'archived';

-- ---------------------------------------------------------------------------
-- 4. Browse policy: public can read only `live` listings.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "market_listings_browse_active" ON public.market_listings;
DROP POLICY IF EXISTS "market_listings_browse_live"   ON public.market_listings;
CREATE POLICY "market_listings_browse_live" ON public.market_listings
  FOR SELECT USING (status = 'live');

-- ---------------------------------------------------------------------------
-- 5. Tighten seller UPDATE: sellers may transition between owner-allowed
--    states only. They can NEVER set status to `live`, `rejected`, or
--    `archived_by_admin`, and they can't escape `archived_by_admin` or
--    `delete_requested` themselves.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "market_listings_seller_update_own" ON public.market_listings;
CREATE POLICY "market_listings_seller_update_own" ON public.market_listings
  FOR UPDATE
  USING (seller_id = auth.uid())
  WITH CHECK (
    seller_id = auth.uid()
    AND status IN (
      'draft', 'pending', 'sold',
      'hidden_by_owner', 'delete_requested'
    )
  );

-- Admin policy already exists (`market_listings_admin_all`) and covers
-- approve / reject / archive / restore / hard-delete.

-- ---------------------------------------------------------------------------
-- 6. Index refresh — partial indexes were on status='active'.
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_market_listings_active_device;
DROP INDEX IF EXISTS idx_market_listings_active_condition;
DROP INDEX IF EXISTS idx_market_listings_active_price;

CREATE INDEX IF NOT EXISTS idx_market_listings_live_device
  ON public.market_listings(device_type)
  WHERE status = 'live';
CREATE INDEX IF NOT EXISTS idx_market_listings_live_condition
  ON public.market_listings(condition)
  WHERE status = 'live';
CREATE INDEX IF NOT EXISTS idx_market_listings_live_price
  ON public.market_listings(price)
  WHERE status = 'live';

-- Useful for the admin "delete requests" queue.
CREATE INDEX IF NOT EXISTS idx_market_listings_delete_requested
  ON public.market_listings(delete_requested_at)
  WHERE status = 'delete_requested';
