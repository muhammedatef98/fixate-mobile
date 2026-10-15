import {
  deriveWarranty,
  hasActiveWarranty,
  warrantyMonthsFor,
  warrantyMonthsLabel,
  WARRANTY_POLICY_EFFECTIVE_FROM,
} from '../utils/warranty';

const AFTER = new Date(WARRANTY_POLICY_EFFECTIVE_FROM + 86_400_000).toISOString();
const BEFORE = new Date(WARRANTY_POLICY_EFFECTIVE_FROM - 86_400_000).toISOString();

const order = (over: Record<string, unknown> = {}) => ({
  id: 'o1',
  status: 'completed',
  created_at: AFTER,
  updated_at: AFTER,
  ...over,
});

describe('warrantyMonthsFor', () => {
  it.each([
    ['screen', 'high_quality', 6],
    ['battery', 'economy', 6],
    ['laptop-screen', 'economy', 6],
    ['watch-battery', 'high_quality', 6],
    ['charging', 'economy', 3],
    ['camera', 'high_quality', 3],
    ['laptop-motherboard', 'economy', 3],
    ['laptop-hinge', 'high_quality', 3],
    [null, null, 3],
    ['water-damage', 'economy', 1],
    ['laptop-os', null, 1],
    ['software', 'original', 1],
    ['laptop-liquid', 'original', 1],
    ['phone-data-recovery', 'original', 0],
    ['other-general-diagnose', null, 0],
    ['screen', 'original', 12],
    ['charging', 'original', 12],
  ])('%s with %s parts → %i months', (service_id, spare_part_quality, months) => {
    expect(warrantyMonthsFor(order({ service_id, spare_part_quality }))).toBe(months);
  });

  it('keeps the old 12-month warranty for orders placed before the new policy', () => {
    expect(warrantyMonthsFor(order({ created_at: BEFORE, service_id: 'charging', spare_part_quality: 'economy' }))).toBe(12);
    expect(warrantyMonthsFor(order({ created_at: BEFORE, service_id: 'phone-data-recovery' }))).toBe(12);
  });
});

describe('deriveWarranty', () => {
  it('runs the warranty for the repair length from completion', () => {
    const done = '2027-01-10T10:00:00Z';
    const w = deriveWarranty(order({ service_id: 'screen', spare_part_quality: 'economy', updated_at: done }), Date.parse(done));
    expect(w?.months).toBe(6);
    expect(w?.endDate.toISOString()).toBe('2027-07-10T10:00:00.000Z');
    expect(w?.isActive).toBe(true);
  });

  it('returns null for repairs without a warranty', () => {
    expect(deriveWarranty(order({ service_id: 'laptop-data-recovery' }))).toBeNull();
    expect(hasActiveWarranty(order({ service_id: 'laptop-data-recovery' }))).toBe(false);
  });

  it('expires after the repair length', () => {
    const done = '2027-01-10T10:00:00Z';
    const later = Date.parse('2027-04-11T10:00:00Z');
    const w = deriveWarranty(order({ service_id: 'charging', updated_at: done }), later);
    expect(w?.isActive).toBe(false);
    expect(w?.daysRemaining).toBe(0);
  });
});

describe('warrantyMonthsLabel', () => {
  it('formats Arabic and English lengths', () => {
    expect(warrantyMonthsLabel(1, true)).toBe('شهر واحد');
    expect(warrantyMonthsLabel(3, true)).toBe('3 أشهر');
    expect(warrantyMonthsLabel(6, true)).toBe('6 أشهر');
    expect(warrantyMonthsLabel(12, true)).toBe('12 شهراً');
    expect(warrantyMonthsLabel(1, false)).toBe('1 month');
    expect(warrantyMonthsLabel(6, false)).toBe('6 months');
  });
});
