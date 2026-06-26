import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

export interface NotificationPreferences {
  user_id: string;
  push_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  order_updates: boolean;
  promotions: boolean;
  technician_messages: boolean;
  system_announcements: boolean;
  technician_arrival: boolean;
  updated_at?: string;
}

export const getMyPreferences = async (userId: string): Promise<NotificationPreferences> => {
  try {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
    // Default if not yet created
    return {
      user_id: userId,
      push_enabled: true,
      email_enabled: true,
      sms_enabled: false,
      order_updates: true,
      promotions: false,
      technician_messages: true,
      system_announcements: true,
      technician_arrival: true,
    };
  } catch (error: any) {
    logger.error('getMyPreferences error', error);
    throw error;
  }
};

export const upsertPreferences = async (
  prefs: NotificationPreferences
): Promise<NotificationPreferences> => {
  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert(prefs, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
};
