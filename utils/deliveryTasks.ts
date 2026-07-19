/**
 * deliveryTasks.ts — pure helpers for the courier delivery-task state
 * machine. Framework-free (no supabase import) so the courier gate, the task
 * screens and unit tests all share one testable source of truth; the service
 * layer (services/courierService.ts) re-exports these for convenience.
 *
 * Lifecycle (enforced server-side by advance_delivery_task):
 *   available → accepted → picked_up → delivered → completed (or cancelled)
 *
 * A task is one custody leg of the device's journey:
 *   pickup leg:  customer → courier → technician
 *   return leg:  technician → courier → customer
 * `deliveryLegLabel` is the single human-readable mapping of (leg, status) →
 * "where the device is right now", shared by the courier cards/detail, the
 * technician view and the customer's tracking strip so custody wording never
 * drifts between roles.
 */

export type DeliveryTaskType = 'pickup' | 'return';

export type DeliveryTaskStatus =
  | 'available'
  | 'accepted'
  | 'picked_up'
  | 'delivered'
  | 'completed'
  | 'cancelled';

export const DELIVERY_STATUS_LABELS: Record<
  DeliveryTaskStatus,
  { ar: string; en: string }
> = {
  available: { ar: 'متاحة', en: 'Available' },
  accepted: { ar: 'تم القبول — توجّه للاستلام', en: 'Accepted — head to pickup' },
  picked_up: { ar: 'تم الاستلام — جاري التوصيل', en: 'Picked up — delivering' },
  delivered: { ar: 'تم التسليم — بانتظار تأكيد المستلم', en: 'Delivered — awaiting receiver confirmation' },
  completed: { ar: 'مكتملة', en: 'Completed' },
  cancelled: { ar: 'ملغاة', en: 'Cancelled' },
};

/**
 * Human custody label for a delivery leg + status — "where is the device and
 * who is moving it". Neutral phrasing that works for customer, courier and
 * technician surfaces alike.
 */
export const deliveryLegLabel = (
  taskType: DeliveryTaskType,
  status: DeliveryTaskStatus
): { ar: string; en: string } => {
  if (taskType === 'pickup') {
    switch (status) {
      case 'available':
        return { ar: 'بانتظار مندوب لاستلام الجهاز من العميل', en: 'Waiting for a courier to collect the device from the customer' };
      case 'accepted':
        return { ar: 'المندوب في الطريق لاستلام الجهاز من العميل', en: 'Courier on the way to collect the device from the customer' };
      case 'picked_up':
        return { ar: 'الجهاز مع المندوب — في الطريق إلى الفني', en: 'Device with the courier — on the way to the technician' };
      case 'delivered':
        return { ar: 'وصل الجهاز إلى الفني', en: 'Device handed to the technician' };
      case 'completed':
        return { ar: 'الجهاز الآن مع الفني', en: 'Device is now with the technician' };
      case 'cancelled':
        return { ar: 'أُلغيت مهمة الاستلام', en: 'Pickup task cancelled' };
    }
  }
  switch (status) {
    case 'available':
      return { ar: 'بانتظار مندوب لإعادة الجهاز من الفني', en: 'Waiting for a courier to return the device from the technician' };
    case 'accepted':
      return { ar: 'المندوب في الطريق إلى الفني لاستلام الجهاز', en: 'Courier on the way to the technician to collect the device' };
    case 'picked_up':
      return { ar: 'استلم المندوب الجهاز من الفني — في الطريق إلى العميل', en: 'Courier picked up from the technician — on the way back to the customer' };
    case 'delivered':
      return { ar: 'وصل الجهاز إلى العميل', en: 'Device delivered back to the customer' };
    case 'completed':
      return { ar: 'تم تسليم الجهاز للعميل', en: 'Device returned to the customer' };
    case 'cancelled':
      return { ar: 'أُلغيت مهمة الإعادة', en: 'Return task cancelled' };
  }
};

/**
 * The single next action a courier can take on a task, or null when done.
 * Pass the task type to get leg-aware button copy ("Confirm pickup from
 * customer" vs "…from technician"); without it the generic copy is kept for
 * backward compatibility.
 */
