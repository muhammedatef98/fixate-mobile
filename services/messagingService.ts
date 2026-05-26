import { supabase } from './supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { subscribeUnique } from '../utils/realtimeChannel';

export interface Message {
  id: string;
  order_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

/**
 * Send a message in an order chat
 */
export const sendMessage = async (
  orderId: string,
  senderId: string,
  content: string
): Promise<Message | null> => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        order_id: orderId,
        sender_id: senderId,
        content,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    logger.error('Send message error', error);
    throw error;
  }
};

/**
 * Get messages for an order
 */
export const getMessages = async (orderId: string): Promise<Message[]> => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    logger.error('Get messages error', error);
    return [];
  }
};

/**
 * Subscribe to real-time messages for an order
 */
export const subscribeToMessages = (
  orderId: string,
  callback: (message: Message) => void
): (() => void) => {
  // Returns a synchronous cleanup function suitable for useEffect
  // cleanup. subscribeUnique avoids the realtime "callbacks after
  // subscribe()" race on re-mount.
  return subscribeUnique(`messages:${orderId}`, (ch) =>
    ch.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `order_id=eq.${orderId}`,
      },
      (payload: any) => callback(payload.new as Message)
    )
  );
};

/** @deprecated subscribeToMessages now returns its own cleanup. */
export const unsubscribeFromMessages = (cleanup: any) => {
  if (typeof cleanup === 'function') cleanup();
};

/**
 * Mark messages as read
 */
export const markMessagesAsRead = async (orderId: string, userId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('order_id', orderId)
      .neq('sender_id', userId);

    if (error) throw error;
  } catch (error: any) {
    logger.error('Mark messages as read error', error);
    throw error;
  }
};
