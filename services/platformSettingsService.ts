import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';
import { DEFAULT_RETURN_FEE_SAR } from '../constants/fees';

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

export interface LoyaltyTierConfig {
  id: string;
  points: number;
  category: 'accessory' | 'repair';
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  valueSAR: number;
}

export interface LoyaltySettings {
  enabled: boolean;
  pointsPerSAR: number;
  redeemMin: number;
  redeemRate: number;
  redeemMaxPct: number;
  tiers: LoyaltyTierConfig[];
}

export interface PlatformSettings {
  inspectionFee: number;
  inspectionEnabled: boolean;
  returnFee: number;
  commissionRate: number;
  easternProvinceEnabled: boolean;
  serviceAreaMessageAr: string;
  serviceAreaMessageEn: string;
  loyalty: LoyaltySettings;
  commitmentFee: number;
  commitmentEnabled: boolean;
  maintenanceMode: boolean;
  announcementEnabled: boolean;
  announcementAr: string;
  announcementEn: string;
  minAppVersion: string;
  // External / push notifications master switch. Off by default — the app
  // only sends in-app notifications until this is turned on (for a future
  // App Store / Google Play launch).
  pushNotificationsEnabled: boolean;
  // Customer rating + comment capture on completed orders. On by default;
  // ops can flip off to hide the rating UI without a code change.
  ratingsEnabled: boolean;
  // Marketplace master switch. On by default; ops can flip off to hide
  // browse/create flows during incidents or App Review.
  marketplaceEnabled: boolean;
}

export const PLATFORM_SETTINGS_KEYS = {
  inspectionFee: 'inspection_fee_default',
  inspectionEnabled: 'inspection_enabled',
  returnFee: 'return_fee_default',
  commissionRate: 'platform_commission_rate',
  easternProvinceEnabled: 'eastern_province_enabled',
  serviceAreaMessageAr: 'service_areas_message_ar',
  serviceAreaMessageEn: 'service_areas_message_en',
  loyaltyEnabled: 'loyalty_enabled',
  loyaltyPointsPerSAR: 'loyalty_points_per_sar',
  loyaltyRedeemMin: 'loyalty_redeem_min',
  loyaltyRedeemRate: 'loyalty_redeem_rate',
  loyaltyRedeemMaxPct: 'loyalty_redeem_max_pct',
  loyaltyTiers: 'loyalty_tiers',
  commitmentFee: 'commitment_fee_default',
  commitmentEnabled: 'commitment_enabled',
  maintenanceMode: 'maintenance_mode',
  announcementEnabled: 'announcement_enabled',
  announcementAr: 'announcement_ar',
  announcementEn: 'announcement_en',
  minAppVersion: 'min_app_version',
  pushNotificationsEnabled: 'push_notifications_enabled',
  ratingsEnabled: 'ratings_enabled',
  marketplaceEnabled: 'marketplace_enabled',
} as const;

const boolFromValue = (raw: any, fallback: boolean): boolean => {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'string') return raw.toLowerCase() === 'true' || raw === '1';
  if (typeof raw === 'number') return raw !== 0;
  return fallback;
};

const DEFAULT_LOYALTY: LoyaltySettings = {
  enabled: true,
  pointsPerSAR: 1,
  redeemMin: 500,
  redeemRate: 0.1,
  redeemMaxPct: 0.3,
  tiers: [
    { id: 'tier_500',  points: 500,  category: 'accessory', titleAr: 'خصم على إكسسوار صغير',          titleEn: 'Small accessory discount',                 descAr: 'استبدل نقاطك بخصم على إكسسوار صغير',           descEn: 'Redeem points for a discount on a small accessory',          valueSAR: 15 },
    { id: 'tier_1000', points: 1000, category: 'repair',    titleAr: 'إكسسوار أكبر أو خصم إصلاح',     titleEn: 'Larger accessory or repair discount',      descAr: 'خصم أكبر على إكسسوار أو على فاتورة الإصلاح',    descEn: 'A larger accessory or a discount on a repair invoice',       valueSAR: 35 },
    { id: 'tier_2000', points: 2000, category: 'repair',    titleAr: 'مكافأة مميزة أو خصم إصلاح كبير', titleEn: 'Premium reward or large repair discount', descAr: 'مكافأة مميزة أو خصم كبير على فاتورة إصلاح',     descEn: 'A premium reward or a large repair-invoice discount',        valueSAR: 80 },
  ],
};

const tiersFromValue = (raw: any, fallback: LoyaltyTierConfig[]): LoyaltyTierConfig[] => {
  if (Array.isArray(raw)) {
    const cleaned = raw
      .filter((t) => t && typeof t === 'object' && typeof t.id === 'string' && typeof t.points === 'number')
      .map((t: any) => ({
        id: String(t.id),
        points: Math.max(0, Math.floor(Number(t.points) || 0)),
        category: t.category === 'repair' ? 'repair' : 'accessory',
        titleAr: String(t.titleAr ?? ''),
        titleEn: String(t.titleEn ?? ''),
        descAr: String(t.descAr ?? ''),
        descEn: String(t.descEn ?? ''),
        valueSAR: Math.max(0, Number(t.valueSAR) || 0),
      })) as LoyaltyTierConfig[];
    return cleaned.length ? cleaned : fallback;
  }
  if (typeof raw === 'string') {
    try {
      return tiersFromValue(JSON.parse(raw), fallback);
    } catch {
      return fallback;
    }
  }
  return fallback;
};

