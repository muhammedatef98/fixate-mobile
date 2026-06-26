import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

export interface NotificationAutomation {
  id: string;
  trigger_event: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

export const listAutomations = async (): Promise<NotificationAutomation[]> => {
  try {
    const { data, error } = await supabase
      .from('notification_automations')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as NotificationAutomation[];
  } catch (e) {
    logger.warn('listAutomations failed', e);
    return [];
  }
};

export const setAutomationActive = async (id: string, isActive: boolean): Promise<void> => {
  const { error } = await supabase
    .from('notification_automations')
    .update({ is_active: isActive })
    .eq('id', id);
  if (error) throw error;
};

export const updateAutomation = async (
  id: string,
  patch: { title?: string; body?: string }
): Promise<NotificationAutomation> => {
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) update.title = patch.title.trim();
  if (patch.body !== undefined) update.body = patch.body.trim();
  const { data, error } = await supabase
    .from('notification_automations')
    .update(update)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as NotificationAutomation;
};
