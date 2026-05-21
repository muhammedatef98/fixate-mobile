import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

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
  const [regions, cities] = await Promise.all([listRegions(), listCities()]);
  return regions
    .filter((r) => (onlyEnabled ? r.enabled : true))
    .map((r) => ({
      ...r,
      cities: cities
        .filter((c) => c.region_id === r.id && (onlyEnabled ? c.enabled : true)),
    }));
};

export const updateRegion = async (
  id: string,
  patch: Partial<Pick<ServiceRegion, 'enabled' | 'sort_order'>>
): Promise<void> => {
  const { error } = await supabase.from('service_area_regions').update(patch).eq('id', id);
  if (error) throw error;
};

export const updateCity = async (
  id: string,
  patch: Partial<Pick<ServiceCity, 'enabled' | 'delivery_fee' | 'sort_order'>>
): Promise<void> => {
  const { error } = await supabase.from('service_area_cities').update(patch).eq('id', id);
  if (error) throw error;
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
};
