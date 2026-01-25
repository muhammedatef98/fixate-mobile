import { supabase } from './supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';

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
    console.error('Send message error:', error);
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
    console.error('Get messages error:', error);
    return [];
  }
};

/**
 * Subscribe to real-time messages for an order
 */
export const subscribeToMessages = (
  orderId: string,
  callback: (message: Message) => void
): RealtimeChannel => {
  const channel = supabase
    .channel(`messages:${orderId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `order_id=eq.${orderId}`,
      },
      (payload) => {
        callback(payload.new as Message);
      }
    )
    .subscribe();

  return channel;
};

/**
 * Unsubscribe from messages channel
 */
export const unsubscribeFromMessages = async (channel: RealtimeChannel) => {
  await supabase.removeChannel(channel);
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
    console.error('Mark messages as read error:', error);
    throw error;
  }
};
