export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'picking_up'
  | 'diagnosing'
  | 'repairing'
  | 'delivering'
  | 'completed'
  | 'cancelled';

export type ServiceType = 'mobile' | 'pickup';

export interface Order {
  id: string;
  user_id: string;
  service_id?: string;
  technician_id?: string | null;
  device_brand: string;
  device_model: string;
  issue_description?: string;
  estimated_price?: number;
  final_price?: number;
  status: OrderStatus;
  scheduled_date?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  service_type?: ServiceType;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateOrderData {
  device_brand: string;
  device_model: string;
  issue_description?: string;
  service_type?: ServiceType;
  address?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  service_id?: string;
}

export const ORDER_STATUS_LABELS_AR: Record<OrderStatus, string> = {
  pending: 'قيد الانتظار',
  accepted: 'مقبول',
  picking_up: 'جاري الاستلام',
  diagnosing: 'تحت الفحص',
  repairing: 'قيد الإصلاح',
  delivering: 'قيد التسليم',
  completed: 'مكتمل',
  cancelled: 'ملغي',
};

export const ACTIVE_STATUSES: OrderStatus[] = [
  'accepted',
  'picking_up',
  'diagnosing',
  'repairing',
  'delivering',
];

export const isActiveStatus = (status: OrderStatus): boolean =>
  ACTIVE_STATUSES.includes(status);

export const isTerminalStatus = (status: OrderStatus): boolean =>
  status === 'completed' || status === 'cancelled';
