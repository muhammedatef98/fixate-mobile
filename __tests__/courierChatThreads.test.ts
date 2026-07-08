import {
  isCourierChatThread,
  partyStop,
  partyPhone,
  threadCounterpartLabel,
} from '../utils/courierChatThreads';

describe('isCourierChatThread', () => {
  test('accepts the two threads and rejects everything else', () => {
    expect(isCourierChatThread('technician')).toBe(true);
    expect(isCourierChatThread('customer')).toBe(true);
    expect(isCourierChatThread('admin')).toBe(false);
    expect(isCourierChatThread(undefined)).toBe(false);
  });
});

describe('partyStop / partyPhone (who sits at which end of a leg)', () => {
  test('pickup leg: customer is the origin, technician the destination', () => {
    expect(partyStop('pickup', 'customer')).toBe('pickup');
    expect(partyStop('pickup', 'technician')).toBe('dropoff');
  });

  test('return leg: technician is the origin, customer the destination', () => {
    expect(partyStop('return', 'technician')).toBe('pickup');
    expect(partyStop('return', 'customer')).toBe('dropoff');
  });

  test('resolves the right phone per party and leg', () => {
    const pickupTask = {
      task_type: 'pickup' as const,
      pickup_contact_phone: '0500000001', // customer
      dropoff_contact_phone: '0500000002', // technician
    };
    expect(partyPhone(pickupTask, 'customer')).toBe('0500000001');
    expect(partyPhone(pickupTask, 'technician')).toBe('0500000002');

    const returnTask = {
      task_type: 'return' as const,
      pickup_contact_phone: '0500000002', // technician
      dropoff_contact_phone: '0500000001', // customer
    };
    expect(partyPhone(returnTask, 'customer')).toBe('0500000001');
    expect(partyPhone(returnTask, 'technician')).toBe('0500000002');
  });

  test('missing contact info yields null, not a wrong number', () => {
    const task = {
      task_type: 'pickup' as const,
      pickup_contact_phone: null,
      dropoff_contact_phone: null,
    };
    expect(partyPhone(task, 'customer')).toBeNull();
    expect(partyPhone(task, 'technician')).toBeNull();
  });
});

describe('threadCounterpartLabel', () => {
  test('the courier sees the thread party', () => {
    expect(threadCounterpartLabel('technician', true, false)).toBe('Technician');
    expect(threadCounterpartLabel('customer', true, false)).toBe('Customer');
  });

  test('the technician/customer always sees the courier', () => {
    expect(threadCounterpartLabel('technician', false, false)).toBe('Courier');
    expect(threadCounterpartLabel('customer', false, false)).toBe('Courier');
    expect(threadCounterpartLabel('customer', false, true)).toBe('مندوب التوصيل');
  });
});
