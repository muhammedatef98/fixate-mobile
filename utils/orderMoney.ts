/**
 * orderMoney.ts — the single client-side source of truth for order amounts.
 *
 * Mirrors the SQL helper public.order_customer_total. Every screen that shows
 * money (payment, order details, technician manage-order, admin) derives its
 * figures from here so amounts can never drift between surfaces.
 *
 * Field semantics (payment architecture v2):
 *   estimated_price       — the customer's initial estimate (never overwritten)
 *   accepted_offer_amount — the accepted marketplace offer (the price basis)
 *   final_price           — legacy pre-v2 quote; read-only fallback
 *   amount_paid           — actually collected so far (record_order_payment)
 *   spare_parts_cost      — INTERNAL cost; deliberately excluded from every
 *                           customer-facing figure in this module
 */
import { computeUpfrontDue, DEFAULT_PAYMENT_MODE_SETTINGS, isPaymentMode, type PaymentMode } from './paymentPlan';

interface MoneyFields {
  estimated_price?: number | null;
  accepted_offer_amount?: number | null;
  final_price?: number | null;
  delivery_fee?: number | null;
  discount_amount?: number | null;
  accessories?: { price?: number }[] | null;
  protection_addons?: { price?: number }[] | null;
  amount_paid?: number | null;
  upfront_amount_due?: number | null;
  payment_mode?: string | null;
}

export interface OrderTotals {
  /** The agreed service price basis (accepted offer, legacy quote fallback). */
  agreedAmount: number;
  /** Customer-facing total: agreed + delivery + add-ons − discount. */
  total: number;
  addonsTotal: number;
  deliveryFee: number;
  discount: number;
  /** Payment-mode snapshot (defaults to full_upfront for legacy rows). */
  paymentMode: PaymentMode;
  /** Due immediately after acceptance (server snapshot, computed fallback). */
  dueNow: number;
  paid: number;
  remaining: number;
}

const num = (v: number | null | undefined): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

const addonsSum = (list: { price?: number }[] | null | undefined): number =>
  Array.isArray(list) ? list.reduce((s, a) => s + num(a?.price), 0) : 0;

export const getOrderTotals = (order: MoneyFields): OrderTotals => {
  const agreedAmount = num(
    order.accepted_offer_amount ?? order.final_price ?? order.estimated_price
  );
  const deliveryFee = num(order.delivery_fee);
  const discount = num(order.discount_amount);
  const addonsTotal = addonsSum(order.accessories) + addonsSum(order.protection_addons);
  const total = round2(Math.max(0, agreedAmount + deliveryFee + addonsTotal - discount));

  const paymentMode: PaymentMode = isPaymentMode(order.payment_mode)
    ? order.payment_mode
    : 'full_upfront';
  const dueNow =
    order.upfront_amount_due != null && Number.isFinite(Number(order.upfront_amount_due))
      ? Math.min(round2(num(order.upfront_amount_due)), total)
      : computeUpfrontDue(total, { ...DEFAULT_PAYMENT_MODE_SETTINGS, mode: paymentMode });

  const paid = round2(num(order.amount_paid));
  const remaining = round2(Math.max(0, total - paid));

  return { agreedAmount, total, addonsTotal, deliveryFee, discount, paymentMode, dueNow, paid, remaining };
};

/** Format a SAR amount for the active locale. */
export const fmtSAR = (amount: number, isRTL: boolean): string =>
  `${amount.toLocaleString(isRTL ? 'ar-SA' : 'en-US')} ${isRTL ? 'ر.س' : 'SAR'}`;
