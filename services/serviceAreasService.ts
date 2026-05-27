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
  /**
   * Centroid coordinates used by the request-flow pin-to-city auto-detect.
   * Nullable: rows that haven't been backfilled yet fall back to the
   * `CITY_CENTROIDS` table in `utils/deliveryPricing.ts`. Long-term source
   * of truth is the DB so new cities are matchable without a code change.
   */
  lat?: number | null;
  lng?: number | null;
  /**
   * Self-referencing FK. When set, this city is administratively a sub-
   * area of `parent_city_id` and inherits its coverage state. Lets a
   * neighborhood (e.g. Saihat) be matched as its own row by nearest-
   * centroid yet still be treated as part of the canonical service area
   * (Qatif) downstream. Inheritance is one-way and never extends to
   * unrelated cities — only the explicit parent chain is followed.
   */
  parent_city_id?: string | null;
}

export interface RegionWithCities extends ServiceRegion {
  cities: ServiceCity[];
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

/** Full region→cities tree. `onlyEnabled` filters to live coverage — used
 *  by the customer repair request flow. */
export const getRegionTree = async (
  onlyEnabled = false
): Promise<RegionWithCities[]> => {
  const key = onlyEnabled ? 'enabled' : 'all';
  if (treeCache && treeCache.key === key && Date.now() - treeCache.ts < TREE_CACHE_TTL_MS) {
    return treeCache.value;
  }
  const [regions, cities] = await Promise.all([listRegions(), listCities()]);
  const tree = regions
    .filter((r) => (onlyEnabled ? r.enabled : true))
    .map((r) => ({
      ...r,
      cities: cities
        .filter((c) => c.region_id === r.id && (onlyEnabled ? c.enabled : true)),
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
  patch: Partial<Pick<ServiceCity, 'enabled' | 'delivery_fee' | 'sort_order'>>
): Promise<void> => {
  const { error } = await supabase.from('service_area_cities').update(patch).eq('id', id);
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
