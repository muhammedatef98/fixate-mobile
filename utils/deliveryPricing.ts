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
  // ── Riyadh Region ──
  'Riyadh':            { lat: 24.7136, lng: 46.6753 },
  'Al Kharj':          { lat: 24.1483, lng: 47.3050 },
  'Ad Dawadimi':       { lat: 24.5074, lng: 44.3924 },
  'Al Majmaah':        { lat: 25.9039, lng: 45.3458 },
  'Al Quwaiyah':       { lat: 24.0537, lng: 45.2806 },
  'Wadi ad-Dawasir':   { lat: 20.4632, lng: 44.7889 },
  'Al Aflaj':          { lat: 22.2830, lng: 46.7325 },
  'Az Zulfi':          { lat: 26.2996, lng: 44.8156 },
  'Shaqra':            { lat: 25.2479, lng: 45.2522 },
  'Hotat Bani Tamim':  { lat: 23.5167, lng: 46.8500 },
  'Afif':              { lat: 23.9065, lng: 42.9172 },
  'Diriyah':           { lat: 24.7373, lng: 46.5754 },
  'Ad Dilam':          { lat: 23.9912, lng: 47.1599 },
  'Thadiq':            { lat: 25.2860, lng: 45.8730 },
  'Huraymila':         { lat: 25.1167, lng: 46.1000 },
  'Al Muzahimiyah':    { lat: 24.4660, lng: 46.2640 },
  'Rumah':             { lat: 25.5661, lng: 47.1640 },
  'Al Ghat':           { lat: 26.0260, lng: 44.9603 },
  'Marat':             { lat: 25.0700, lng: 45.4580 },
  // ── Makkah Region ──
  'Makkah':            { lat: 21.3891, lng: 39.8579 },
  'Jeddah':            { lat: 21.4858, lng: 39.1925 },
  'Taif':              { lat: 21.2854, lng: 40.4183 },
  'Rabigh':            { lat: 22.7986, lng: 39.0349 },
  'Al Qunfudhah':      { lat: 19.1264, lng: 41.0789 },
  'Al Lith':           { lat: 20.1593, lng: 40.2680 },
  'Khulais':           { lat: 22.1539, lng: 39.3183 },
  'Al Jumum':          { lat: 21.6169, lng: 39.6981 },
  'Turbah':            { lat: 21.2149, lng: 41.6329 },
  'Ranyah':            { lat: 21.5161, lng: 42.8622 },
  'Adham':             { lat: 20.0300, lng: 41.0400 },
  'Al Kamil':          { lat: 22.2167, lng: 39.8500 },
  'Bahrah':            { lat: 21.4084, lng: 39.4391 },
  'Al Muwayh':         { lat: 22.4333, lng: 41.7583 },
  // ── Madinah Region ──
  'Madinah':           { lat: 24.5247, lng: 39.5692 },
  'Yanbu':             { lat: 24.0895, lng: 38.0618 },
  'Al Ula':            { lat: 26.6086, lng: 37.9237 },
  'Badr':              { lat: 23.7800, lng: 38.7906 },
  'Khaybar':           { lat: 25.6989, lng: 39.2935 },
  'Al Hinakiyah':      { lat: 24.8607, lng: 40.5125 },
  'Mahd adh Dhahab':   { lat: 23.4953, lng: 40.8615 },
  'Al Ais':            { lat: 25.1000, lng: 38.1000 },
  // ── Eastern Province ──
  'Dammam':            { lat: 26.4207, lng: 50.0888 },
  'Al Khobar':         { lat: 26.2172, lng: 50.1971 },
  'Khobar':            { lat: 26.2172, lng: 50.1971 },
  'Dhahran':           { lat: 26.2885, lng: 50.1141 },
  'Qatif':             { lat: 26.5650, lng: 50.0089 },
  'Al Qatif':          { lat: 26.5650, lng: 50.0089 },
  'Al Ahsa':           { lat: 25.3837, lng: 49.5870 },
  'Hofuf':             { lat: 25.3837, lng: 49.5870 },
  'Al Mubarraz':       { lat: 25.4076, lng: 49.5906 },
  'Jubail':            { lat: 27.0046, lng: 49.6580 },
  'Hafar Al Batin':    { lat: 28.4337, lng: 45.9601 },
  'Saihat':            { lat: 26.4750, lng: 50.0410 },
  'Safwa':             { lat: 26.6500, lng: 49.9550 },
  'Tarout':            { lat: 26.5730, lng: 50.0610 },
  'Ras Tanura':        { lat: 26.6441, lng: 50.1597 },
  'Abqaiq':            { lat: 25.9355, lng: 49.6671 },
  'Khafji':            { lat: 28.4391, lng: 48.4912 },
  'Nairyah':           { lat: 27.4710, lng: 48.4910 },
  'Qaryat Al Ulya':    { lat: 27.3300, lng: 47.7000 },
  'Al Uyun':           { lat: 25.6000, lng: 49.5600 },
  // ── Qassim Region ──
  'Buraydah':          { lat: 26.3260, lng: 43.9750 },
  'Unaizah':           { lat: 26.0840, lng: 43.9935 },
  'Ar Rass':           { lat: 25.8694, lng: 43.4973 },
  'Al Bukayriyah':     { lat: 26.1450, lng: 43.6580 },
  'Al Mithnab':        { lat: 25.8600, lng: 44.2220 },
  'Al Badai':          { lat: 25.9800, lng: 43.6600 },
  'Riyadh Al Khabra':  { lat: 26.0670, lng: 43.5490 },
  'Uyun Al Jiwa':      { lat: 26.5060, lng: 43.7050 },
  'An Nabhaniyah':     { lat: 26.0000, lng: 43.0000 },
  'Ash Shimasiyah':    { lat: 26.6320, lng: 44.0680 },
  // ── Asir Region ──
  'Abha':              { lat: 18.2164, lng: 42.5053 },
  'Khamis Mushait':    { lat: 18.3093, lng: 42.7662 },
  'Bisha':             { lat: 19.9764, lng: 42.5902 },
  'An Namas':          { lat: 19.1500, lng: 42.1330 },
  'Mahayil':           { lat: 18.5500, lng: 42.0500 },
  'Sarat Abidah':      { lat: 18.0890, lng: 43.1230 },
  'Tathlith':          { lat: 19.5430, lng: 43.5180 },
  'Rijal Almaa':       { lat: 18.1990, lng: 42.2980 },
  'Dhahran Al Janub':  { lat: 17.6677, lng: 43.5000 },
  'Balqarn':           { lat: 19.5500, lng: 41.9330 },
  'Ahad Rufaidah':     { lat: 18.1950, lng: 42.8380 },
  'Tanomah':           { lat: 18.9290, lng: 42.1500 },
  // ── Tabuk Region ──
  'Tabuk':             { lat: 28.3838, lng: 36.5550 },
  'Duba':              { lat: 27.3493, lng: 35.6962 },
  'Umluj':             { lat: 25.0213, lng: 37.2685 },
  'Haql':              { lat: 29.2947, lng: 34.9412 },
  'Al Wajh':           { lat: 26.2455, lng: 36.4525 },
  'Tayma':             { lat: 27.6310, lng: 38.5537 },
  // ── Hail Region ──
  'Hail':              { lat: 27.5114, lng: 41.7208 },
  'Baqaa':             { lat: 27.0810, lng: 42.4180 },
  'Al Ghazalah':       { lat: 26.9300, lng: 41.3900 },
  'Ash Shinan':        { lat: 27.1500, lng: 42.4500 },
  'Ash Shamli':        { lat: 26.8100, lng: 40.1800 },
  'Mawqaq':            { lat: 27.4170, lng: 41.0500 },
  'As Sulaymi':        { lat: 26.2500, lng: 41.7830 },
  // ── Northern Borders ──
  'Arar':              { lat: 30.9753, lng: 41.0381 },
  'Rafha':             { lat: 29.6202, lng: 43.4948 },
  'Turaif':            { lat: 31.6725, lng: 38.6637 },
  'Al Uwayqilah':      { lat: 30.3420, lng: 42.2480 },
  // ── Jazan Region ──
  'Jazan':             { lat: 16.8892, lng: 42.5511 },
  'Sabya':             { lat: 17.1490, lng: 42.6253 },
  'Abu Arish':         { lat: 16.9690, lng: 42.8320 },
  'Samtah':            { lat: 16.5970, lng: 42.9440 },
  'Ahad Al Masarihah': { lat: 16.7100, lng: 42.9600 },
  'Farasan':           { lat: 16.7020, lng: 42.1180 },
  'Baish':             { lat: 17.3740, lng: 42.5410 },
  'Ad Darb':           { lat: 17.7220, lng: 42.2520 },
  'Al Aridah':         { lat: 17.0500, lng: 43.0830 },
  'Damad':             { lat: 17.1130, lng: 42.7800 },
  // ── Najran Region ──
  'Najran':            { lat: 17.4924, lng: 44.1277 },
  'Sharurah':          { lat: 17.4670, lng: 47.1170 },
  'Hubuna':            { lat: 17.7920, lng: 44.0700 },
  'Badr Al Janub':     { lat: 17.9000, lng: 43.7500 },
  'Yadamah':           { lat: 17.9830, lng: 44.7330 },
  'Khubash':           { lat: 17.6330, lng: 44.4830 },
  'Thar':              { lat: 17.6830, lng: 44.4000 },
  // ── Al Bahah Region ──
  'Al Bahah':          { lat: 20.0129, lng: 41.4677 },
  'Baljurashi':        { lat: 19.8590, lng: 41.5670 },
  'Al Mandaq':         { lat: 20.1580, lng: 41.2830 },
  'Al Mikhwah':        { lat: 19.7600, lng: 41.4400 },
  'Qilwah':            { lat: 19.7790, lng: 41.3870 },
  'Al Aqiq':           { lat: 20.2680, lng: 41.6490 },
  'Al Qura':           { lat: 20.2780, lng: 41.4420 },
  // ── Al Jawf Region ──
  'Sakaka':            { lat: 29.9697, lng: 40.2064 },
  'Al Qurayyat':       { lat: 31.3320, lng: 37.3428 },
  'Dumat Al Jandal':   { lat: 29.8110, lng: 39.8710 },
  'Tabarjal':          { lat: 30.4990, lng: 38.2180 },
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
  // Arabic alias map — exact-match only so we don't accidentally collide
  // on partial matches. Keys mirror `service_area_cities.name_ar` exactly,
  // plus a few common short forms.
  if (nameAr) {
    const ar = nameAr.trim();
    const arMap: Record<string, keyof typeof CITY_CENTROIDS> = {
      // Riyadh Region
      'الرياض': 'Riyadh', 'الخرج': 'Al Kharj', 'الدوادمي': 'Ad Dawadimi',
      'المجمعة': 'Al Majmaah', 'القويعية': 'Al Quwaiyah', 'وادي الدواسر': 'Wadi ad-Dawasir',
      'الأفلاج': 'Al Aflaj', 'الزلفي': 'Az Zulfi', 'شقراء': 'Shaqra',
      'حوطة بني تميم': 'Hotat Bani Tamim', 'عفيف': 'Afif', 'الدرعية': 'Diriyah',
      'الدلم': 'Ad Dilam', 'ثادق': 'Thadiq', 'حريملاء': 'Huraymila',
      'المزاحمية': 'Al Muzahimiyah', 'رماح': 'Rumah', 'الغاط': 'Al Ghat', 'مرات': 'Marat',
      // Makkah Region
      'مكة المكرمة': 'Makkah', 'مكة': 'Makkah', 'جدة': 'Jeddah', 'الطائف': 'Taif',
      'رابغ': 'Rabigh', 'القنفذة': 'Al Qunfudhah', 'الليث': 'Al Lith', 'خليص': 'Khulais',
      'الجموم': 'Al Jumum', 'تربة': 'Turbah', 'رنية': 'Ranyah', 'أضم': 'Adham',
      'الكامل': 'Al Kamil', 'بحرة': 'Bahrah', 'المويه': 'Al Muwayh',
      // Madinah Region
      'المدينة المنورة': 'Madinah', 'المدينة': 'Madinah', 'ينبع': 'Yanbu', 'العلا': 'Al Ula',
      'بدر': 'Badr', 'خيبر': 'Khaybar', 'الحناكية': 'Al Hinakiyah',
      'مهد الذهب': 'Mahd adh Dhahab', 'العيص': 'Al Ais',
      // Eastern Province
      'الدمام': 'Dammam', 'الخبر': 'Al Khobar', 'الظهران': 'Dhahran', 'القطيف': 'Qatif',
      'الأحساء': 'Al Ahsa', 'الهفوف': 'Hofuf', 'المبرز': 'Al Mubarraz', 'الجبيل': 'Jubail',
      'حفر الباطن': 'Hafar Al Batin', 'سيهات': 'Saihat', 'صفوى': 'Safwa', 'تاروت': 'Tarout',
      'رأس تنورة': 'Ras Tanura', 'بقيق': 'Abqaiq', 'الخفجي': 'Khafji', 'النعيرية': 'Nairyah',
      'قرية العليا': 'Qaryat Al Ulya', 'العيون': 'Al Uyun',
      // Qassim Region
      'بريدة': 'Buraydah', 'عنيزة': 'Unaizah', 'الرس': 'Ar Rass', 'البكيرية': 'Al Bukayriyah',
      'المذنب': 'Al Mithnab', 'البدائع': 'Al Badai', 'رياض الخبراء': 'Riyadh Al Khabra',
      'عيون الجواء': 'Uyun Al Jiwa', 'النبهانية': 'An Nabhaniyah', 'الشماسية': 'Ash Shimasiyah',
      // Asir Region
      'أبها': 'Abha', 'خميس مشيط': 'Khamis Mushait', 'بيشة': 'Bisha', 'النماص': 'An Namas',
      'محايل عسير': 'Mahayil', 'سراة عبيدة': 'Sarat Abidah', 'تثليث': 'Tathlith',
      'رجال ألمع': 'Rijal Almaa', 'ظهران الجنوب': 'Dhahran Al Janub', 'بلقرن': 'Balqarn',
      'أحد رفيدة': 'Ahad Rufaidah', 'تنومة': 'Tanomah',
      // Tabuk Region
      'تبوك': 'Tabuk', 'ضباء': 'Duba', 'أملج': 'Umluj', 'حقل': 'Haql',
      'الوجه': 'Al Wajh', 'تيماء': 'Tayma',
      // Hail Region
      'حائل': 'Hail', 'بقعاء': 'Baqaa', 'الغزالة': 'Al Ghazalah', 'الشنان': 'Ash Shinan',
      'الشملي': 'Ash Shamli', 'موقق': 'Mawqaq', 'السليمي': 'As Sulaymi',
      // Northern Borders
      'عرعر': 'Arar', 'رفحاء': 'Rafha', 'طريف': 'Turaif', 'العويقيلة': 'Al Uwayqilah',
      // Jazan Region
      'جازان': 'Jazan', 'صبيا': 'Sabya', 'أبو عريش': 'Abu Arish', 'صامطة': 'Samtah',
      'أحد المسارحة': 'Ahad Al Masarihah', 'فرسان': 'Farasan', 'بيش': 'Baish',
      'الدرب': 'Ad Darb', 'العارضة': 'Al Aridah', 'ضمد': 'Damad',
      // Najran Region
      'نجران': 'Najran', 'شرورة': 'Sharurah', 'حبونا': 'Hubuna', 'بدر الجنوب': 'Badr Al Janub',
      'يدمة': 'Yadamah', 'خباش': 'Khubash', 'ثار': 'Thar',
      // Al Bahah Region
      'الباحة': 'Al Bahah', 'بلجرشي': 'Baljurashi', 'المندق': 'Al Mandaq',
      'المخواة': 'Al Mikhwah', 'قلوة': 'Qilwah', 'العقيق': 'Al Aqiq', 'القرى': 'Al Qura',
      // Al Jawf Region
      'سكاكا': 'Sakaka', 'القريات': 'Al Qurayyat', 'دومة الجندل': 'Dumat Al Jandal',
      'طبرجل': 'Tabarjal',
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
