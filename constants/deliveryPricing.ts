// Delivery pricing by region/area.
//
// This is intentionally CONFIG-DRIVEN, not hard-coded business rules. The
// shape below is the *default/fallback* the app ships with. At runtime
// `services/deliveryPricingService.ts` first tries to load an override row
// from Supabase (so a technician/admin can later tune prices without an app
// release); if that table is missing or empty it falls back to this file.
//
// Scaling notes:
//  - Add a new region by pushing another DeliveryRegion object.
//  - Each area carries its own fee, capped by MAX_DELIVERY_FEE_SAR.
//  - `enabled` lets ops switch a whole region off without deleting config.

export interface DeliveryArea {
  id: string;
  nameAr: string;
  nameEn: string;
  fee: number; // SAR
}

export interface DeliveryRegion {
  id: string;
  nameAr: string;
  nameEn: string;
  enabled: boolean;
  /** Fee used when the customer hasn't picked a specific area yet. */
  baseFee: number;
  areas: DeliveryArea[];
}

// Business guard rail: areas must never exceed this. The first supported
// region (Al Qatif) is priced within 0–40 SAR depending on area.
export const MAX_DELIVERY_FEE_SAR = 40;

export const DELIVERY_REGIONS: DeliveryRegion[] = [
  {
    id: 'al_qatif',
    nameAr: 'القطيف',
    nameEn: 'Al Qatif',
    enabled: true,
    baseFee: 20,
    areas: [
      { id: 'qatif_center', nameAr: 'القطيف - المركز', nameEn: 'Al Qatif - Center', fee: 15 },
      { id: 'safwa', nameAr: 'صفوى', nameEn: 'Safwa', fee: 25 },
      { id: 'saihat', nameAr: 'سيهات', nameEn: 'Saihat', fee: 20 },
      { id: 'tarout', nameAr: 'تاروت', nameEn: 'Tarout', fee: 30 },
      { id: 'anak', nameAr: 'عنك', nameEn: 'Anak', fee: 25 },
      { id: 'umm_al_hamam', nameAr: 'أم الحمام', nameEn: 'Umm Al Hamam', fee: 18 },
      { id: 'al_awamiyah', nameAr: 'العوامية', nameEn: 'Al Awamiyah', fee: 22 },
      { id: 'outskirts', nameAr: 'أطراف القطيف', nameEn: 'Qatif Outskirts', fee: 40 },
    ],
  },
];

/** Clamp any incoming fee into the allowed business range. */
export const clampDeliveryFee = (fee: number): number =>
  Math.max(0, Math.min(MAX_DELIVERY_FEE_SAR, Math.round(fee)));

export const getRegion = (regionId?: string | null): DeliveryRegion | null =>
  DELIVERY_REGIONS.find((r) => r.id === regionId) ?? null;

export const getArea = (
  regionId?: string | null,
  areaId?: string | null
): DeliveryArea | null => {
  const region = getRegion(regionId);
  if (!region) return null;
  return region.areas.find((a) => a.id === areaId) ?? null;
};

/**
 * Resolve the delivery fee for a region/area selection. Falls back to the
 * region base fee when no area is chosen, and 0 when nothing is selected
 * (e.g. on-site "mobile" service that needs no delivery).
 */
export const resolveDeliveryFee = (
  regionId?: string | null,
  areaId?: string | null
): number => {
  const region = getRegion(regionId);
  if (!region || !region.enabled) return 0;
  const area = getArea(regionId, areaId);
  return clampDeliveryFee(area ? area.fee : region.baseFee);
};
