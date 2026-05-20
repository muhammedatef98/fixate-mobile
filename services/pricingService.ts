// Centralised pricing calculator for the customer-facing request flow.
//
// Goal: every screen that shows a "what will I owe" number computes it
// from the same input so we never disagree with ourselves. The output is a
// structured `PricingBreakdown` made of itemised lines plus the running
// totals — ready to render directly as an invoice.

import { SPARE_PART_MULTIPLIERS, type SparePartQuality, type AddonItem } from '../types/order';

export type InvoiceLineKind =
  | 'base'
  | 'spare_quality_adjust'
  | 'addon'
  | 'protection'
  | 'inspection'
  | 'delivery'
  | 'return'
  | 'commitment'
  | 'discount'
  | 'subtotal'
  | 'total'
  | 'loyalty';

export interface InvoiceLine {
  /** Stable identifier so callers can key React lists deterministically. */
  id: string;
  kind: InvoiceLineKind;
  labelAr: string;
  labelEn: string;
  /** Amount in SAR. Discounts are negative. Informational lines (loyalty
   *  points earned) can pass amount=0 with a `note`. */
  amount: number;
  /** Optional small caption shown under the label (e.g. "Top quality"). */
  noteAr?: string;
  noteEn?: string;
}

export interface PricingBreakdown {
  lines: InvoiceLine[];
  /** Sum before discounts. */
  subtotal: number;
  /** Total discounts (already as a positive number for display). */
  discountTotal: number;
  /** Final amount the customer would owe at completion of repair. */
  total: number;
  /** Amount due now to confirm the booking (pre-inspection). */
  commitmentDue: number;
  /** Indicative loyalty points the customer would earn on completion. */
  pointsEarned: number;
}

export interface PricingInput {
  baseEstimate: number;
  sparePartQuality: SparePartQuality;
  accessories: AddonItem[];
  protection: AddonItem[];
  deliveryFee: number;
  inspectionFee?: number;
  /** Pre-inspection commitment (e.g. 50 SAR). Pass 0 to skip. */
  commitmentFee?: number;
  /** Discount amount in SAR (subtracted from subtotal). */
  discountAmount?: number;
  discountCode?: string;
  /** Loyalty earn rate (points per 1 SAR). */
  loyaltyPointsPerSAR?: number;
}

const round = (n: number) => Math.round(n);

/**
 * Build the invoice breakdown. Pure — no side effects.
 *
 * Conventions:
 * - The "base" line is the issue estimate AT the chosen spare-part tier.
 *   The multiplier difference is folded into the base for clarity, with a
 *   noteEn/noteAr describing the tier. We do NOT split it into a separate
 *   "spare quality" line because doing so makes the invoice noisy.
 * - All "Starts from" framing is dropped here — the breakdown only shows
 *   the actual numbers that go into the total. The early flow may still
 *   surface non-binding ranges, but the invoice never does.
 */
export const buildPricingBreakdown = (input: PricingInput): PricingBreakdown => {
  const lines: InvoiceLine[] = [];

  const tierMultiplier = SPARE_PART_MULTIPLIERS[input.sparePartQuality] ?? 1;
  const base = round((input.baseEstimate || 0) * tierMultiplier);
  if (base > 0) {
    const tierNoteAr =
      input.sparePartQuality === 'original'
        ? 'الجودة الأعلى'
        : input.sparePartQuality === 'high_quality'
        ? 'موصى به'
        : 'الأوفر';
    const tierNoteEn =
      input.sparePartQuality === 'original'
        ? 'Top quality'
        : input.sparePartQuality === 'high_quality'
        ? 'Recommended'
        : 'Best value';
    lines.push({
      id: 'base',
      kind: 'base',
      labelAr: 'إصلاح الجهاز',
      labelEn: 'Device repair',
      amount: base,
      noteAr: tierNoteAr,
      noteEn: tierNoteEn,
    });
  }

  input.accessories.forEach((a) => {
    lines.push({
      id: `acc-${a.id}`,
      kind: 'addon',
      labelAr: a.name_ar,
      labelEn: a.name_en,
      amount: round(a.price || 0),
    });
  });

  input.protection.forEach((p) => {
    lines.push({
      id: `prot-${p.id}`,
      kind: 'protection',
      labelAr: p.name_ar,
      labelEn: p.name_en,
      amount: round(p.price || 0),
    });
  });

  if ((input.inspectionFee ?? 0) > 0) {
    lines.push({
      id: 'inspection',
      kind: 'inspection',
      labelAr: 'رسوم الفحص',
      labelEn: 'Inspection fee',
      amount: round(input.inspectionFee!),
    });
  }

  if ((input.deliveryFee ?? 0) > 0) {
    lines.push({
      id: 'delivery',
      kind: 'delivery',
      labelAr: 'رسوم التوصيل',
      labelEn: 'Delivery fee',
      amount: round(input.deliveryFee),
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.amount, 0);

  let discountTotal = 0;
  if ((input.discountAmount ?? 0) > 0) {
    discountTotal = round(input.discountAmount!);
    lines.push({
      id: 'discount',
      kind: 'discount',
      labelAr: input.discountCode ? `خصم (${input.discountCode})` : 'خصم',
      labelEn: input.discountCode ? `Discount (${input.discountCode})` : 'Discount',
      amount: -discountTotal,
    });
  }

  const commitmentDue = Math.max(0, round(input.commitmentFee ?? 0));
  if (commitmentDue > 0) {
    lines.push({
      id: 'commitment',
      kind: 'commitment',
      labelAr: 'مبلغ التأكيد (يُدفع الآن قبل الفحص)',
      labelEn: 'Commitment amount (paid now, pre-inspection)',
      amount: commitmentDue,
      noteAr: 'يُخصم من الفاتورة النهائية',
      noteEn: 'Deducted from the final bill',
    });
  }

  const total = Math.max(0, subtotal - discountTotal);
  const pointsRate = input.loyaltyPointsPerSAR ?? 1;
  const pointsEarned = Math.max(0, Math.floor(total * pointsRate));

  return {
    lines,
    subtotal,
    discountTotal,
    total,
    commitmentDue,
    pointsEarned,
  };
};
