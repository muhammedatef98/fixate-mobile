/**
 * Distance-based delivery / mobile-technician fee.
 *
 * The customer's selected location (lat/lng) is measured against the
 * service-area city's centroid. The fee follows a simple tiered ladder
 * so customers can predict the cost before they pick a spot on the map.
 *
 * The ladder is intentionally coarse — small wobbles in GPS shouldn't
 * cross a tier boundary, and the ceiling is hard-capped at 40 SAR so
 * the customer is never surprised by a large number.
 *
 * Tiers:
 *   0 – 5 km   → 10 SAR
 *   5 – 15 km  → 20 SAR
 *  15 – 30 km  → 30 SAR
 *   > 30 km    → 40 SAR  (cap)
 *
 * If we have no origin to measure from (city centroid missing, or the
 * city is not in the lookup yet), we fall back to the admin-managed
 * per-city `delivery_fee` from `service_area_cities`, also capped.
 */

export const DELIVERY_FEE_MAX_SAR = 40;

export const DELIVERY_FEE_TIERS: ReadonlyArray<{ maxKm: number; fee: number }> = [
  { maxKm: 5,  fee: 10 },
  { maxKm: 15, fee: 20 },
  { maxKm: 30, fee: 30 },
  { maxKm: Infinity, fee: DELIVERY_FEE_MAX_SAR },
];

/**
 * City centroids for the current coverage area. Keyed by the `name_en`
 * column from `service_area_cities` so the lookup survives a regional
 * sort/rename and we don't depend on the DB shipping a `latitude`
 * column. When admin coverage expands, add the new city here (or
 * migrate to a DB-managed centroid column later).
 *
 * Source: OpenStreetMap centroids, rounded to 4 decimals (~11m precision).
 */
export const CITY_CENTROIDS: Readonly<Record<string, { lat: number; lng: number }>> = {
  // Eastern Province
  'Al Qatif': { lat: 26.5650, lng: 50.0089 },
  'Qatif':    { lat: 26.5650, lng: 50.0089 },
  'Dammam':   { lat: 26.4207, lng: 50.0888 },
  'Khobar':   { lat: 26.2172, lng: 50.1971 },
  'Dhahran':  { lat: 26.2885, lng: 50.1141 },
  'Jubail':   { lat: 27.0046, lng: 49.6580 },
  'Hofuf':    { lat: 25.3837, lng: 49.5870 },
  // Central
  'Riyadh':   { lat: 24.7136, lng: 46.6753 },
  // Western
  'Jeddah':   { lat: 21.4858, lng: 39.1925 },
  'Makkah':   { lat: 21.3891, lng: 39.8579 },
  'Madinah':  { lat: 24.5247, lng: 39.5692 },
  'Taif':     { lat: 21.2854, lng: 40.4183 },
  // Northern
  'Tabuk':    { lat: 28.3838, lng: 36.5550 },
  // Southern
  'Abha':     { lat: 18.2164, lng: 42.5053 },
  'Jazan':    { lat: 16.8892, lng: 42.5511 },
};

/**
 * Look up a city centroid by either English or Arabic name. Returns
 * `null` when no centroid is known — callers should fall back to the
 * admin-managed flat delivery fee.
 */
export const getCityCentroid = (
  nameEn?: string | null,
  nameAr?: string | null
): { lat: number; lng: number } | null => {
  if (nameEn) {
    const hit = CITY_CENTROIDS[nameEn.trim()];
    if (hit) return hit;
  }
  // Arabic alias map — keep small and explicit so we don't accidentally
  // collide on partial matches.
  if (nameAr) {
    const ar = nameAr.trim();
    const arMap: Record<string, keyof typeof CITY_CENTROIDS> = {
      'القطيف': 'Al Qatif',
      'الدمام': 'Dammam',
      'الخبر':  'Khobar',
      'الظهران': 'Dhahran',
      'الجبيل': 'Jubail',
      'الهفوف': 'Hofuf',
      'الرياض': 'Riyadh',
      'جدة':    'Jeddah',
      'مكة':   'Makkah',
      'المدينة': 'Madinah',
      'الطائف': 'Taif',
      'تبوك':  'Tabuk',
      'أبها':  'Abha',
      'جازان': 'Jazan',
    };
    const key = arMap[ar];
    if (key) return CITY_CENTROIDS[key] ?? null;
  }
  return null;
};

/**
 * Great-circle (haversine) distance between two lat/lng points, in km.
 * Accurate to a few metres at city scale — far more than we need for
 * a delivery fee.
 */
export const haversineKm = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number => {
  const R = 6371; // Earth radius in km
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sa = Math.sin(dLat / 2);
  const sb = Math.sin(dLng / 2);
  const h =
    sa * sa +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sb * sb;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

/** Resolve a distance (km) into a SAR fee using the tier ladder. */
export const feeForDistanceKm = (km: number): number => {
  if (!Number.isFinite(km) || km < 0) return DELIVERY_FEE_TIERS[0].fee;
  for (const tier of DELIVERY_FEE_TIERS) {
    if (km <= tier.maxKm) return Math.min(tier.fee, DELIVERY_FEE_MAX_SAR);
  }
  return DELIVERY_FEE_MAX_SAR;
};

export interface ComputeDeliveryFeeInput {
  customer?: { lat: number; lng: number } | null;
  cityNameEn?: string | null;
  cityNameAr?: string | null;
  /** Admin-managed flat delivery_fee from service_area_cities (fallback). */
  flatFee?: number | null;
  /** When true (e.g. personal hand-off), force the fee to zero. */
  freeOverride?: boolean;
}

export interface ComputedDeliveryFee {
  fee: number;
  /** Distance in km when we could measure it; null when we fell back. */
  distanceKm: number | null;
  /** How the fee was resolved — useful for UI hints and telemetry. */
  source: 'distance' | 'flat' | 'free' | 'default';
}

/**
 * The single source of truth used by the request flow to display and
 * persist the delivery / mobile-tech fee. Always returns a value in the
 * 0…DELIVERY_FEE_MAX_SAR range.
 */
export const computeDeliveryFee = (
  input: ComputeDeliveryFeeInput
): ComputedDeliveryFee => {
  if (input.freeOverride) {
    return { fee: 0, distanceKm: null, source: 'free' };
  }
  const origin = getCityCentroid(input.cityNameEn, input.cityNameAr);
  if (origin && input.customer && Number.isFinite(input.customer.lat) && Number.isFinite(input.customer.lng)) {
    const km = haversineKm(origin, input.customer);
    return {
      fee: feeForDistanceKm(km),
      distanceKm: km,
      source: 'distance',
    };
  }
  // No customer GPS yet, or we don't have a centroid for this city —
  // fall back to the admin-managed flat fee (capped). Surface it as
  // 'flat' so the UI can show a friendlier hint than the raw price.
  if (typeof input.flatFee === 'number' && Number.isFinite(input.flatFee)) {
    return {
      fee: Math.max(0, Math.min(DELIVERY_FEE_MAX_SAR, Math.round(input.flatFee))),
      distanceKm: null,
      source: 'flat',
    };
  }
  return { fee: 0, distanceKm: null, source: 'default' };
};
