import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

export type ScheduledAudience = 'all' | 'customers' | 'technicians';
export type Recurrence = 'none' | 'daily' | 'weekly';

export interface ScheduledNotification {
  id: string;
  title: string;
  body: string;
  audience: ScheduledAudience;
  category: string;
  data: Record<string, unknown>;
  scheduled_at: string;
  recurrence: Recurrence;
  is_sent: boolean;
  sent_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ScheduledInput {
  title: string;
  body: string;
  audience: ScheduledAudience;
  category?: string;
  scheduled_at: string; // ISO
  recurrence?: Recurrence;
  created_by?: string;
}

/** Upcoming (not-yet-sent) scheduled notifications, soonest first. */
export const listUpcomingScheduled = async (): Promise<ScheduledNotification[]> => {
  try {
    const { data, error } = await supabase
      .from('scheduled_notifications')
      .select('*')
      .eq('is_sent', false)
      .order('scheduled_at', { ascending: true })
      .limit(200);
    if (error) throw error;
    return (data ?? []) as ScheduledNotification[];
  } catch (e) {
    logger.warn('listUpcomingScheduled failed', e);
    return [];
  }
};

export const createScheduled = async (input: ScheduledInput): Promise<ScheduledNotification> => {
  const { data, error } = await supabase
    .from('scheduled_notifications')
    .insert({
      title: input.title.trim(),
      body: input.body.trim(),
      audience: input.audience,
      category: input.category ?? 'announcement',
      scheduled_at: input.scheduled_at,
      recurrence: input.recurrence ?? 'none',
      created_by: input.created_by ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ScheduledNotification;
};

/**
 * "Schedule for next month" preset: create 30 daily one-time entries starting
 * tomorrow at the given hour:minute, all sharing the same title/body/audience.
 */
export const scheduleNextMonth = async (
  input: Omit<ScheduledInput, 'scheduled_at' | 'recurrence'>,
  hour: number,
  minute: number
): Promise<number> => {
  const rows = [];
  const base = new Date();
  base.setHours(hour, minute, 0, 0);
  for (let i = 1; i <= 30; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    rows.push({
      title: input.title.trim(),
      body: input.body.trim(),
      audience: input.audience,
      category: input.category ?? 'announcement',
      scheduled_at: d.toISOString(),
      recurrence: 'none' as Recurrence,
      created_by: input.created_by ?? null,
    });
  }
  const { error, count } = await supabase
    .from('scheduled_notifications')
    .insert(rows, { count: 'exact' });
  if (error) throw error;
  return count ?? rows.length;
};

export const deleteScheduled = async (id: string): Promise<void> => {
  const { error } = await supabase.from('scheduled_notifications').delete().eq('id', id);
  if (error) throw error;
};
