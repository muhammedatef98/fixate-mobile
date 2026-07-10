/**
 * courierService.ts — courier profile + delivery-task lifecycle.
 *
 * Couriers are a first-class role (see migration
 * 20260704150000_courier_and_offer_marketplace.sql). All task-state mutations
 * go through SECURITY DEFINER RPCs so acceptance is atomic and transitions
 * are enforced server-side; this module is a thin, typed client around them.
 */
import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';
import { subscribeUnique } from '../utils/realtimeChannel';
import { notifyUsers } from './notifyService';

import {
  nextDeliveryAction,
  deliveryLegLabel,
  DELIVERY_STATUS_LABELS,
  type DeliveryTaskType,
  type DeliveryTaskStatus,
} from '../utils/deliveryTasks';

// Pure state-machine helpers live in utils/deliveryTasks (framework-free,
// unit-tested); re-exported here so existing imports keep working.
export {
  nextDeliveryAction,
  deliveryLegLabel,
  DELIVERY_STATUS_LABELS,
  type DeliveryTaskType,
  type DeliveryTaskStatus,
};

export interface DeliveryTask {
  id: string;
  order_id: string;
  task_type: DeliveryTaskType;
  status: DeliveryTaskStatus;
  courier_id: string | null;
  pickup_address: string | null;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  pickup_contact_name: string | null;
  pickup_contact_phone: string | null;
  dropoff_address: string | null;
  dropoff_latitude: number | null;
  dropoff_longitude: number | null;
  dropoff_contact_name: string | null;
  dropoff_contact_phone: string | null;
  courier_contact_phone: string | null;
  notes: string | null;
  courier_fee: number | null;
  created_at: string;
  accepted_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  completed_at: string | null;
}

export interface CourierProfile {
  id: string;
  user_id: string;
  city: string | null;
  vehicle_type: 'car' | 'motorcycle' | 'van' | null;
  id_number: string | null;
  driver_license_number: string | null;
  vehicle_registration_number: string | null;
  verification_status: string;
  verification_notes: string | null;
  courier_status: string;
  available: boolean;
  total_deliveries: number;
  created_at: string;
}

// ── Profile ──────────────────────────────────────────────────────────────────

export const getMyCourierProfile = async (
  userId: string
): Promise<CourierProfile | null> => {
  const { data, error } = await supabase
    .from('couriers')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    logger.warn('getMyCourierProfile failed', error);
    return null;
  }
  return data;
};

export interface CourierApplication {
  city: string;
  vehicle_type: 'car' | 'motorcycle' | 'van';
  id_number?: string;
  driver_license_number: string;
  vehicle_registration_number: string;
}

/** Create or resubmit the courier application (status returns to submitted). */
export const submitCourierApplication = async (
  userId: string,
  app: CourierApplication
): Promise<void> => {
  const { error } = await supabase.from('couriers').upsert(
    {
      user_id: userId,
      city: app.city,
      vehicle_type: app.vehicle_type,
      id_number: app.id_number ?? null,
      driver_license_number: app.driver_license_number,
      vehicle_registration_number: app.vehicle_registration_number,
      verification_status: 'submitted',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
  if (error) {
    logger.warn('submitCourierApplication failed', error);
    throw error;
  }
};

// ── Tasks ────────────────────────────────────────────────────────────────────

export const getAvailableDeliveryTasks = async (): Promise<DeliveryTask[]> => {
  const { data, error } = await supabase
    .from('delivery_tasks')
    .select('*')
    .eq('status', 'available')
    .is('courier_id', null)
    .order('created_at', { ascending: false });
  if (error) {
    logger.warn('getAvailableDeliveryTasks failed', error);
    return [];
  }
  return data ?? [];
};

export const getMyDeliveryTasks = async (
  courierId: string
): Promise<DeliveryTask[]> => {
  const { data, error } = await supabase
    .from('delivery_tasks')
    .select('*')
    .eq('courier_id', courierId)
    .order('created_at', { ascending: false });
  if (error) {
    logger.warn('getMyDeliveryTasks failed', error);
    return [];
  }
  return data ?? [];
};

export const getDeliveryTaskById = async (
  taskId: string
): Promise<DeliveryTask | null> => {
  const { data, error } = await supabase
    .from('delivery_tasks')
    .select('*')
    .eq('id', taskId)
    .maybeSingle();
  if (error) {
    logger.warn('getDeliveryTaskById failed', error);
    return null;
  }
  return data;
};

/** Tasks attached to an order — used by order-details / admin views. */
export const getDeliveryTasksForOrder = async (
  orderId: string
): Promise<DeliveryTask[]> => {
  const { data, error } = await supabase
    .from('delivery_tasks')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });
  if (error) {
    logger.warn('getDeliveryTasksForOrder failed', error);
    return [];
  }
  return data ?? [];
};

