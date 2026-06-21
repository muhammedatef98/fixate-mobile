import type { RealtimeChannel } from '@supabase/supabase-js';
import { Order } from './orderService';
import { logger } from '../utils/logger';
import { subscribeUnique } from '../utils/realtimeChannel';
import { supabase } from './supabaseClient';

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
 * Listen for orders that have just LEFT the available pool (accepted by
 * another technician, cancelled, etc.) so they can be removed from every
 * technician's "available orders" list instantly.
 *
 * Why broadcast instead of postgres_changes: the technician RLS policy only
 * grants SELECT on `status = 'pending' AND technician_id IS NULL`. The moment
 * an order is accepted it stops matching that policy, so a `postgres_changes`
 * UPDATE event is filtered out by Realtime authorization and never reaches
 * the other technicians. A database trigger broadcasts the order id to the
 * shared private `available-orders` topic, which is not row-RLS-gated, so
 * every connected technician receives the removal in real time.
 *
 * @returns synchronous cleanup callable for a useEffect cleanup.
 */
export const subscribeToAvailableOrderRemovals = (
  onRemove: (orderId: string) => void
): (() => void) => {
  let channel: RealtimeChannel | null = null;
  let cancelled = false;

  (async () => {
    try {
      // Sign the realtime socket so the private channel is authorized.
      await supabase.realtime.setAuth();
    } catch (e) {
      logger.warn('realtime setAuth failed (available-orders)', e);
    }
    if (cancelled) return;
    try {
      channel = supabase
        .channel('available-orders', { config: { private: true } })
        .on('broadcast', { event: 'order_unavailable' }, (msg: any) => {
          const id =
            msg?.payload?.id ??
            msg?.payload?.record?.id ??
            msg?.payload?.old_record?.id;
          if (id) onRemove(String(id));
        })
        .subscribe();
    } catch (e) {
      logger.warn('subscribeToAvailableOrderRemovals failed', e);
    }
  })();

  return () => {
    cancelled = true;
    if (channel) {
      supabase.removeChannel(channel);
      channel = null;
    }
  };
};

/**
 * @deprecated The new helpers already return their own cleanup —
 * just call it directly. Kept as a no-op pass-through so legacy
 * call sites compile.
 */
export const unsubscribeFromChannel = async (cleanup: (() => void) | any) => {
  if (typeof cleanup === 'function') cleanup();
};
