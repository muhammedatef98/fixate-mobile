import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';
import {
  DELIVERY_REGIONS,
  type DeliveryRegion,
  clampDeliveryFee,
  resolveDeliveryFee as resolveLocalFee,
} from '../constants/deliveryPricing';

// Delivery pricing access layer.
//
// Strategy: the bundled config (constants/deliveryPricing.ts) is the safe
// default. If a `delivery_pricing` table exists (admin/technician managed),
// its rows override the matching region's fees. Any failure (missing table,
// RLS, offline) silently falls back to the local config so the customer flow
// never breaks while the backend/admin side is still being built.

interface DeliveryPricingRow {
  region_id: string;
  area_id: string | null;
  fee: number;
  enabled: boolean;
}

let cache: { at: number; regions: DeliveryRegion[] } | null = null;
const CACHE_MS = 5 * 60 * 1000;

export const getDeliveryRegions = async (): Promise<DeliveryRegion[]> => {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.regions;

  try {
    const { data, error } = await supabase
      .from('delivery_pricing')
      .select('region_id, area_id, fee, enabled');

    if (error || !data || data.length === 0) {
      // Table not ready yet — use local config (expected during rollout).
      cache = { at: Date.now(), regions: DELIVERY_REGIONS };
      return DELIVERY_REGIONS;
    }

    const rows = data as DeliveryPricingRow[];
    const merged = DELIVERY_REGIONS.map((region) => {
      const regionRows = rows.filter((r) => r.region_id === region.id);
      if (regionRows.length === 0) return region;

      const regionLevel = regionRows.find((r) => !r.area_id);
      return {
        ...region,
        enabled: regionLevel ? regionLevel.enabled : region.enabled,
        baseFee: regionLevel ? clampDeliveryFee(regionLevel.fee) : region.baseFee,
        areas: region.areas.map((area) => {
          const override = regionRows.find((r) => r.area_id === area.id);
          return override ? { ...area, fee: clampDeliveryFee(override.fee) } : area;
        }),
      };
    });

    cache = { at: Date.now(), regions: merged };
    return merged;
  } catch (e) {
    logger.warn('getDeliveryRegions fell back to local config', e);
    return DELIVERY_REGIONS;
  }
};

/**
 * Resolve the delivery fee. Tries remote-aware regions first, then falls
 * back to the pure local resolver. Always safe to call.
 */
export const resolveDeliveryFee = async (
  regionId?: string | null,
  areaId?: string | null
): Promise<number> => {
  try {
    const regions = await getDeliveryRegions();
    const region = regions.find((r) => r.id === regionId);
    if (!region || !region.enabled) return 0;
    const area = region.areas.find((a) => a.id === areaId);
    return clampDeliveryFee(area ? area.fee : region.baseFee);
  } catch {
    return resolveLocalFee(regionId, areaId);
  }
};