/**
 * Atomically claim an available task. Throws 'task_no_longer_available' when
 * another courier won the race — callers surface that as a friendly message.
 */
export const acceptDeliveryTask = async (taskId: string): Promise<DeliveryTask> => {
  const { data, error } = await supabase.rpc('accept_delivery_task', {
    p_task_id: taskId,
  });
  if (error) {
    logger.warn('acceptDeliveryTask failed', error);
    throw error;
  }
  const task = data as DeliveryTask;
  void notifyOrderPartiesOfDelivery(task, 'accepted');
  return task;
};

/** Advance an owned task one step (accepted→picked_up→delivered→completed). */
export const advanceDeliveryTask = async (
  taskId: string,
  next: DeliveryTaskStatus
): Promise<DeliveryTask> => {
  const { data, error } = await supabase.rpc('advance_delivery_task', {
    p_task_id: taskId,
    p_next_status: next,
  });
  if (error) {
    logger.warn('advanceDeliveryTask failed', error);
    throw error;
  }
  const task = data as DeliveryTask;
  void notifyOrderPartiesOfDelivery(task, next);
  return task;
};

/**
 * Technician requests the return leg (repaired device back to the customer).
 * Idempotent server-side; safe to call twice.
 */
export const createReturnDeliveryTask = async (
  orderId: string
): Promise<DeliveryTask | null> => {
  const { data, error } = await supabase.rpc('create_return_delivery_task', {
    p_order_id: orderId,
  });
  if (error) {
    logger.warn('createReturnDeliveryTask failed', error);
    throw error;
  }
  return (data as DeliveryTask) ?? null;
};

/** Realtime: open task pool changes (new tasks appear / claimed ones leave). */
export const subscribeToAvailableDeliveryTasks = (
  onChange: () => void
): (() => void) =>
  subscribeUnique('delivery-tasks-pool', (ch) =>
    ch.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'delivery_tasks' },
      () => onChange()
    )
  );

// ── Notifications (best-effort, never block the action) ────────────────────

const DELIVERY_PUSH_AR: Partial<Record<DeliveryTaskStatus, string>> = {
  accepted: 'قبل مندوب التوصيل مهمة النقل الخاصة بطلبك.',
  picked_up: 'استلم المندوب الجهاز وهو في الطريق.',
  delivered: 'قام المندوب بتسليم الجهاز.',
};

const notifyOrderPartiesOfDelivery = async (
  task: DeliveryTask,
  status: DeliveryTaskStatus
): Promise<void> => {
  try {
    const body = DELIVERY_PUSH_AR[status];
    if (!body) return;
    const { data: order } = await supabase
      .from('orders')
      .select('user_id, technician_id')
      .eq('id', task.order_id)
      .maybeSingle();
    if (!order) return;
    const recipients = [order.user_id, order.technician_id].filter(
      Boolean
    ) as string[];
    if (recipients.length === 0) return;
    void notifyUsers(recipients, {
      title: 'تحديث التوصيل 🚚',
      body,
      data: { screen: 'order-details', orderId: task.order_id },
    });
  } catch (e) {
    logger.warn('notifyOrderPartiesOfDelivery failed', e);
  }
};
