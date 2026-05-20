-- Market overhaul: add structured device + condition columns and a
-- richer contact_method column so listings carry the seller's exact
-- preference (WhatsApp vs phone vs in-app DM, plus combinations).
--
-- Existing data:
--   - market_listings.contact_preference was added in
--     2026_05_20_phase2_commitment_broadcasts_market.sql with values
--     'dm' | 'phone' | 'both'. We migrate those values into the new
--     `contact_methods` text[] column and then drop the old column.
--   - description used to carry a "Condition: …" prefix line.
--     We add a real `condition` column; existing rows keep the prefix
--     in their description as a fallback.

ALTER TABLE public.market_listings
  ADD COLUMN IF NOT EXISTS device_type    text,
  ADD COLUMN IF NOT EXISTS condition      text
    CHECK (condition IN ('new','like_new','used','refurbished','for_parts')),
  ADD COLUMN IF NOT EXISTS contact_methods text[] NOT NULL DEFAULT ARRAY['in_app']::text[];

-- Backfill contact_methods from the older `contact_preference` if present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'market_listings'
       AND column_name = 'contact_preference'
  ) THEN
    UPDATE public.market_listings
       SET contact_methods = CASE
         WHEN contact_preference = 'phone' THEN ARRAY['phone','whatsapp']::text[]
         WHEN contact_preference = 'dm'    THEN ARRAY['in_app']::text[]
         WHEN contact_preference = 'both'  THEN ARRAY['phone','whatsapp','in_app']::text[]
         ELSE ARRAY['in_app']::text[]
       END
     WHERE contact_methods IS NULL
        OR contact_methods = ARRAY['in_app']::text[];
  END IF;
END$$;

-- Helpful indexes for the browse screen filters.
CREATE INDEX IF NOT EXISTS idx_market_listings_device_type
  ON public.market_listings(device_type)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_market_listings_condition
  ON public.market_listings(condition)
  WHERE status = 'active';
