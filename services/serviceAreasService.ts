import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

// In-memory cache for the full region tree. The customer-facing city
// picker hits this on every modal open, so we cache for 5 minutes — long
// enough to avoid spamming the DB, short enough that an admin's coverage
// change is visible to customers within minutes. The admin save handlers
// also call `invalidateServiceAreasCache()` directly for instant refresh.
const TREE_CACHE_TTL_MS = 5 * 60 * 1000;
let treeCache: { ts: number; key: 'all' | 'enabled'; value: RegionWithCities[] } | null = null;

export const invalidateServiceAreasCache = (): void => {
  treeCache = null;
};

export interface ServiceRegion {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  enabled: boolean;
  sort_order: number;
}

export interface ServiceCity {
  id: string;
  region_id: string;
  name_ar: string;
  name_en: string;
  enabled: boolean;
  delivery_fee: number;
  sort_order: number;
  // Coverage geometry — optional, populated via admin map editor.
  // MIGRATION (run manually in Supabase, not auto-applied):
  //   ALTER TABLE service_area_cities
  //     ADD COLUMN IF NOT EXISTS center_lat  FLOAT,
  //     ADD COLUMN IF NOT EXISTS center_lng  FLOAT,
  //     ADD COLUMN IF NOT EXISTS radius_km   FLOAT;
  center_lat?: number | null;
  center_lng?: number | null;
  radius_km?: number | null;
}

// Neighborhoods are the third pricing tier (Region → City → Neighborhood).
// A neighborhood fee overrides the city default when both exist.
//
// MIGRATION (run manually in Supabase, not auto-applied):
//   CREATE TABLE IF NOT EXISTS service_area_neighborhoods (
//     id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//     city_id       uuid NOT NULL REFERENCES service_area_cities(id) ON DELETE CASCADE,
//     name_ar       text NOT NULL,
//     name_en       text NOT NULL,
//     enabled       boolean NOT NULL DEFAULT true,
//     delivery_fee  numeric NOT NULL DEFAULT 0,
//     sort_order    int NOT NULL DEFAULT 0,
//     created_at    timestamptz DEFAULT now()
//   );
//   CREATE INDEX IF NOT EXISTS service_area_neighborhoods_city_idx
//     ON service_area_neighborhoods(city_id);
export interface ServiceNeighborhood {
  id: string;
  city_id: string;
  name_ar: string;
  name_en: string;
  enabled: boolean;
  delivery_fee: number;
  sort_order: number;
}

export interface CityWithNeighborhoods extends ServiceCity {
  neighborhoods: ServiceNeighborhood[];
}

export interface RegionWithCities extends ServiceRegion {
  cities: CityWithNeighborhoods[];
}

export const listRegions = async (): Promise<ServiceRegion[]> => {
  try {
    const { data, error } = await supabase
      .from('service_area_regions')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data ?? []) as ServiceRegion[];
  } catch (e) {
    logger.warn('listRegions failed', e);
    return [];
  }
};

export const listCities = async (regionId?: string): Promise<ServiceCity[]> => {
  try {
    let q = supabase
      .from('service_area_cities')
      .select('*')
      .order('sort_order', { ascending: true });
    if (regionId) q = q.eq('region_id', regionId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as ServiceCity[];
  } catch (e) {
    logger.warn('listCities failed', e);
    return [];
  }
};

export const listNeighborhoods = async (cityId?: string): Promise<ServiceNeighborhood[]> => {
  try {
    let q = supabase
      .from('service_area_neighborhoods')
      .select('*')
      .order('sort_order', { ascending: true });
    if (cityId) q = q.eq('city_id', cityId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as ServiceNeighborhood[];
  } catch (e) {
    // Table may not exist yet on older deployments — degrade gracefully
    // so the admin and customer flows keep working with city-level fees.
    logger.warn('listNeighborhoods failed (table may be missing)', e);
    return [];
  }
};

/** Full region→cities→neighborhoods tree. `onlyEnabled` filters to live
 *  coverage — used by the customer repair request flow. */
export const getRegionTree = async (
  onlyEnabled = false
): Promise<RegionWithCities[]> => {
  const key = onlyEnabled ? 'enabled' : 'all';
  if (treeCache && treeCache.key === key && Date.now() - treeCache.ts < TREE_CACHE_TTL_MS) {
    return treeCache.value;
  }
  const [regions, cities, neighborhoods] = await Promise.all([
    listRegions(),
    listCities(),
    listNeighborhoods(),
  ]);
  const tree: RegionWithCities[] = regions
    .filter((r) => (onlyEnabled ? r.enabled : true))
    .map((r) => ({
      ...r,
      cities: cities
        .filter((c) => c.region_id === r.id && (onlyEnabled ? c.enabled : true))
        .map((c) => ({
          ...c,
          neighborhoods: neighborhoods
            .filter((n) => n.city_id === c.id && (onlyEnabled ? n.enabled : true)),
        })),
    }));
  treeCache = { ts: Date.now(), key, value: tree };
  return tree;
};

export const updateRegion = async (
  id: string,
  patch: Partial<Pick<ServiceRegion, 'enabled' | 'sort_order'>>
): Promise<void> => {
  const { error } = await supabase.from('service_area_regions').update(patch).eq('id', id);
  if (error) throw error;
  invalidateServiceAreasCache();
};

export const updateCity = async (
  id: string,
  patch: Partial<Pick<
    ServiceCity,
    'enabled' | 'delivery_fee' | 'sort_order' | 'center_lat' | 'center_lng' | 'radius_km'
  >>
): Promise<void> => {
  const { error } = await supabase.from('service_area_cities').update(patch).eq('id', id);
  if (error) throw error;
  invalidateServiceAreasCache();
};

export const updateNeighborhood = async (
  id: string,
  patch: Partial<Pick<ServiceNeighborhood, 'enabled' | 'delivery_fee' | 'sort_order'>>
): Promise<void> => {
  const { error } = await supabase.from('service_area_neighborhoods').update(patch).eq('id', id);
  if (error) throw error;
  invalidateServiceAreasCache();
};

/** Enable/disable every city in a region in one call (admin convenience). */
export const setRegionCitiesEnabled = async (
  regionId: string,
  enabled: boolean
): Promise<void> => {
  const { error } = await supabase
    .from('service_area_cities')
    .update({ enabled })
    .eq('region_id', regionId);
  if (error) throw error;
  invalidateServiceAreasCache();
};

/**
 * Resolve the effective delivery fee for a (city, neighborhood) pair.
 *
 * Priority: enabled-neighborhood fee > city fee > 0.
 * `neighborhoodName` is matched case-insensitively against the Arabic OR
 * English name on the city's neighborhoods, so callers can pass the raw
 * geocoded district string without worrying about language.
 */
export const resolveDeliveryFee = (
  city: CityWithNeighborhoods | null | undefined,
  neighborhoodName: string | null | undefined
): number => {
  if (!city) return 0;
  const name = (neighborhoodName ?? '').trim().toLowerCase();
  if (name) {
    const match = city.neighborhoods.find(
      (n) =>
        n.enabled &&
        (n.name_ar.trim().toLowerCase() === name ||
          n.name_en.trim().toLowerCase() === name)
    );
    if (match) return Number(match.delivery_fee ?? 0);
  }
  return Number(city.delivery_fee ?? 0);
};
