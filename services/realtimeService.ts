import { supabase } from './supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Order } from './orderService';

/**
 * Subscribe to real-time order updates
 */
export const subscribeToOrders = (
  callback: (order: Order) => void
): RealtimeChannel => {
  const channel = supabase
    .channel('orders-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders',
      },
      (payload) => {
        console.log('Order change received:', payload);
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          callback(payload.new as Order);
        }
      }
    )
    .subscribe();

  return channel;
};

/**
 * Subscribe to pending orders for technicians
 */
export const subscribeToPendingOrders = (
  callback: (order: Order) => void
): RealtimeChannel => {
  const channel = supabase
    .channel('pending-orders')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'orders',
        filter: 'status=eq.pending',
      },
      (payload) => {
        console.log('New pending order:', payload);
        callback(payload.new as Order);
      }
    )
    .subscribe();

  return channel;
};

/**
 * Subscribe to specific order updates
 */
export const subscribeToOrderUpdates = (
  orderId: string,
  callback: (order: Order) => void
): RealtimeChannel => {
  const channel = supabase
    .channel(`order-${orderId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${orderId}`,
      },
      (payload) => {
        console.log('Order updated:', payload);
        callback(payload.new as Order);
      }
    )
    .subscribe();

  return channel;
};

/**
 * Unsubscribe from a channel
 */
export const unsubscribeFromChannel = async (channel: RealtimeChannel) => {
  await supabase.removeChannel(channel);
};
