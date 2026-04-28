import { supabase } from './supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Order } from './orderService';
import { logger } from '../utils/logger';

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
        logger.debug('Order change received', payload);
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          callback(payload.new as Order);
        }
      }
    )
    .subscribe();

  return channel;
};

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
        logger.debug('New pending order', payload);
        callback(payload.new as Order);
      }
    )
    .subscribe();

  return channel;
};

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
        logger.debug('Order updated', payload);
        callback(payload.new as Order);
      }
    )
    .subscribe();

  return channel;
};

export const unsubscribeFromChannel = async (channel: RealtimeChannel) => {
  await supabase.removeChannel(channel);
};
