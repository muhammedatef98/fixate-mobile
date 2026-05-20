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
  commissionRate: number;
  easternProvinceEnabled: boolean;
  serviceAreaMessageAr: string;
  serviceAreaMessageEn: string;
}

// Keys exposed to the admin platform-settings screen. Centralised here so
// adding a new knob is a one-line change.
export const PLATFORM_SETTINGS_KEYS = {
  inspectionFee: 'inspection_fee_default',
  returnFee: 'return_fee_default',
  commissionRate: 'platform_commission_rate',
  easternProvinceEnabled: 'eastern_province_enabled',
  serviceAreaMessageAr: 'service_areas_message_ar',
  serviceAreaMessageEn: 'service_areas_message_en',
} as const;

const boolFromValue = (raw: any, fallback: boolean): boolean => {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'string') return raw.toLowerCase() === 'true' || raw === '1';
  if (typeof raw === 'number') return raw !== 0;
  return fallback;
};

const DEFAULTS: PlatformSettings = {
  inspectionFee: DEFAULT_INSPECTION_FEE_SAR,
  returnFee: DEFAULT_RETURN_FEE_SAR,
  commissionRate: 0.15,
  easternProvinceEnabled: false,
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
    inspectionFee: numFromValue(raw[PLATFORM_SETTINGS_KEYS.inspectionFee], DEFAULTS.inspectionFee),
    returnFee: numFromValue(raw[PLATFORM_SETTINGS_KEYS.returnFee], DEFAULTS.returnFee),
    commissionRate: numFromValue(raw[PLATFORM_SETTINGS_KEYS.commissionRate], DEFAULTS.commissionRate),
    easternProvinceEnabled: boolFromValue(raw[PLATFORM_SETTINGS_KEYS.easternProvinceEnabled], DEFAULTS.easternProvinceEnabled),
    serviceAreaMessageAr: strFromValue(raw[PLATFORM_SETTINGS_KEYS.serviceAreaMessageAr], DEFAULTS.serviceAreaMessageAr),
    serviceAreaMessageEn: strFromValue(raw[PLATFORM_SETTINGS_KEYS.serviceAreaMessageEn], DEFAULTS.serviceAreaMessageEn),
  };
};

export const invalidatePlatformSettingsCache = () => {
  cache = null;
};

/**
 * Upsert a single platform_settings row by key. Stored as JSONB so number /
 * boolean / string values keep their native type for downstream consumers.
 * Relies on the existing RLS policy: `Only admins write platform settings`,
 * meaning the authenticated session must already be flagged is_admin = true.
 */
export const upsertPlatformSetting = async (
  key: string,
  value: number | string | boolean
): Promise<void> => {
  const { error } = await supabase
    .from('platform_settings')
    .upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
  if (error) {
    logger.warn('upsertPlatformSetting failed', { key, error });
    throw error;
  }
  // Bust the cache so the next read reflects the new value immediately.
  cache = null;
};

/**
 * Upsert several keys in one round-trip. Throws on the first failure so the
 * admin screen can surface a single error instead of partial state.
 */
export const upsertPlatformSettings = async (
  entries: Array<{ key: string; value: number | string | boolean }>
): Promise<void> => {
  if (entries.length === 0) return;
  const rows = entries.map((e) => ({
    key: e.key,
    value: e.value,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from('platform_settings')
    .upsert(rows, { onConflict: 'key' });
  if (error) {
    logger.warn('upsertPlatformSettings failed', error);
    throw error;
  }
  cache = null;
};
