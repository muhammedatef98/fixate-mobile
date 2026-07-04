/**
 * estimateService.ts — fetches the admin-tunable estimate config and exposes
 * a one-call helper for the request flow.
 *
 * Config lives in the existing admin-managed `platform_settings` table under
 * the key `pricing_estimates_v1` (JSONB):
 *
 *   {
 *     "issues": { "screen": { "typical": 300, "min": 220, "max": 1200 } },
 *     "regionMultipliers": { "RUH": 1.0, "EP": 0.95 },
 *     "globalMultiplier": 1
 *   }
 *
 * Missing key / malformed value → the engine silently falls back to the
 * curated baselines in constants/repairData. This is the plug point for a
 * future real market-data source (admin ranges → remote config → live data).
 */
import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';
import {
  computeEstimate,
  parseEstimateConfig,
  type EstimateConfig,
  type EstimateResult,
} from '../utils/estimate';
import type { Issue } from '../constants/repairData';
import type { SparePartQuality } from '../types/order';

export const PRICING_ESTIMATES_KEY = 'pricing_estimates_v1';

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { ts: number; config: EstimateConfig | null } | null = null;

export const getEstimateConfig = async (): Promise<EstimateConfig | null> => {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) return cache.config;
  try {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', PRICING_ESTIMATES_KEY)
      .maybeSingle();
    if (error) {
      logger.warn('estimate config unavailable, using baselines', error);
      return cache?.config ?? null;
    }
    const config = data ? parseEstimateConfig(data.value) : null;
    cache = { ts: Date.now(), config };
    return config;
  } catch (e) {
    logger.warn('estimate config load failed', e);
    return cache?.config ?? null;
  }
};

export const invalidateEstimateConfigCache = (): void => {
  cache = null;
};

/**
 * Starting estimate for an issue as selected in the request flow. Safe
 * fallback behaviour: any failure degrades to the issue-catalog baseline.
 */
export const estimateForIssue = async (
  issue: Pick<Issue, 'id' | 'estimatedPrice' | 'priceRange'>,
  opts?: { sparePartQuality?: SparePartQuality; regionCode?: string | null }
): Promise<EstimateResult> => {
  let config: EstimateConfig | null = null;
  try {
    config = await getEstimateConfig();
  } catch {
    config = null;
  }
  return computeEstimate({
    baseTypical: issue.estimatedPrice ?? 0,
    baseMin: issue.priceRange?.min,
    baseMax: issue.priceRange?.max,
    issueId: issue.id,
    sparePartQuality: opts?.sparePartQuality,
    regionCode: opts?.regionCode ?? null,
    config,
  });
};
