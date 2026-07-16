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
  license_image_url: string | null;
  registration_image_url: string | null;
  id_image_url: string | null;
  selfie_url: string | null;
  challenge_text: string | null;
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
  // §7 — verification documents + identity challenge. Local image URIs to be
  // uploaded, plus the anti-replay challenge text shown when the selfie was
  // taken. Stored paths land on the couriers row via submitCourierApplication.
  licenseImageUri?: string;
  registrationImageUri?: string;
  idImageUri?: string;
  selfieImageUri?: string;
  challengeText?: string;
}

const COURIER_DOC_BUCKET = 'user-id-documents';

/**
 * Upload a courier verification image into the courier's own folder in the
 * private ID-documents bucket (owner-write / admin-read RLS). Mirrors the
 * customer KYC uploader: base64 → decode → upload, guarding the zero-byte bug.
 */
export const uploadCourierDoc = async (
  userId: string,
  uri: string,
  kind: 'license' | 'registration' | 'id' | 'selfie'
): Promise<string> => {
  const { decode } = await import('base64-arraybuffer');
  const { readAsStringAsync } = await import('expo-file-system/legacy');
  const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');

  let sourceUri = uri;
  try {
    const m = await manipulateAsync(uri, [{ resize: { width: 1600 } }], {
      compress: 0.85,
      format: SaveFormat.JPEG,
    });
    sourceUri = m.uri;
  } catch (e) {
    logger.warn('uploadCourierDoc compress failed, using original', e);
  }

  const path = `${userId}/courier-${kind}-${Date.now()}.jpg`;
  const base64 = await readAsStringAsync(sourceUri, { encoding: 'base64' });
  const bytes = decode(base64);
  if (bytes.byteLength === 0) throw new Error(`Refusing to upload empty ${kind} image`);
  const { error } = await supabase.storage
    .from(COURIER_DOC_BUCKET)
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
};

/** Signed URL for a private courier document (admin review). */
export const getCourierDocUrl = async (
  path: string | null,
  expiresInSeconds = 60 * 10
): Promise<string | null> => {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(COURIER_DOC_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) {
    logger.warn('getCourierDocUrl failed', error);
    return null;
  }
  return data?.signedUrl ?? null;
};

