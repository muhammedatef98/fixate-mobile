/**
 * estimatedRepair.ts — canonical repair-time buckets the technician picks from
 * while managing an accepted order, rendered bilingually for the customer.
 *
 * Stored on orders.estimated_repair as the key (framework-free so the tech
 * selector, customer order view, and any tests share one source of truth).
 * This is the repair-duration promise only — never courier/pickup timing.
 */
export type EstimatedRepairKey =
  | 'same_day'
  | '1_day'
  | '2_3_days'
  | '3_5_days'
  | '1_week'
  | '2_weeks';

export const ESTIMATED_REPAIR_OPTIONS: {
  key: EstimatedRepairKey;
  ar: string;
  en: string;
}[] = [
  { key: 'same_day', ar: 'في نفس اليوم', en: 'Same day' },
  { key: '1_day', ar: 'خلال يوم', en: 'Within 1 day' },
  { key: '2_3_days', ar: '2–3 أيام', en: '2–3 days' },
  { key: '3_5_days', ar: '3–5 أيام', en: '3–5 days' },
  { key: '1_week', ar: 'حوالي أسبوع', en: 'About a week' },
  { key: '2_weeks', ar: 'أسبوعان أو أكثر', en: '2 weeks or more' },
];

/** Bilingual label for a stored key, or null when unset/unknown. */
export const estimatedRepairLabel = (
  key: string | null | undefined,
  isRTL: boolean
): string | null => {
  if (!key) return null;
  const opt = ESTIMATED_REPAIR_OPTIONS.find((o) => o.key === key);
  if (!opt) return null;
  return isRTL ? opt.ar : opt.en;
};
