-- Fixate Market — Haraj-style enrichment.
--
-- Adds the structured columns the new browse + detail screens use to
-- filter, sort, and label listings:
--   - device_type      (phone / laptop / tablet / watch / accessory / other)
--   - condition        (new / like_new / used / refurbished / for_parts)
--   - contact_methods  (text[] of whatsapp/phone/in_app)
--
-- All clauses are IF (NOT) EXISTS so it's safe to re-apply on databases
-- that already have any subset of the columns. Old rows keep the existing
-- contact_phone / contact_preference values; the app falls back to those
-- when contact_methods is empty.

ALTER TABLE public.market_listings
  ADD COLUMN IF NOT EXISTS device_type text,
  ADD COLUMN IF NOT EXISTS condition   text,
  ADD COLUMN IF NOT EXISTS contact_methods text[] NOT NULL DEFAULT ARRAY['in_app']::text[];

-- Enforce the allowed values without breaking rows that have NULL
-- (NULL = "not specified", which is fine for legacy listings).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
     WHERE table_schema='public' AND table_name='market_listings'
       AND constraint_name='market_listings_condition_check'
  ) THEN
    ALTER TABLE public.market_listings
      ADD CONSTRAINT market_listings_condition_check
      CHECK (condition IS NULL OR condition IN ('new','like_new','used','refurbished','for_parts'));
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
     WHERE table_schema='public' AND table_name='market_listings'
       AND constraint_name='market_listings_device_type_check'
  ) THEN
    ALTER TABLE public.market_listings
      ADD CONSTRAINT market_listings_device_type_check
      CHECK (device_type IS NULL OR device_type IN ('phone','laptop','tablet','watch','accessory','other'));
  END IF;
END$$;

-- Filtering indexes — partial on status='active' since browse only
-- fetches active rows and these indexes shouldn't bloat for hidden ones.
CREATE INDEX IF NOT EXISTS idx_market_listings_active_device
  ON public.market_listings(device_type)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_market_listings_active_condition
  ON public.market_listings(condition)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_market_listings_active_price
  ON public.market_listings(price)
  WHERE status = 'active';
