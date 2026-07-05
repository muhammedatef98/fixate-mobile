import {
  nextDeliveryAction,
  DELIVERY_STATUS_LABELS,
  type DeliveryTaskStatus,
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
