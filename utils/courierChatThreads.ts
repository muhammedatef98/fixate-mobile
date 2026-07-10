/**
 * courierChatThreads.ts — pure helpers for the two conversations that live on
 * one delivery task (courier_chat_messages.thread):
 *   'technician' — courier ↔ the order's assigned technician
 *   'customer'   — courier ↔ the order's customer
 * RLS partitions the threads server-side; these helpers keep the client
 * labeling and contact resolution consistent across every entry point.
 */
import type { DeliveryTaskType } from './deliveryTasks';

export type CourierChatThread = 'technician' | 'customer';

export const isCourierChatThread = (v: unknown): v is CourierChatThread =>
  v === 'technician' || v === 'customer';

/**
 * Which stop's contact fields belong to each party. Contact info is stamped
 * onto the task at creation time:
 *   pickup leg:  pickup = customer,   dropoff = technician
 *   return leg:  pickup = technician, dropoff = customer
 */
export const partyStop = (
  taskType: DeliveryTaskType,
  party: CourierChatThread
): 'pickup' | 'dropoff' => {
  if (taskType === 'pickup') return party === 'customer' ? 'pickup' : 'dropoff';
  return party === 'customer' ? 'dropoff' : 'pickup';
};

interface TaskContacts {
  task_type: DeliveryTaskType;
  pickup_contact_phone: string | null;
  dropoff_contact_phone: string | null;
}

/** Phone of the given party on a task (null when it was never stamped). */
export const partyPhone = (
  task: TaskContacts,
  party: CourierChatThread
): string | null =>
  partyStop(task.task_type, party) === 'pickup'
    ? task.pickup_contact_phone
    : task.dropoff_contact_phone;

interface TaskContactNames {
  task_type: DeliveryTaskType;
  pickup_contact_name: string | null;
  dropoff_contact_name: string | null;
}

/** Display name of the given party on a task (null when never stamped). */
export const partyName = (
  task: TaskContactNames,
  party: CourierChatThread
): string | null =>
  partyStop(task.task_type, party) === 'pickup'
    ? task.pickup_contact_name
    : task.dropoff_contact_name;

/**
 * Header title for a thread from the viewer's seat: the courier sees the
 * other party; the technician/customer always sees the courier.
 */
export const threadCounterpartLabel = (
  thread: CourierChatThread,
  viewerIsCourier: boolean,
  isRTL: boolean
): string => {
  if (!viewerIsCourier) return isRTL ? 'مندوب التوصيل' : 'Courier';
  return thread === 'technician'
    ? isRTL ? 'الفني' : 'Technician'
    : isRTL ? 'العميل' : 'Customer';
};
