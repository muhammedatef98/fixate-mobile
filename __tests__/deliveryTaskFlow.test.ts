import {
  nextDeliveryAction,
  deliveryLegLabel,
  computeCourierStats,
  DELIVERY_STATUS_LABELS,
  type DeliveryTaskStatus,
  type DeliveryTaskType,
} from '../utils/deliveryTasks';

describe('nextDeliveryAction (courier task state machine)', () => {
  it('walks the fixed lifecycle one step at a time', () => {
    expect(nextDeliveryAction('accepted')?.next).toBe('picked_up');
    expect(nextDeliveryAction('picked_up')?.next).toBe('delivered');
    expect(nextDeliveryAction('delivered')?.next).toBe('completed');
  });

  it('offers no action on terminal or unclaimed states', () => {
    expect(nextDeliveryAction('available')).toBeNull();
    expect(nextDeliveryAction('completed')).toBeNull();
    expect(nextDeliveryAction('cancelled')).toBeNull();
  });

  it('provides bilingual labels for every action', () => {
    for (const s of ['accepted', 'picked_up', 'delivered'] as DeliveryTaskStatus[]) {
      const action = nextDeliveryAction(s);
      expect(action?.ar).toBeTruthy();
      expect(action?.en).toBeTruthy();
    }
  });
});

describe('DELIVERY_STATUS_LABELS', () => {
  it('covers every status in both languages', () => {
    const statuses: DeliveryTaskStatus[] = [
      'available',
      'accepted',
      'picked_up',
      'delivered',
      'completed',
      'cancelled',
    ];
    for (const s of statuses) {
      expect(DELIVERY_STATUS_LABELS[s]?.ar).toBeTruthy();
      expect(DELIVERY_STATUS_LABELS[s]?.en).toBeTruthy();
    }
  });
});

describe('nextDeliveryAction (leg-aware copy)', () => {
  it('names the counterpart per leg', () => {
    expect(nextDeliveryAction('accepted', 'pickup')?.en).toContain('customer');
    expect(nextDeliveryAction('accepted', 'return')?.en).toContain('technician');
    expect(nextDeliveryAction('picked_up', 'pickup')?.en).toContain('technician');
    expect(nextDeliveryAction('picked_up', 'return')?.en).toContain('customer');
  });

  it('keeps the same transitions regardless of leg', () => {
    for (const leg of ['pickup', 'return'] as DeliveryTaskType[]) {
      expect(nextDeliveryAction('accepted', leg)?.next).toBe('picked_up');
      expect(nextDeliveryAction('picked_up', leg)?.next).toBe('delivered');
      expect(nextDeliveryAction('delivered', leg)?.next).toBe('completed');
      expect(nextDeliveryAction('completed', leg)).toBeNull();
    }
  });
});

describe('deliveryLegLabel (custody wording)', () => {
  const statuses: DeliveryTaskStatus[] = [
    'available', 'accepted', 'picked_up', 'delivered', 'completed', 'cancelled',
  ];

  it('covers every (leg, status) pair in both languages', () => {
    for (const leg of ['pickup', 'return'] as DeliveryTaskType[]) {
      for (const st of statuses) {
        const l = deliveryLegLabel(leg, st);
        expect(l.ar).toBeTruthy();
        expect(l.en).toBeTruthy();
      }
    }
  });

  it('reflects the hand-off direction', () => {
    expect(deliveryLegLabel('pickup', 'picked_up').en).toContain('technician');
    expect(deliveryLegLabel('pickup', 'completed').en).toContain('technician');
    expect(deliveryLegLabel('return', 'picked_up').en).toContain('customer');
    expect(deliveryLegLabel('return', 'completed').en).toContain('customer');
  });
});

describe('computeCourierStats (profile numbers from real tasks)', () => {
  const t = (task_type: DeliveryTaskType, status: DeliveryTaskStatus, courier_fee: number | null = null) =>
    ({ task_type, status, courier_fee });

  test('counts completed / active and splits by leg', () => {
    const stats = computeCourierStats([
      t('pickup', 'completed', 20),
      t('return', 'completed', 15),
      t('pickup', 'completed'),
      t('pickup', 'picked_up'),
      t('return', 'accepted'),
      t('pickup', 'cancelled'),
      t('pickup', 'available'),
    ]);
    expect(stats.completed).toBe(3);
    expect(stats.pickupCompleted).toBe(2);
    expect(stats.returnCompleted).toBe(1);
    expect(stats.active).toBe(2);
    expect(stats.feesEarned).toBe(35);
  });

  test('fees only count completed tasks and ignore junk values', () => {
    const stats = computeCourierStats([
      t('pickup', 'accepted', 99),
      t('pickup', 'completed', 'not-a-number' as unknown as number),
      t('return', 'completed', 10.505),
    ]);
    expect(stats.feesEarned).toBe(10.51);
  });

  test('empty input yields all-zero stats', () => {
    expect(computeCourierStats([])).toEqual({
      completed: 0,
      active: 0,
      pickupCompleted: 0,
      returnCompleted: 0,
      feesEarned: 0,
    });
  });
});
