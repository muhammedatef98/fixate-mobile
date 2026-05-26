-- Expand the market_listings.device_type CHECK constraint to include
-- every type the app exposes today, plus the new `salvage` category
-- (بيع وشراء أجهزة التشليح). The original constraint only allowed the
-- v2-launch types (phone / laptop / tablet / watch / accessory / other),
-- but MARKET_DEVICE_TYPES in marketService.ts has long advertised
-- gaming / headphones / tv / appliance — listings with those values
-- would fail the CHECK. This migration realigns the DB with the app.

ALTER TABLE public.market_listings
  DROP CONSTRAINT IF EXISTS market_listings_device_type_check;

ALTER TABLE public.market_listings
  ADD CONSTRAINT market_listings_device_type_check
  CHECK (
    device_type IS NULL
    OR device_type IN (
      'phone',
      'laptop',
      'tablet',
      'watch',
      'gaming',
      'headphones',
      'tv',
      'appliance',
      'accessory',
      'salvage',
      'other'
    )
  );
