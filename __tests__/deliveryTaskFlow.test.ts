import {
  nextDeliveryAction,
  deliveryLegLabel,
  computeCourierStats,
  confirmableHandoff,
  DELIVERY_STATUS_LABELS,
  type DeliveryTaskStatus,
  type DeliveryTaskType,
  type HandoffTaskState,
} from '../utils/deliveryTasks';

describe('nextDeliveryAction (courier task state machine)', () => {
  it('walks the fixed lifecycle one step at a time', () => {
    expect(nextDeliveryAction('accepted')?.next).toBe('picked_up');
    expect(nextDeliveryAction('picked_up')?.next).toBe('delivered');
  });

  it('offers no action once delivered — the receiver closes the task', () => {
    expect(nextDeliveryAction('delivered')).toBeNull();
  });

  it('offers no action on terminal or unclaimed states', () => {
    expect(nextDeliveryAction('available')).toBeNull();
    expect(nextDeliveryAction('completed')).toBeNull();
    expect(nextDeliveryAction('cancelled')).toBeNull();
  });

  it('provides bilingual labels for every action', () => {
    for (const s of ['accepted', 'picked_up'] as DeliveryTaskStatus[]) {
      const action = nextDeliveryAction(s);
      expect(action?.ar).toBeTruthy();
      expect(action?.en).toBeTruthy();
    }
  });
});

describe('confirmableHandoff (two-sided handshake)', () => {
  const task = (
    task_type: DeliveryTaskType,
    status: DeliveryTaskStatus,
    pickup_confirmed_at: string | null = null,
    delivery_confirmed_at: string | null = null
  ): HandoffTaskState => ({ task_type, status, pickup_confirmed_at, delivery_confirmed_at });

  it('pickup leg: customer confirms hand-over, technician confirms receipt', () => {
    expect(confirmableHandoff(task('pickup', 'picked_up'), 'customer')).toBe('pickup');
    expect(confirmableHandoff(task('pickup', 'delivered'), 'customer')).toBe('pickup');
    expect(confirmableHandoff(task('pickup', 'delivered'), 'technician')).toBe('delivery');
    expect(confirmableHandoff(task('pickup', 'picked_up'), 'technician')).toBeNull();
  });

  it('return leg: technician confirms hand-over, customer confirms receipt', () => {
    expect(confirmableHandoff(task('return', 'picked_up'), 'technician')).toBe('pickup');
    expect(confirmableHandoff(task('return', 'delivered'), 'customer')).toBe('delivery');
    expect(confirmableHandoff(task('return', 'picked_up'), 'customer')).toBeNull();
  });

  it('never re-asks once a confirmation is recorded', () => {
    expect(confirmableHandoff(task('pickup', 'picked_up', '2026-01-01'), 'customer')).toBeNull();
    expect(confirmableHandoff(task('return', 'delivered', null, '2026-01-01'), 'customer')).toBeNull();
  });

  it('asks nothing before the courier has the device or after completion', () => {
    for (const role of ['customer', 'technician'] as const) {
      expect(confirmableHandoff(task('pickup', 'accepted'), role)).toBeNull();
      expect(confirmableHandoff(task('pickup', 'available'), role)).toBeNull();
      expect(confirmableHandoff(task('pickup', 'cancelled'), role)).toBeNull();
    }
    // Completed with both confirmations — nothing left to do.
    expect(
      confirmableHandoff(task('return', 'completed', '2026-01-01', '2026-01-01'), 'customer')
    ).toBeNull();
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
      expect(nextDeliveryAction('delivered', leg)).toBeNull();
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
