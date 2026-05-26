import { Order } from './orderService';
import { logger } from '../utils/logger';
import { subscribeUnique } from '../utils/realtimeChannel';

/**
 * Realtime subscriptions for the orders table. All three helpers go
 * through `subscribeUnique` so they cannot fall into the
 * "cannot add 'postgres_changes' callbacks ... after subscribe()"
 * race: a re-mount no longer collides with a previous channel that
 * has not yet finished its async LEAVE round-trip.
 *
 * Each helper now returns a synchronous cleanup function — call it
 * from a `useEffect` cleanup to detach.
 */

export const subscribeToOrders = (
  callback: (order: Order) => void
): (() => void) => {
  return subscribeUnique('orders-changes', (ch) =>
    ch.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders' },
      (payload: any) => {
        logger.debug('Order change received', payload);
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          callback(payload.new as Order);
        }
      }
    )
  );
};

export const subscribeToPendingOrders = (
  callback: (order: Order) => void
): (() => void) => {
  return subscribeUnique('pending-orders', (ch) =>
    ch.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'orders',
        filter: 'status=eq.pending',
      },
      (payload: any) => {
        logger.debug('New pending order', payload);
        callback(payload.new as Order);
      }
    )
  );
};

export const subscribeToOrderUpdates = (
  orderId: string,
  callback: (order: Order) => void
): (() => void) => {
  return subscribeUnique(`order-${orderId}`, (ch) =>
    ch.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${orderId}`,
      },
      (payload: any) => {
        logger.debug('Order updated', payload);
        callback(payload.new as Order);
      }
    )
  );
};

/**
 * @deprecated The new helpers already return their own cleanup —
 * just call it directly. Kept as a no-op pass-through so legacy
 * call sites compile.
 */
export const unsubscribeFromChannel = async (cleanup: (() => void) | any) => {
  if (typeof cleanup === 'function') cleanup();
};
