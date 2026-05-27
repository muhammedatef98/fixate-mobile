-- ============================================================================
-- Service area cities — geographic centroids
-- ----------------------------------------------------------------------------
-- The pin-to-city auto-detect in the customer request flow needs a centroid
-- for every city in `service_area_cities` so it can find the nearest *actual*
-- city to the dropped pin. Previously the centroids lived in a static
-- TypeScript lookup table (`utils/deliveryPricing.ts → CITY_CENTROIDS`) that
-- only covered ~15 major cities. That made the lookup non-generic: tiny
-- cities the admin might enable later wouldn't participate in matching.
--
-- This migration adds `lat` / `lng` columns to the cities table and backfills
-- the centroids we already know. The TS table stays as a fallback for now,
-- so existing rows without coordinates keep working until they get backfilled
-- via another migration or an admin edit.
--
-- All clauses are idempotent / safe to re-apply.
-- ============================================================================

ALTER TABLE public.service_area_cities
  ADD COLUMN IF NOT EXISTS lat numeric(9, 6),
  ADD COLUMN IF NOT EXISTS lng numeric(9, 6);

-- Partial index so the "any city with coordinates" lookups stay cheap as
-- the table grows. Postgres uses it when filtering NOT NULL.
CREATE INDEX IF NOT EXISTS service_area_cities_geo_idx
  ON public.service_area_cities (lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Backfill the centroids we already have hardcoded in the TS layer. We only
-- write rows that currently have NULL coordinates so an admin who's edited
-- a centroid in the DB never gets overwritten by re-running this.
--
-- Matched on `name_en` against the values seeded by the 2026_05_21 platform
-- foundation migration. Coordinates are OpenStreetMap centroids rounded to
-- 4 decimals (~11 m precision).
-- ---------------------------------------------------------------------------
UPDATE public.service_area_cities AS c
SET    lat = src.lat,
       lng = src.lng
FROM (VALUES
  ('Qatif',     26.5650, 50.0089),
  ('Dammam',    26.4207, 50.0888),
  ('Al Khobar', 26.2172, 50.1971),
  ('Dhahran',   26.2885, 50.1141),
  ('Jubail',    27.0046, 49.6580),
  ('Hofuf',     25.3837, 49.5870),
  ('Riyadh',    24.7136, 46.6753),
  ('Jeddah',    21.4858, 39.1925),
  ('Makkah',    21.3891, 39.8579),
  ('Madinah',   24.5247, 39.5692),
  ('Taif',      21.2854, 40.4183),
  ('Tabuk',     28.3838, 36.5550),
  ('Abha',      18.2164, 42.5053),
  ('Jazan',     16.8892, 42.5511)
) AS src(name_en, lat, lng)
WHERE  c.name_en = src.name_en
  AND  c.lat IS NULL
  AND  c.lng IS NULL;
