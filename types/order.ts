export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'picking_up'
  | 'diagnosing'
  | 'waiting_parts'
  | 'repairing'
  | 'testing'
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
  location?: string;
  latitude?: number;
  longitude?: number;
  service_type?: ServiceType;
  notes?: string;
  media_urls?: string[];
  customer_phone?: string;
  technician_phone?: string;
  // Delivery pricing by region (pickup & delivery service). Optional so
  // existing rows / on-site mobile orders are unaffected.
  delivery_region?: string | null;
  delivery_area?: string | null;
  delivery_fee?: number | null;
  // Loyalty: points the customer earns for this order (snapshot at create
  // time). Source of truth remains the loyalty ledger once backend is ready.
  loyalty_points_earned?: number | null;
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
  media_urls?: string[];
  customer_phone?: string;
  estimated_price?: number;
  delivery_region?: string | null;
  delivery_area?: string | null;
  delivery_fee?: number | null;
  loyalty_points_earned?: number | null;
}

export const ORDER_STATUS_LABELS_AR: Record<OrderStatus, string> = {
  pending: 'قيد الانتظار',
  accepted: 'مقبول',
  picking_up: 'جاري الاستلام',
  diagnosing: 'تحت الفحص',
  waiting_parts: 'انتظار قطع غيار',
  repairing: 'قيد الإصلاح',
  testing: 'اختبار الجودة',
  delivering: 'قيد التسليم',
  completed: 'مكتمل',
  cancelled: 'ملغي',
};

export const ACTIVE_STATUSES: OrderStatus[] = [
  'accepted',
  'picking_up',
  'diagnosing',
  'waiting_parts',
  'repairing',
  'testing',
  'delivering',
];

export const isActiveStatus = (status: OrderStatus): boolean =>
  ACTIVE_STATUSES.includes(status);

export const isTerminalStatus = (status: OrderStatus): boolean =>
  status === 'completed' || status === 'cancelled';
