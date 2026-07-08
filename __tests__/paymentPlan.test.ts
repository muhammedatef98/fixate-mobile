import {
  computeUpfrontDue,
  isPaymentMode,
  DEFAULT_PAYMENT_MODE_SETTINGS,
  type PaymentModeSettings,
} from '../utils/paymentPlan';
import { getOrderTotals } from '../utils/orderMoney';

const settings = (over: Partial<PaymentModeSettings>): PaymentModeSettings => ({
  ...DEFAULT_PAYMENT_MODE_SETTINGS,
  ...over,
});

describe('computeUpfrontDue', () => {
  test('full_upfront charges the whole total', () => {
    expect(computeUpfrontDue(350, settings({ mode: 'full_upfront' }))).toBe(350);
  });

  test('deposit_then_rest with a fixed deposit', () => {
    expect(
      computeUpfrontDue(350, settings({ mode: 'deposit_then_rest', depositType: 'fixed', depositValue: 50 }))
    ).toBe(50);
  });

  test('fixed deposit is capped at the total', () => {
    expect(
      computeUpfrontDue(30, settings({ mode: 'deposit_then_rest', depositType: 'fixed', depositValue: 50 }))
    ).toBe(30);
  });

  test('deposit_then_rest with a percent deposit', () => {
    expect(
      computeUpfrontDue(200, settings({ mode: 'deposit_then_rest', depositType: 'percent', depositValue: 25 }))
    ).toBe(50);
  });

  test('partial_then_final charges the configured percent', () => {
    expect(
      computeUpfrontDue(300, settings({ mode: 'partial_then_final', partialPercent: 50 }))
    ).toBe(150);
  });

  test('percent values are clamped to 0–100', () => {
    expect(
      computeUpfrontDue(100, settings({ mode: 'partial_then_final', partialPercent: 150 }))
    ).toBe(100);
  });

  test('never returns a negative amount', () => {
    expect(computeUpfrontDue(-10, settings({ mode: 'full_upfront' }))).toBe(0);
  });

  test('rounds to 2 decimals', () => {
    expect(
      computeUpfrontDue(99.99, settings({ mode: 'partial_then_final', partialPercent: 33 }))
    ).toBeCloseTo(33.0, 2);
  });
});

describe('isPaymentMode', () => {
  test('accepts the three modes and rejects everything else', () => {
    expect(isPaymentMode('full_upfront')).toBe(true);
    expect(isPaymentMode('deposit_then_rest')).toBe(true);
    expect(isPaymentMode('partial_then_final')).toBe(true);
    expect(isPaymentMode('quoted')).toBe(false);
    expect(isPaymentMode(null)).toBe(false);
  });
});

describe('getOrderTotals', () => {
  test('accepted offer is the price basis; estimate stays separate', () => {
    const t = getOrderTotals({
      estimated_price: 200,
      accepted_offer_amount: 300,
      delivery_fee: 20,
      discount_amount: 10,
      accessories: [{ price: 30 }],
      protection_addons: null,
      amount_paid: 0,
      payment_mode: 'full_upfront',
      upfront_amount_due: 340,
    });
    expect(t.agreedAmount).toBe(300);
    expect(t.total).toBe(340); // 300 + 20 + 30 − 10
    expect(t.dueNow).toBe(340);
    expect(t.remaining).toBe(340);
  });

  test('legacy rows fall back to final_price then estimated_price', () => {
    expect(getOrderTotals({ final_price: 250, estimated_price: 100 }).agreedAmount).toBe(250);
    expect(getOrderTotals({ estimated_price: 100 }).agreedAmount).toBe(100);
  });

  test('paid and remaining reflect amount_paid', () => {
    const t = getOrderTotals({
      accepted_offer_amount: 200,
      amount_paid: 50,
      payment_mode: 'deposit_then_rest',
      upfront_amount_due: 50,
    });
    expect(t.paid).toBe(50);
    expect(t.remaining).toBe(150);
    expect(t.dueNow).toBe(50);
  });

  test('server due-now snapshot is capped at the total', () => {
    const t = getOrderTotals({
      accepted_offer_amount: 100,
      upfront_amount_due: 500,
      payment_mode: 'full_upfront',
    });
    expect(t.dueNow).toBe(100);
  });

  test('missing snapshot falls back to a mode-derived due-now', () => {
    const t = getOrderTotals({
      accepted_offer_amount: 200,
      payment_mode: 'partial_then_final',
    });
    // default partialPercent = 50
    expect(t.dueNow).toBe(100);
  });

  test('internal spare-part cost never affects customer totals', () => {
    const t = getOrderTotals({
      accepted_offer_amount: 300,
      // spare_parts_cost intentionally not part of the money interface —
      // passing it as an extra key must be a no-op.
      ...( { spare_parts_cost: 120 } as any),
    });
    expect(t.total).toBe(300);
  });
});
