/**
 * estimatedRepair.ts — canonical repair-time buckets the technician picks from
 * while managing an accepted order, rendered bilingually for the customer.
 *
 * Buckets are HOUR-based (a few hours up to ~48h). Stored on
 * orders.estimated_repair as the key. Framework-free so the tech selector,
 * customer order view, and tests share one source of truth. Repair-duration
 * promise only — never courier/pickup timing.
 */
export type EstimatedRepairKey =
  | 'under_2_hours'
  | '2_4_hours'
  | '4_8_hours'
  | '8_12_hours'
  | '12_24_hours'
  | '24_48_hours';

export const ESTIMATED_REPAIR_OPTIONS: {
  key: EstimatedRepairKey;
  ar: string;
  en: string;
}[] = [
  { key: 'under_2_hours', ar: 'أقل من ساعتين', en: 'Under 2 hours' },
  { key: '2_4_hours', ar: '2 – 4 ساعات', en: '2 – 4 hours' },
  { key: '4_8_hours', ar: '4 – 8 ساعات', en: '4 – 8 hours' },
  { key: '8_12_hours', ar: '8 – 12 ساعة', en: '8 – 12 hours' },
  { key: '12_24_hours', ar: '12 – 24 ساعة', en: '12 – 24 hours' },
  { key: '24_48_hours', ar: '24 – 48 ساعة', en: '24 – 48 hours' },
];

// Legacy day-based keys (pre hours migration) kept renderable so any order
// stamped before the switch still shows a sensible label.
const LEGACY_LABELS: Record<string, { ar: string; en: string }> = {
  same_day: { ar: 'في نفس اليوم', en: 'Same day' },
  '1_day': { ar: 'خلال يوم', en: 'Within 1 day' },
  '2_3_days': { ar: '2–3 أيام', en: '2–3 days' },
  '3_5_days': { ar: '3–5 أيام', en: '3–5 days' },
  '1_week': { ar: 'حوالي أسبوع', en: 'About a week' },
  '2_weeks': { ar: 'أسبوعان أو أكثر', en: '2 weeks or more' },
};

/** Bilingual label for a stored key, or null when unset/unknown. */
export const estimatedRepairLabel = (
  key: string | null | undefined,
  isRTL: boolean
): string | null => {
  if (!key) return null;
  const opt = ESTIMATED_REPAIR_OPTIONS.find((o) => o.key === key);
  if (opt) return isRTL ? opt.ar : opt.en;
  const legacy = LEGACY_LABELS[key];
  return legacy ? (isRTL ? legacy.ar : legacy.en) : null;
};
