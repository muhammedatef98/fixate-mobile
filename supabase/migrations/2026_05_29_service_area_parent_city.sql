-- ============================================================================
-- Service area cities — parent-city hierarchy
-- ----------------------------------------------------------------------------
-- Centroid-only matching can't capture administrative reality: a neighborhood
-- like Saihat sits geographically closer to Dammam (~8 km) than to Qatif
-- (~10 km), even though it administratively belongs to Qatif governorate.
-- Pure nearest-centroid logic therefore mis-classified Saihat pins as
-- "Dammam" (which is disabled) → rejected, even with Qatif enabled.
--
-- This migration adds an explicit `parent_city_id` so child neighborhoods
-- can inherit coverage from their canonical governorate. The request-flow
-- matcher walks the parent chain when the nearest city is itself disabled,
-- and uses the parent's id downstream so delivery fee / order routing
-- follows the canonical service area (Qatif), not the matched neighborhood.
--
-- Inheritance is one-way (child → parent only) and never extends to
-- unrelated nearby cities. Dammam has no parent → enabling Qatif never
-- pulls Dammam into coverage.
--
-- All clauses are idempotent.
-- ============================================================================

ALTER TABLE public.service_area_cities
  ADD COLUMN IF NOT EXISTS parent_city_id uuid
    REFERENCES public.service_area_cities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS service_area_cities_parent_idx
  ON public.service_area_cities (parent_city_id)
  WHERE parent_city_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Backfill: Saihat, Safwa, Tarout are administratively part of Qatif
-- governorate. Linking them lets them inherit Qatif's enabled state without
-- having to be independently toggled by the admin.
-- ---------------------------------------------------------------------------
UPDATE public.service_area_cities AS child
SET    parent_city_id = parent.id
FROM   public.service_area_cities AS parent
WHERE  parent.name_en = 'Qatif'
  AND  child.region_id = parent.region_id
  AND  child.name_en IN ('Saihat', 'Safwa', 'Tarout')
  AND  child.parent_city_id IS NULL;

-- ---------------------------------------------------------------------------
-- Centroid backfill for the linked neighborhoods so the nearest-match step
-- can resolve them directly (more accurate than always snapping to the
-- parent's centroid). OpenStreetMap centroids rounded to 4 decimals.
-- Only writes rows that don't already have coordinates.
-- ---------------------------------------------------------------------------
UPDATE public.service_area_cities AS c
SET    lat = src.lat,
       lng = src.lng
FROM (VALUES
  ('Saihat', 26.4756, 50.0383),
  ('Safwa',  26.6531, 49.9554),
  ('Tarout', 26.5750, 50.0667)
) AS src(name_en, lat, lng)
WHERE  c.name_en = src.name_en
  AND  c.lat IS NULL
  AND  c.lng IS NULL;
