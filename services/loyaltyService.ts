import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';
import { LOYALTY_CONFIG, pointsForSpend, type RedeemTier } from '../constants/loyalty';
import { getLoyaltySettings } from './platformSettingsService';

// Admin-controlled earn rate. Falls back to the hardcoded default if
// platform_settings is unreachable.
export const pointsForSpendDynamic = async (amountSAR: number): Promise<number> => {
  try {
    const s = await getLoyaltySettings();
    return Math.max(0, Math.floor((amountSAR || 0) * s.pointsPerSAR));
  } catch {
    return pointsForSpend(amountSAR);
  }
};

// Loyalty points access layer.
//
// Backend status: a `loyalty_transactions` table (one row per earn/redeem)
// is the source of truth once the migration is applied. Until then this
// service degrades gracefully:
//   - balance: derived from the customer's completed orders as a safe
//     placeholder so the UI shows a realistic, non-zero number.
//   - redeem: recorded if the table exists, otherwise treated as a
//     local/mock confirmation (clearly flagged as pending backend).
//
// Nothing here ever throws into the UI — all paths return safe defaults.

export interface LoyaltyTransaction {
  id: string;
  user_id: string;
  type: 'earn' | 'redeem';
  points: number;
  reason: string;
  created_at: string;
}

export interface LoyaltySummary {
  balance: number;
  lifetimeEarned: number;
  /** True when numbers are derived placeholders, not real ledger data. */
  isPlaceholder: boolean;
  transactions: LoyaltyTransaction[];
}

export const getLoyaltySummary = async (userId: string): Promise<LoyaltySummary> => {
  const empty: LoyaltySummary = {
    balance: 0,
    lifetimeEarned: 0,
    isPlaceholder: true,
    transactions: [],
  };
  if (!userId) return empty;

  // 1. Try the real ledger.
  try {
    const { data, error } = await supabase
      .from('loyalty_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const txns = data as LoyaltyTransaction[];
      const balance = txns.reduce(
        (sum, t) => sum + (t.type === 'earn' ? t.points : -t.points),
        0
      );
      const lifetimeEarned = txns
        .filter((t) => t.type === 'earn')
        .reduce((s, t) => s + t.points, 0);
      return {
        balance: Math.max(0, balance),
        lifetimeEarned,
        isPlaceholder: false,
        transactions: txns,
      };
    }
  } catch (e) {
    logger.warn('loyalty ledger unavailable, using placeholder', e);
  }

  // 2. Placeholder: derive from completed-order spend until backend is ready.
  try {
    const { data } = await supabase
      .from('orders')
      .select('final_price, estimated_price, status, created_at, device_brand')
      .eq('user_id', userId)
      .eq('status', 'completed');

    const orders = data || [];
    const lifetimeEarned = orders.reduce(
      (sum: number, o: any) =>
        sum + pointsForSpend(Number(o.final_price ?? o.estimated_price ?? 0)),
      0
    );
    return {
      balance: lifetimeEarned,
      lifetimeEarned,
      isPlaceholder: true,
      transactions: orders.map((o: any, i: number) => ({
        id: `placeholder-${i}`,
        user_id: userId,
        type: 'earn' as const,
        points: pointsForSpend(Number(o.final_price ?? o.estimated_price ?? 0)),
        reason: o.device_brand ? `إصلاح ${o.device_brand}` : 'إصلاح مكتمل',
        created_at: o.created_at,
      })),
    };
  } catch (e) {
    logger.warn('loyalty placeholder derivation failed', e);
    return empty;
  }
};

export interface RedeemResult {
  ok: boolean;
  /** True when the redemption was only recorded locally (backend pending). */
  pendingBackend: boolean;
  message?: string;
}

export const redeemTier = async (
  userId: string,
  tier: RedeemTier,
  currentBalance: number
): Promise<RedeemResult> => {
  // Honour the admin enable switch + redeem-min floor.
  try {
    const s = await getLoyaltySettings();
    if (!s.enabled) {
      return { ok: false, pendingBackend: false, message: 'loyalty_disabled' };
    }
    if (currentBalance < s.redeemMin) {
      return { ok: false, pendingBackend: false, message: 'below_redeem_min' };
    }
  } catch {
    // If settings unreachable just continue with tier check.
  }
  if (currentBalance < tier.points) {
    return { ok: false, pendingBackend: false, message: 'insufficient_points' };
  }
  try {
    const { error } = await supabase.from('loyalty_transactions').insert({
      user_id: userId,
      type: 'redeem',
      points: tier.points,
      reason: tier.titleEn,
    });
    if (error) {
      // Table not ready — treat as a pending/mock redemption.
      return { ok: true, pendingBackend: true };
    }
    return { ok: true, pendingBackend: false };
  } catch (e) {
    logger.warn('redeemTier recorded locally only', e);
    return { ok: true, pendingBackend: true };
  }
};

/**
 * Best-effort earn hook. Safe to call after an order is created; if the
 * ledger table isn't there yet it no-ops (placeholder balance still covers
 * the UI). Kept here so the earn rule lives in one place.
 */
export const recordEarn = async (
  userId: string,
  amountSAR: number,
  reason: string
): Promise<void> => {
  // Check that loyalty is enabled before recording.
  let enabled = true;
  let points = pointsForSpend(amountSAR);
  try {
    const s = await getLoyaltySettings();
    enabled = s.enabled;
    points = Math.max(0, Math.floor((amountSAR || 0) * s.pointsPerSAR));
  } catch {
    // Fall through with defaults.
  }
  if (!enabled || !userId || points <= 0) return;
  try {
    await supabase.from('loyalty_transactions').insert({
      user_id: userId,
      type: 'earn',
      points,
      reason,
    });
  } catch {
    // Ledger not ready — placeholder balance already reflects this spend.
  }
};

export { LOYALTY_CONFIG, pointsForSpend };
