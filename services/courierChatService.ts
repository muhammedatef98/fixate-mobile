/**
 * courierChatService.ts — operational chat between a delivery task's courier
 * and the order's assigned technician (courier_chat_messages table).
 *
 * The customer is never a participant. RLS enforces membership AND blocks
 * inserts once the task reaches completed/cancelled, so the chat auto-closes
 * with the task lifecycle — the client only mirrors that with a banner.
 */
import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';
import { subscribeUnique } from '../utils/realtimeChannel';
import { notifyUsers } from './notifyService';
import type { DeliveryTaskStatus } from '../utils/deliveryTasks';
import type { CourierChatThread } from '../utils/courierChatThreads';

export type { CourierChatThread } from '../utils/courierChatThreads';

export interface CourierChatMessage {
  id: string;
  task_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  /** Which conversation on the task: courier↔technician or courier↔customer. */
  thread: CourierChatThread;
}

/** Task states in which the chat is still writable (mirrors the RLS check). */
export const isCourierChatOpen = (status: DeliveryTaskStatus): boolean =>
  status === 'accepted' || status === 'picked_up' || status === 'delivered';

export const getCourierChatMessages = async (
  taskId: string,
  thread: CourierChatThread = 'technician'
): Promise<CourierChatMessage[]> => {
  const { data, error } = await supabase
    .from('courier_chat_messages')
    .select('*')
    .eq('task_id', taskId)
    .eq('thread', thread)
    .order('created_at', { ascending: true });
  if (error) {
    logger.warn('getCourierChatMessages failed', error);
    return [];
  }
  return (data ?? []) as CourierChatMessage[];
};

export const sendCourierChatMessage = async (
  taskId: string,
  senderId: string,
  content: string,
  thread: CourierChatThread = 'technician'
): Promise<CourierChatMessage> => {
  const trimmed = content.trim();
  if (!trimmed) throw new Error('empty_message');
  const { data, error } = await supabase
    .from('courier_chat_messages')
    .insert({ task_id: taskId, sender_id: senderId, content: trimmed, thread })
    .select()
    .single();
  if (error) {
    logger.warn('sendCourierChatMessage failed', error);
    throw error;
  }

  // Best-effort push to the other party — never blocks the send.
  void notifyCourierChatCounterpart(taskId, senderId, trimmed, thread);
  return data as CourierChatMessage;
};

const notifyCourierChatCounterpart = async (
  taskId: string,
  senderId: string,
  content: string,
  thread: CourierChatThread
): Promise<void> => {
  try {
    const { data: task } = await supabase
      .from('delivery_tasks')
      .select('courier_id, order_id')
      .eq('id', taskId)
      .maybeSingle();
    if (!task) return;
    let recipient: string | null = null;
    if (task.courier_id && task.courier_id !== senderId) {
      recipient = task.courier_id;
    } else {
      // Sender is the courier — the other seat depends on the thread.
      const { data: order } = await supabase
        .from('orders')
        .select('technician_id, user_id')
        .eq('id', task.order_id)
        .maybeSingle();
      const other = thread === 'technician' ? order?.technician_id : order?.user_id;
      if (other && other !== senderId) recipient = other;
    }
    if (!recipient) return;
    void notifyUsers(recipient, {
      title: 'رسالة جديدة في محادثة التوصيل 🚚',
      body: content.slice(0, 120),
      data: { screen: 'courier-chat', taskId, thread },
    });
  } catch (e) {
    logger.warn('courier chat push failed', e);
  }
};

export const markCourierChatRead = async (
  taskId: string,
  userId: string,
  thread: CourierChatThread = 'technician'
): Promise<void> => {
  const { error } = await supabase
    .from('courier_chat_messages')
    .update({ is_read: true })
    .eq('task_id', taskId)
    .eq('thread', thread)
    .neq('sender_id', userId);
  if (error) logger.warn('markCourierChatRead failed', error);
};

export const subscribeToCourierChat = (
  taskId: string,
  onMessage: (msg: CourierChatMessage) => void,
  thread: CourierChatThread = 'technician'
): (() => void) =>
  subscribeUnique(`courier-chat-${taskId}-${thread}`, (ch) =>
    ch.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'courier_chat_messages',
        filter: `task_id=eq.${taskId}`,
      },
      (payload: any) => {
        const msg = payload.new as CourierChatMessage;
        // RLS already hides the other thread from non-participants; this
        // filter keeps the courier's two threads from bleeding into each
        // other in the UI.
        if ((msg.thread ?? 'technician') === thread) onMessage(msg);
      }
    )
  );
