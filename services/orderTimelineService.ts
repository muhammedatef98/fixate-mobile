import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

export type TimelineActorType = 'customer' | 'technician' | 'courier' | 'admin' | 'system';

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

/**
 * Labels for NON-order-status timeline rows: courier leg events (written by
 * the delivery_tasks trigger as courier_<leg>_<status>) and handoff handshake
 * confirmations (written by confirm_delivery_handoff). One shared source so
 * the customer's order-details and the admin's order detail never drift.
 */
export const TIMELINE_EVENT_LABELS: Record<string, { ar: string; en: string; icon: string }> = {
  courier_pickup_accepted: { ar: 'المندوب في الطريق لاستلام الجهاز من العميل', en: 'Courier heading to collect from the customer', icon: 'moped' },
  courier_pickup_picked_up: { ar: 'تم استلام الجهاز من العميل', en: 'Device collected from customer', icon: 'package-up' },
  courier_pickup_delivered: { ar: 'تم تسليم الجهاز للفني', en: 'Device delivered to the technician', icon: 'account-wrench' },
  courier_return_accepted: { ar: 'المندوب في الطريق لإعادة الجهاز', en: 'Courier heading out to return the device', icon: 'moped' },
  courier_return_picked_up: { ar: 'استلم المندوب الجهاز من الفني', en: 'Courier collected the device from the technician', icon: 'package-up' },
  courier_return_delivered: { ar: 'تمت إعادة الجهاز إلى العميل', en: 'Device returned to the customer', icon: 'check-decagram' },
  handoff_pickup_pickup_confirmed: { ar: 'أكد العميل تسليم الجهاز للمندوب', en: 'Customer confirmed handing the device to the courier', icon: 'handshake' },
  handoff_pickup_delivery_confirmed: { ar: 'أكد الفني استلام الجهاز', en: 'Technician confirmed receiving the device', icon: 'handshake' },
  handoff_return_pickup_confirmed: { ar: 'أكد الفني تسليم الجهاز للمندوب', en: 'Technician confirmed handing the device to the courier', icon: 'handshake' },
  handoff_return_delivery_confirmed: { ar: 'أكد العميل استلام الجهاز — اكتمل الطلب', en: 'Customer confirmed receipt — order completed', icon: 'check-decagram' },
};

/** Label+icon for a courier/handoff timeline event, or null for plain order statuses. */
export const timelineEventLabel = (
  status: string,
  isRTL: boolean
): { label: string; icon: string } | null => {
  const hit = TIMELINE_EVENT_LABELS[status];
  return hit ? { label: isRTL ? hit.ar : hit.en, icon: hit.icon } : null;
};

/** Arabic / English label for an actor type. */
export const actorTypeLabel = (t: TimelineActorType, isRTL: boolean): string => {
  const map: Record<TimelineActorType, [string, string]> = {
    customer: ['العميل', 'Customer'],
    technician: ['الفني', 'Technician'],
    courier: ['المندوب', 'Courier'],
    admin: ['الإدارة', 'Admin'],
    system: ['النظام', 'System'],
  };
  const m = map[t] ?? map.system;
  return isRTL ? m[0] : m[1];
};
