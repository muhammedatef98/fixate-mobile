/**
 * deliveryTasks.ts — pure helpers for the courier delivery-task state
 * machine. Framework-free (no supabase import) so the courier gate, the task
 * screens and unit tests all share one testable source of truth; the service
 * layer (services/courierService.ts) re-exports these for convenience.
 *
 * Lifecycle (enforced server-side by advance_delivery_task):
 *   available → accepted → picked_up → delivered → completed (or cancelled)
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
  delivered: { ar: 'تم التسليم — بانتظار التأكيد', en: 'Delivered — confirm to close' },
  completed: { ar: 'مكتملة', en: 'Completed' },
  cancelled: { ar: 'ملغاة', en: 'Cancelled' },
};

/** The single next action a courier can take on a task, or null when done. */
export const nextDeliveryAction = (
  status: DeliveryTaskStatus
): { next: DeliveryTaskStatus; ar: string; en: string } | null => {
  switch (status) {
    case 'accepted':
      return { next: 'picked_up', ar: 'تأكيد استلام الجهاز', en: 'Confirm pickup' };
    case 'picked_up':
      return { next: 'delivered', ar: 'تأكيد تسليم الجهاز', en: 'Confirm delivery' };
    case 'delivered':
      return { next: 'completed', ar: 'إنهاء المهمة', en: 'Complete task' };
    default:
      return null;
  }
};
