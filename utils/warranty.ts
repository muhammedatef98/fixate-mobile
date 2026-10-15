// Repair-warranty logic, derived (not stored) from the orders table.
//
// The warranty window is derived from the order itself rather than kept in a
// separate table that could drift out of sync: it starts on the completion
// date (we use `updated_at` as the completion proxy — an order flips to
// 'completed' on its final update) and runs for the order's warranty length.
// An expired warranty is simply one whose end date is in the past.
//
// Warranty length depends on the repair (the order's primary issue,
// `service_id`) and on the spare-part grade the customer chose:
//   - screen / battery replacements ............ 6 months
//   - other part repairs (charging port, camera,
//     speaker, buttons, board work, hinge, ...) . 3 months
//   - liquid damage and software fixes ......... 1 month (≈30 days)
//   - data recovery and inspection-only jobs ... no warranty
//   - any part repair with ORIGINAL parts ...... 12 months
// Orders placed before WARRANTY_POLICY_EFFECTIVE_FROM keep the 12-month
// warranty they were sold with.

/** Longest warranty Fixate offers (original parts). Used in "up to N months" copy. */
export const MAX_WARRANTY_MONTHS = 12;

/**
 * Orders created before this instant were sold under the old "1 year on every
 * repair" policy and keep it. Set this to the day the new policy goes live.
 */
export const WARRANTY_POLICY_EFFECTIVE_FROM = Date.parse('2026-10-16T00:00:00+03:00');

const LEGACY_WARRANTY_MONTHS = 12;
const ORIGINAL_PARTS_MONTHS = 12;
const DEFAULT_REPAIR_MONTHS = 3;

/** Screen and battery replacements: 6 months. */
const SIX_MONTH_ISSUES = new Set([
  'screen', 'battery',
  'laptop-screen', 'laptop-battery',
  'tablet-screen', 'tablet-battery',
  'watch-screen', 'watch-battery',
  'tv-screen',
]);

/** Liquid damage and software fixes: 1 month, regardless of part grade. */
const ONE_MONTH_ISSUES = new Set([
  'water-damage', 'laptop-liquid', 'tablet-liquid',
  'software', 'laptop-os', 'tablet-software', 'watch-software', 'gaming-software',
]);

/** Services that replace or repair nothing: no warranty. */
const NO_WARRANTY_ISSUES = new Set([
  'phone-data-recovery', 'laptop-data-recovery', 'other-general-diagnose',
]);

/** Minimal order shape needed to derive a warranty. */
export interface WarrantyOrderLike {
  id: string;
  status?: string | null;
  device_brand?: string | null;
  device_model?: string | null;
  issue_description?: string | null;
  estimated_price?: number | null;
  /** Primary repair issue id (constants/repairData ISSUES). */
  service_id?: string | null;
  /** 'original' | 'high_quality' | 'economy'. */
  spare_part_quality?: string | null;
  created_at: string;
  updated_at?: string | null;
}

/** Warranty length in months for this order (0 = no warranty). */
export function warrantyMonthsFor(order: WarrantyOrderLike): number {
  const created = Date.parse(order.created_at);
  if (Number.isFinite(created) && created < WARRANTY_POLICY_EFFECTIVE_FROM) {
    return LEGACY_WARRANTY_MONTHS;
  }
  const issue = order.service_id ?? '';
  if (NO_WARRANTY_ISSUES.has(issue)) return 0;
  if (ONE_MONTH_ISSUES.has(issue)) return 1;
  if (order.spare_part_quality === 'original') return ORIGINAL_PARTS_MONTHS;
  if (SIX_MONTH_ISSUES.has(issue)) return 6;
  return DEFAULT_REPAIR_MONTHS;
}

/** "6 months" / "6 أشهر" style label for a warranty length. */
export function warrantyMonthsLabel(months: number, isRTL: boolean): string {
  if (isRTL) {
    if (months === 1) return 'شهر واحد';
    if (months === 2) return 'شهران';
    if (months >= 3 && months <= 10) return `${months} أشهر`;
    return `${months} شهراً`;
  }
  return months === 1 ? '1 month' : `${months} months`;
}

const DAY_MS = 86_400_000;

export interface WarrantyInfo {
  /** Warranty length in months for this order. */
  months: number;
  /** Coverage start = repair completion date. */
  startDate: Date;
  /** Coverage end = start + months. */
  endDate: Date;
  isActive: boolean;
  /** Whole days left (0 once expired). */
  daysRemaining: number;
  /** Full coverage span in days (for the progress bar). */
  totalDays: number;
  /** Elapsed fraction 0..1 (1 once expired). */
  elapsed: number;
}

/**
 * Derive the warranty window for an order. Returns null when the order has no
 * usable completion date or its repair carries no warranty. Callers decide
 * whether the order qualifies (only `status === 'completed'` orders carry a
 * real warranty).
 */
export function deriveWarranty(order: WarrantyOrderLike, now: number = Date.now()): WarrantyInfo | null {
  const months = warrantyMonthsFor(order);
  if (months <= 0) return null;
  const base = order.updated_at ?? order.created_at;
  if (!base) return null;
  const start = new Date(base);
  if (Number.isNaN(start.getTime())) return null;

  const end = new Date(start);
  end.setMonth(end.getMonth() + months);

  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS));
  const isActive = end.getTime() > now;
  const daysRemaining = isActive ? Math.ceil((end.getTime() - now) / DAY_MS) : 0;
  const elapsed = Math.min(1, Math.max(0, (now - start.getTime()) / (end.getTime() - start.getTime())));

  return { months, startDate: start, endDate: end, isActive, daysRemaining, totalDays, elapsed };
}

/** True when the order is a completed repair whose warranty is still in force. */
export function hasActiveWarranty(order: WarrantyOrderLike, now: number = Date.now()): boolean {
  if (order.status !== 'completed') return false;
  const w = deriveWarranty(order, now);
  return !!w && w.isActive;
}

/** Human device label, with a sensible fallback. */
export function deviceLabel(order: WarrantyOrderLike, isRTL: boolean): string {
  const parts = [order.device_brand, order.device_model].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return isRTL ? 'جهاز' : 'Device';
}
