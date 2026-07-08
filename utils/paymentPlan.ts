/**
 * paymentPlan.ts — pure helpers for the admin-configurable payment policy.
 *
 * Three modes (platform_settings key `payment_mode_active`):
 *   full_upfront       — the full agreed total is due right after accepting
 *   deposit_then_rest  — a fixed/percent deposit now, the rest after repair
 *   partial_then_final — a percentage now, the rest once the final total is known
 *
 * Mirrors the SQL helper public.payment_upfront_due — the server snapshots
 * the mode + due-now amount onto the order at offer acceptance, so these
 * client helpers are for display and for legacy rows without a snapshot.
 * Framework-free and unit-tested.
 */

export type PaymentMode = 'full_upfront' | 'deposit_then_rest' | 'partial_then_final';

export interface PaymentModeSettings {
  mode: PaymentMode;
  depositType: 'fixed' | 'percent';
  depositValue: number;
  partialPercent: number;
}

export const DEFAULT_PAYMENT_MODE_SETTINGS: PaymentModeSettings = {
  mode: 'full_upfront',
  depositType: 'fixed',
  depositValue: 50,
  partialPercent: 50,
};

export const PAYMENT_MODES: PaymentMode[] = [
  'full_upfront',
  'deposit_then_rest',
  'partial_then_final',
];

export const PAYMENT_MODE_LABELS: Record<PaymentMode, { ar: string; en: string }> = {
  full_upfront: { ar: 'دفع كامل مقدماً', en: 'Full payment upfront' },
  deposit_then_rest: { ar: 'عربون تأكيد ثم الباقي بعد الإصلاح', en: 'Deposit first, rest after repair' },
  partial_then_final: { ar: 'دفعة جزئية ثم الباقي عند الإجمالي النهائي', en: 'Partial payment, rest at final total' },
};

export const PAYMENT_MODE_DESCRIPTIONS: Record<PaymentMode, { ar: string; en: string }> = {
  full_upfront: {
    ar: 'يدفع العميل كامل قيمة العرض المقبول فور قبوله.',
    en: 'The customer pays the full accepted-offer total immediately after accepting.',
  },
  deposit_then_rest: {
    ar: 'يدفع العميل عربون تأكيد أولاً، ويُحصَّل المتبقي بعد إتمام الإصلاح.',
    en: 'The customer pays a confirmation deposit first; the remainder is collected after the repair.',
  },
  partial_then_final: {
    ar: 'يدفع العميل جزءاً من المبلغ أولاً، والمتبقي بعد معرفة الإجمالي النهائي.',
    en: 'The customer pays part of the amount first; the remainder is due once the final total is known.',
  },
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

const clamp = (n: number, min: number, max: number): number =>
  Math.min(Math.max(n, min), max);

export const isPaymentMode = (v: unknown): v is PaymentMode =>
  v === 'full_upfront' || v === 'deposit_then_rest' || v === 'partial_then_final';

/**
 * Amount due immediately after offer acceptance, for a customer-facing total,
 * under the given policy. Never below 0 or above the total.
 */
export const computeUpfrontDue = (
  total: number,
  settings: PaymentModeSettings
): number => {
  const safeTotal = Math.max(0, total);
  switch (settings.mode) {
    case 'full_upfront':
      return round2(safeTotal);
    case 'deposit_then_rest': {
      const raw =
        settings.depositType === 'percent'
          ? (safeTotal * clamp(settings.depositValue, 0, 100)) / 100
          : settings.depositValue;
      return round2(clamp(raw, 0, safeTotal));
    }
    case 'partial_then_final': {
      const raw = (safeTotal * clamp(settings.partialPercent, 0, 100)) / 100;
      return round2(clamp(raw, 0, safeTotal));
    }
  }
};
