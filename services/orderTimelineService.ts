import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

export type TimelineActorType = 'customer' | 'technician' | 'admin' | 'system';

export interface OrderTimelineEvent {
  id: string;
  order_id: string;
  status: string;
  actor_type: TimelineActorType;
  actor_id: string | null;
  note: string | null;
  created_at: string;
}

/**
 * Read an order's status-change timeline (§13), oldest → newest. Rows are
 * written automatically by the `log_order_status_change` trigger, so this is
 * read-only. Returns [] on any error so the timeline section degrades quietly.
 */
export const getOrderTimeline = async (orderId: string): Promise<OrderTimelineEvent[]> => {
  if (!orderId) return [];
  try {
    const { data, error } = await supabase
      .from('order_timeline')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as OrderTimelineEvent[];
  } catch (e) {
    logger.warn('getOrderTimeline failed', e);
    return [];
  }
};

/** Arabic / English label for an actor type. */
export const actorTypeLabel = (t: TimelineActorType, isRTL: boolean): string => {
  const map: Record<TimelineActorType, [string, string]> = {
    customer: ['العميل', 'Customer'],
    technician: ['الفني', 'Technician'],
    admin: ['الإدارة', 'Admin'],
    system: ['النظام', 'System'],
  };
  const m = map[t] ?? map.system;
  return isRTL ? m[0] : m[1];
};
