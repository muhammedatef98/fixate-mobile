// Repair-warranty logic, derived (not stored) from the orders table.
//
// Fixate gives every completed repair a full 1-year warranty. Rather than
// duplicate that as a separate table that could drift out of sync, we derive
// the warranty window from the order itself: it starts on the completion date
// (we use `updated_at` as the completion proxy — an order flips to
// 'completed' on its final update) and runs WARRANTY_MONTHS forward. This keeps
// a single source of truth (the order) and means an expired warranty is simply
// one whose end date is in the past — nothing to clean up.

export const WARRANTY_MONTHS = 12;

const DAY_MS = 86_400_000;

/** Minimal order shape needed to derive a warranty. */
export interface WarrantyOrderLike {
  id: string;
  status?: string | null;
  device_brand?: string | null;
  device_model?: string | null;
  issue_description?: string | null;
  estimated_price?: number | null;
  created_at: string;
  updated_at?: string | null;
}

export interface WarrantyInfo {
  /** Coverage start = repair completion date. */
  startDate: Date;
  /** Coverage end = start + WARRANTY_MONTHS. */
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
 * usable completion date. Callers decide whether the order qualifies (only
 * `status === 'completed'` orders carry a real warranty).
 */
export function deriveWarranty(order: WarrantyOrderLike, now: number = Date.now()): WarrantyInfo | null {
  const base = order.updated_at ?? order.created_at;
  if (!base) return null;
  const start = new Date(base);
  if (Number.isNaN(start.getTime())) return null;

  const end = new Date(start);
  end.setMonth(end.getMonth() + WARRANTY_MONTHS);

  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS));
  const isActive = end.getTime() > now;
  const daysRemaining = isActive ? Math.ceil((end.getTime() - now) / DAY_MS) : 0;
  const elapsed = Math.min(1, Math.max(0, (now - start.getTime()) / (end.getTime() - start.getTime())));

  return { startDate: start, endDate: end, isActive, daysRemaining, totalDays, elapsed };
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