const DEFAULTS: PlatformSettings = {
  // Inspection is free by default; admins can enable a fee from settings.
  inspectionFee: 0,
  inspectionEnabled: false,
  returnFee: DEFAULT_RETURN_FEE_SAR,
  commissionRate: 0.15,
  easternProvinceEnabled: false,
  serviceAreaMessageAr:
    'الخدمة حالياً في القطيف والمناطق القريبة فقط، وقريباً سنغطي كامل المنطقة الشرقية ثم جميع مناطق المملكة',
  serviceAreaMessageEn:
    'Service is currently available in Al Qatif and nearby areas only. Soon we will expand across the Eastern Province and then all of Saudi Arabia.',
  loyalty: DEFAULT_LOYALTY,
  commitmentFee: 50,
  // Confirmation (commitment) amount is disabled by default.
  commitmentEnabled: false,
  maintenanceMode: false,
  announcementEnabled: false,
  announcementAr: '',
  announcementEn: '',
  minAppVersion: '',
  pushNotificationsEnabled: false,
  ratingsEnabled: true,
  marketplaceEnabled: true,
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
    inspectionEnabled: boolFromValue(raw[PLATFORM_SETTINGS_KEYS.inspectionEnabled], DEFAULTS.inspectionEnabled),
    returnFee: numFromValue(raw[PLATFORM_SETTINGS_KEYS.returnFee], DEFAULTS.returnFee),
    commissionRate: numFromValue(raw[PLATFORM_SETTINGS_KEYS.commissionRate], DEFAULTS.commissionRate),
    easternProvinceEnabled: boolFromValue(raw[PLATFORM_SETTINGS_KEYS.easternProvinceEnabled], DEFAULTS.easternProvinceEnabled),
    serviceAreaMessageAr: strFromValue(raw[PLATFORM_SETTINGS_KEYS.serviceAreaMessageAr], DEFAULTS.serviceAreaMessageAr),
    serviceAreaMessageEn: strFromValue(raw[PLATFORM_SETTINGS_KEYS.serviceAreaMessageEn], DEFAULTS.serviceAreaMessageEn),
    loyalty: {
      enabled: boolFromValue(raw[PLATFORM_SETTINGS_KEYS.loyaltyEnabled], DEFAULT_LOYALTY.enabled),
      pointsPerSAR: numFromValue(raw[PLATFORM_SETTINGS_KEYS.loyaltyPointsPerSAR], DEFAULT_LOYALTY.pointsPerSAR),
      redeemMin: numFromValue(raw[PLATFORM_SETTINGS_KEYS.loyaltyRedeemMin], DEFAULT_LOYALTY.redeemMin),
      redeemRate: numFromValue(raw[PLATFORM_SETTINGS_KEYS.loyaltyRedeemRate], DEFAULT_LOYALTY.redeemRate),
      redeemMaxPct: numFromValue(raw[PLATFORM_SETTINGS_KEYS.loyaltyRedeemMaxPct], DEFAULT_LOYALTY.redeemMaxPct),
      tiers: tiersFromValue(raw[PLATFORM_SETTINGS_KEYS.loyaltyTiers], DEFAULT_LOYALTY.tiers),
    },
    commitmentFee: numFromValue(raw[PLATFORM_SETTINGS_KEYS.commitmentFee], DEFAULTS.commitmentFee),
    commitmentEnabled: boolFromValue(raw[PLATFORM_SETTINGS_KEYS.commitmentEnabled], DEFAULTS.commitmentEnabled),
    maintenanceMode: boolFromValue(raw[PLATFORM_SETTINGS_KEYS.maintenanceMode], DEFAULTS.maintenanceMode),
    announcementEnabled: boolFromValue(raw[PLATFORM_SETTINGS_KEYS.announcementEnabled], DEFAULTS.announcementEnabled),
    announcementAr: strFromValue(raw[PLATFORM_SETTINGS_KEYS.announcementAr], DEFAULTS.announcementAr),
    announcementEn: strFromValue(raw[PLATFORM_SETTINGS_KEYS.announcementEn], DEFAULTS.announcementEn),
    minAppVersion: strFromValue(raw[PLATFORM_SETTINGS_KEYS.minAppVersion], DEFAULTS.minAppVersion),
    pushNotificationsEnabled: boolFromValue(raw[PLATFORM_SETTINGS_KEYS.pushNotificationsEnabled], DEFAULTS.pushNotificationsEnabled),
    ratingsEnabled: boolFromValue(raw[PLATFORM_SETTINGS_KEYS.ratingsEnabled], DEFAULTS.ratingsEnabled),
    marketplaceEnabled: boolFromValue(raw[PLATFORM_SETTINGS_KEYS.marketplaceEnabled], DEFAULTS.marketplaceEnabled),
  };
};

/**
 * Lightweight standalone loyalty getter — used by loyalty UI / context which
 * don't need the full settings payload.
 */
export const getLoyaltySettings = async (): Promise<LoyaltySettings> => {
  return (await getPlatformSettings()).loyalty;
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
  value: number | string | boolean | object
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
  entries: Array<{ key: string; value: number | string | boolean | object | any[] }>
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