/** Create or resubmit the courier application (status returns to submitted). */
export const submitCourierApplication = async (
  userId: string,
  app: CourierApplication
): Promise<void> => {
  // Upload any provided verification images first; only new local URIs (file:/
  // content:) are uploaded, so re-submits that keep an existing stored path
  // are left untouched.
  const isLocal = (u?: string) => !!u && /^(file:|content:|assets-library:|ph:)/.test(u);
  const [licensePath, registrationPath, idPath, selfiePath] = await Promise.all([
    isLocal(app.licenseImageUri) ? uploadCourierDoc(userId, app.licenseImageUri!, 'license') : Promise.resolve(app.licenseImageUri ?? null),
    isLocal(app.registrationImageUri) ? uploadCourierDoc(userId, app.registrationImageUri!, 'registration') : Promise.resolve(app.registrationImageUri ?? null),
    isLocal(app.idImageUri) ? uploadCourierDoc(userId, app.idImageUri!, 'id') : Promise.resolve(app.idImageUri ?? null),
    isLocal(app.selfieImageUri) ? uploadCourierDoc(userId, app.selfieImageUri!, 'selfie') : Promise.resolve(app.selfieImageUri ?? null),
  ]);

  const { error } = await supabase.from('couriers').upsert(
    {
      user_id: userId,
      city: app.city,
      vehicle_type: app.vehicle_type,
      id_number: app.id_number ?? null,
      driver_license_number: app.driver_license_number,
      vehicle_registration_number: app.vehicle_registration_number,
      license_image_url: licensePath,
      registration_image_url: registrationPath,
      id_image_url: idPath,
      selfie_url: selfiePath,
      challenge_text: app.challengeText ?? null,
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

// ── Availability (online/offline) ────────────────────────────────────────────

/** The courier's current online/offline flag. Defaults to true (online) when
 *  the row can't be read, matching the column default. */
export const getCourierAvailability = async (userId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('couriers')
    .select('available')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    logger.warn('getCourierAvailability failed', error);
    return true;
  }
  return data?.available ?? true;
};

/** Flip the courier online/offline. An offline courier can't claim tasks
 *  (enforced server-side in accept_delivery_task). */
export const setCourierAvailability = async (
  userId: string,
  available: boolean
): Promise<void> => {
  const { error } = await supabase
    .from('couriers')
    .update({ available })
    .eq('user_id', userId);
  if (error) throw error;
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

/**
 * Live updates for the courier's OWN tasks (status advances, new return-leg
 * tasks assigned to them, etc.) so the my-tasks list never needs a manual
 * refresh. Filtered to the courier's rows to keep it quiet.
 */
export const subscribeToMyDeliveryTasks = (
  courierId: string,
  onChange: () => void
): (() => void) =>
  subscribeUnique(`delivery-tasks-mine-${courierId}`, (ch) =>
    ch.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'delivery_tasks',
        filter: `courier_id=eq.${courierId}`,
      },
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

/**
 * The task-creation RPCs write two canonical English boilerplate notes.
 * Localize those known strings for display; genuine free-text notes pass
 * through untouched.
 */
const CANONICAL_TASK_NOTES: Record<string, { ar: string; en: string }> = {
  'Pickup the device from the customer and deliver it to the assigned technician.': {
    ar: 'استلم الجهاز من العميل وسلّمه إلى الفني المكلّف.',
    en: 'Pickup the device from the customer and deliver it to the assigned technician.',
  },
  'Collect the repaired device from the technician and return it to the customer.': {
    ar: 'استلم الجهاز بعد إصلاحه من الفني وأعده إلى العميل.',
    en: 'Collect the repaired device from the technician and return it to the customer.',
  },
};

export const localizeTaskNotes = (
  notes: string | null | undefined,
  isRTL: boolean
): string | null => {
  if (!notes) return null;
  const hit = CANONICAL_TASK_NOTES[notes.trim()];
  return hit ? hit[isRTL ? 'ar' : 'en'] : notes;
};

// ── Courier ratings ──────────────────────────────────────────────────────

/** Customer rates a completed delivery leg (once per task). */
export const rateCourierTask = async (
  task: Pick<DeliveryTask, 'id' | 'order_id' | 'courier_id'>,
  customerId: string,
  stars: number
): Promise<void> => {
  const { error } = await supabase.from('courier_ratings').insert({
    task_id: task.id,
    order_id: task.order_id,
    courier_id: task.courier_id,
    customer_id: customerId,
    stars,
  });
  if (error) throw error;
};

/** Ratings the current customer already gave on this order (task_id → stars). */
export const getMyCourierRatingsForOrder = async (
  orderId: string
): Promise<Record<string, number>> => {
  const { data, error } = await supabase
    .from('courier_ratings')
    .select('task_id, stars')
    .eq('order_id', orderId);
  if (error) {
    logger.warn('getMyCourierRatingsForOrder failed', error);
    return {};
  }
  const map: Record<string, number> = {};
  for (const r of data ?? []) map[r.task_id] = r.stars;
  return map;
};

/** Average + count for the courier's own profile. */
export const getCourierRatingSummary = async (
  courierUserId: string
): Promise<{ average: number; count: number }> => {
  const { data, error } = await supabase
    .from('courier_ratings')
    .select('stars')
    .eq('courier_id', courierUserId);
  if (error) {
    logger.warn('getCourierRatingSummary failed', error);
    return { average: 0, count: 0 };
  }
  const list = data ?? [];
  if (list.length === 0) return { average: 0, count: 0 };
  const sum = list.reduce((s, r) => s + Number(r.stars || 0), 0);
  return { average: Math.round((sum / list.length) * 10) / 10, count: list.length };
};
