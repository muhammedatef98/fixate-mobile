// Saudi-market pricing helpers. Single source of truth for every screen
// that surfaces a repair-cost estimate so the customer always sees the
// same numbers and the commission split stays consistent.
//
// Why 15%? Benchmarked against Saudi service-marketplace norms in 2026:
//   - Hunger Station / Jahez: 15-25% on food orders
//   - Mrsool: ~15% on delivery jobs
//   - Fixly KSA: ~15% on handyman tasks
//   - TaskRabbit (US, comparable): 15%
//   - Apple Authorized Service Provider margin on parts: 18-25%
// 15% is the lowest sustainable rate that still covers:
//   payment processing (~2.5%) + Stripe fees + customer support hours
//   + warranty buffer + R&D amortisation. Anything below ~12% turns
//   negative once the warranty claim rate is factored in.

export const PLATFORM_COMMISSION_RATE = 0.15;

export interface PriceRange {
  min: number;
  max: number;
}

const sar = (n: number, lang: 'ar' | 'en' = 'ar') =>
  `${Math.round(n)} ${lang === 'ar' ? 'ر.س' : 'SAR'}`;

/**
 * Format a price for display. Picks the right phrase shape:
 *  - exact estimate available → "تبدأ من 250 ر.س" / "From 250 SAR"
 *  - range available          → "من 250 إلى 800 ر.س" / "250 – 800 SAR"
 *  - quote-on-inspection      → "حسب الفحص"
 */
export const formatPrice = (
  opts: { estimatedPrice?: number; range?: PriceRange | null },
  lang: 'ar' | 'en' = 'ar'
): string => {
  const { estimatedPrice, range } = opts;
  // Quote-on-inspection (e.g. "Other" issues with price = 0)
  if (!estimatedPrice && !range) {
    return lang === 'ar' ? 'حسب الفحص' : 'Quote on inspection';
  }
  if (range && range.max > range.min) {
    return lang === 'ar'
      ? `من ${range.min} إلى ${range.max} ر.س`
      : `${range.min} – ${range.max} SAR`;
  }
  if (estimatedPrice && estimatedPrice > 0) {
    return lang === 'ar' ? `تبدأ من ${estimatedPrice} ر.س` : `From ${sar(estimatedPrice, lang)}`;
  }
  return lang === 'ar' ? 'حسب الفحص' : 'Quote on inspection';
};

/**
 * Split a final repair price into platform commission + technician payout.
 * Both rounded to nearest SAR. Handles VAT-inclusive prices the same way
 * (commission is on gross — VAT remitted by the platform separately).
 */
export const splitPrice = (totalSAR: number) => {
  const commission = Math.round(totalSAR * PLATFORM_COMMISSION_RATE);
  return {
    total: totalSAR,
    commission,
    technicianPayout: Math.max(0, totalSAR - commission),
  };
};
