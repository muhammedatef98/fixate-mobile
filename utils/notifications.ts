import { supabase } from '../services/supabaseClient';
import { logger } from './logger';

export type NotificationType =
  | 'order'
  | 'listing'
  | 'message'
  | 'comment'
  | 'general';

export interface AppNotification {
  id: string;
  user_id: string;
  title_ar: string;
  title_en: string;
  body_ar: string | null;
  body_en: string | null;
  type: string;
  is_read: boolean;
  related_id: string | null;
  created_at: string;
}

export interface SendNotificationData {
  titleAr: string;
  titleEn: string;
  bodyAr?: string;
  bodyEn?: string;
  type?: NotificationType;
  relatedId?: string;
}

/**
 * Insert an in-app notification for a user. Most notifications are created
 * automatically by database triggers (order/listing/message events); use
 * this helper for any ad-hoc notification raised from app code.
 */
export const sendNotification = async (
  userId: string,
  data: SendNotificationData
): Promise<void> => {
  try {
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      title_ar: data.titleAr,
      title_en: data.titleEn,
      body_ar: data.bodyAr ?? null,
      body_en: data.bodyEn ?? null,
      type: data.type ?? 'general',
      related_id: data.relatedId ?? null,
    });
    if (error) throw error;
  } catch (e) {
    logger.error('sendNotification failed', e);
  }
};

export const fetchNotifications = async (
  userId: string
): Promise<AppNotification[]> => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  } catch (e) {
    logger.warn('fetchNotifications failed', e);
    return [];
  }
};

export const getUnreadCount = async (userId: string): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (error) throw error;
    return count ?? 0;
  } catch (e) {
    logger.warn('getUnreadCount failed', e);
    return 0;
  }
};

export const markAsRead = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
    if (error) throw error;
  } catch (e) {
    logger.warn('markAsRead failed', e);
  }
};

export const markAllAsRead = async (userId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (error) throw error;
  } catch (e) {
    logger.warn('markAllAsRead failed', e);
  }
};

/**
 * Subscribe to realtime changes on the current user's notifications.
 * `onChange` fires on any insert/update/delete — callers re-fetch.
 */
export const subscribeToNotifications = (
  userId: string,
  onChange: () => void
) => {
  const channel = supabase
    .channel(`notifications-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      () => onChange()
    )
    .subscribe();

  return {
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
  };
};