export const nextDeliveryAction = (
  status: DeliveryTaskStatus,
  taskType?: DeliveryTaskType
): { next: DeliveryTaskStatus; ar: string; en: string } | null => {
  const isPickup = taskType === 'pickup';
  const isReturn = taskType === 'return';
  switch (status) {
    case 'accepted':
      return {
        next: 'picked_up',
        ar: isPickup
          ? 'تأكيد استلام الجهاز من العميل'
          : isReturn
            ? 'تأكيد استلام الجهاز من الفني'
            : 'تأكيد استلام الجهاز',
        en: isPickup
          ? 'Confirm pickup from customer'
          : isReturn
            ? 'Confirm pickup from technician'
            : 'Confirm pickup',
      };
    case 'picked_up':
      return {
        next: 'delivered',
        ar: isPickup
          ? 'تأكيد تسليم الجهاز للفني'
          : isReturn
            ? 'تأكيد تسليم الجهاز للعميل'
            : 'تأكيد تسليم الجهاز',
        en: isPickup
          ? 'Confirm hand-over to technician'
          : isReturn
            ? 'Confirm delivery to customer'
            : 'Confirm delivery',
      };
    // 'delivered' has NO courier action anymore: the task closes when the
    // receiving party confirms receipt (confirm_delivery_handoff RPC).
    default:
      return null;
  }
};

// ── Handoff handshake ───────────────────────────────────────────────────────
// Each custody transfer is a two-sided handshake. The courier presses his
// step, then the counterparty confirms it:
//   pickup leg:  picked_up  → customer confirms hand-over
//                delivered  → technician confirms receipt (closes the task)
//   return leg:  picked_up  → technician confirms hand-over
//                delivered  → customer confirms receipt (closes the task AND
//                             auto-completes the order, server-side)

export type HandoffStage = 'pickup' | 'delivery';

export interface HandoffTaskState {
  task_type: DeliveryTaskType;
  status: DeliveryTaskStatus;
  pickup_confirmed_at: string | null;
  delivery_confirmed_at: string | null;
}

/**
 * The confirmation this role owes on this task right now, or null.
 * Pure — shared by the customer's order screen and the technician's
 * manage-order screen so the gating logic never drifts.
 */
export const confirmableHandoff = (
  task: HandoffTaskState,
  role: 'customer' | 'technician'
): HandoffStage | null => {
  const sender = task.task_type === 'pickup' ? 'customer' : 'technician';
  const receiver = task.task_type === 'pickup' ? 'technician' : 'customer';
  if (
    role === sender &&
    !task.pickup_confirmed_at &&
    ['picked_up', 'delivered'].includes(task.status)
  ) {
    return 'pickup';
  }
  if (role === receiver && !task.delivery_confirmed_at && task.status === 'delivered') {
    return 'delivery';
  }
  return null;
};

interface CourierStatsInput {
  task_type: DeliveryTaskType;
  status: DeliveryTaskStatus;
  courier_fee: number | string | null;
}

export interface CourierStats {
  completed: number;
  active: number;
  pickupCompleted: number;
  returnCompleted: number;
  feesEarned: number;
}

/**
 * Courier profile stats, derived from the courier's own delivery tasks (the
 * source of truth) — never from denormalized counters. Fees count completed
 * tasks only.
 */
export const computeCourierStats = (tasks: CourierStatsInput[]): CourierStats => {
  const stats: CourierStats = {
    completed: 0,
    active: 0,
    pickupCompleted: 0,
    returnCompleted: 0,
    feesEarned: 0,
  };
  for (const t of tasks) {
    if (t.status === 'completed') {
      stats.completed += 1;
      if (t.task_type === 'pickup') stats.pickupCompleted += 1;
      else stats.returnCompleted += 1;
      const fee = Number(t.courier_fee ?? 0);
      if (Number.isFinite(fee) && fee > 0) stats.feesEarned += fee;
    } else if (t.status === 'accepted' || t.status === 'picked_up' || t.status === 'delivered') {
      stats.active += 1;
    }
  }
  stats.feesEarned = Math.round(stats.feesEarned * 100) / 100;
  return stats;
};
