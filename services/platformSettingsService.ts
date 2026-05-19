import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';
import {
  DEFAULT_INSPECTION_FEE_SAR,
  DEFAULT_RETURN_FEE_SAR,
} from '../constants/fees';

// Tiny in-memory cache so paying-attention screens don't hammer the DB.
// 5 minutes is generous: admins will rarely change these values.
const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { ts: number; values: Record<string, any> } | null = null;

const numFromValue = (raw: any, fallback: number): number => {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
};

const strFromValue = (raw: any, fallback: string): string => {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === 'string') return raw;
  return String(raw);
};

export interface PlatformSettings {
  inspectionFee: number;
  returnFee: number;
  serviceAreaMessageAr: string;
  serviceAreaMessageEn: string;
}

const DEFAULTS: PlatformSettings = {
  inspectionFee: DEFAULT_INSPECTION_FEE_SAR,
  returnFee: DEFAULT_RETURN_FEE_SAR,
  serviceAreaMessageAr:
    'الخدمة حالياً في القطيف والمناطق القريبة فقط، وقريباً سنغطي كامل المنطقة الشرقية ثم جميع مناطق المملكة',
  serviceAreaMessageEn:
    'Service is currently available in Al Qatif and nearby areas only. Soon we will expand across the Eastern Province and then all of Saudi Arabia.',
};

const loadRaw = async (): Promise<Record<string, any>> => {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) return cache.values;
  try {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('key, value');
    if (error || !data) {
      logger.warn('platform_settings unavailable, using defaults', error);
      return {};
    }
    const map: Record<string, any> = {};
    for (const row of data as { key: string; value: any }[]) {
      map[row.key] = row.value;
    }
    cache = { ts: Date.now(), values: map };
    return map;
  } catch (e) {
    logger.warn('platform_settings load failed', e);
    return {};
  }
};

export const getPlatformSettings = async (): Promise<PlatformSettings> => {
  const raw = await loadRaw();
  return {
    inspectionFee: numFromValue(raw['inspection_fee_default'], DEFAULTS.inspectionFee),
    returnFee: numFromValue(raw['return_fee_default'], DEFAULTS.returnFee),
    serviceAreaMessageAr: strFromValue(raw['service_areas_message_ar'], DEFAULTS.serviceAreaMessageAr),
    serviceAreaMessageEn: strFromValue(raw['service_areas_message_en'], DEFAULTS.serviceAreaMessageEn),
  };
};

export const invalidatePlatformSettingsCache = () => {
  cache = null;
};
