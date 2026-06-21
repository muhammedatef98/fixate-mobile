-- ============================================================================
-- Marketplace soft-delete metadata
-- ----------------------------------------------------------------------------
-- Sellers can already update their own listing's status to 'archived' via the
-- existing RLS policies. This migration adds operational metadata so admins
-- can later review *when* and *why* a listing was removed by its owner —
-- useful for dispute resolution, abuse review, and quality control.
--
-- The columns are additive and nullable so existing rows / inserts continue
-- to work unchanged.
-- ============================================================================

ALTER TABLE public.market_listings
  ADD COLUMN IF NOT EXISTS removed_at     timestamptz,
  ADD COLUMN IF NOT EXISTS removed_reason text;

-- Helpful when admin filters the moderation queue by recently-removed.
CREATE INDEX IF NOT EXISTS market_listings_removed_at_idx
  ON public.market_listings (removed_at)
  WHERE removed_at IS NOT NULL;
