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

export type SparePartQuality = 'original' | 'high_quality' | 'economy';

// Pricing multiplier applied on top of the issue's base estimated price.
// Originals are the reference (1.0x); high quality is ~80% of original parts;
// economy parts are the cheapest (~55%). The technician can adjust the final
// price after diagnosis — this is just the customer-visible estimate.
export const SPARE_PART_MULTIPLIERS: Record<SparePartQuality, number> = {
  original: 1.0,
  high_quality: 0.8,
  economy: 0.55,
};

export const SPARE_PART_LABELS: Record<SparePartQuality, { ar: string; en: string }> = {
  original: { ar: 'أصلي', en: 'Original' },
  high_quality: { ar: 'جودة عالية', en: 'High Quality' },
  economy: { ar: 'اقتصادي', en: 'Economy' },
};

export const SPARE_PART_DESCRIPTIONS: Record<SparePartQuality, { ar: string; en: string }> = {
  original: {
    ar: 'قطع غيار أصلية من الشركة المصنّعة، أعلى جودة وأطول ضمان.',
    en: 'Genuine OEM parts from the manufacturer — top quality, longest warranty.',
  },
  high_quality: {
    ar: 'قطع غيار بديلة ذات جودة عالية بسعر أوفر.',
    en: 'Premium aftermarket parts at a lower price.',
  },
  economy: {
    ar: 'الخيار الأرخص — مناسب لإصلاحات سريعة وميزانية محدودة.',
    en: 'Cheapest option — good for quick fixes and tight budgets.',
  },
};

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
  spare_part_quality?: SparePartQuality;
  discount_code?: string;
  discount_amount?: number;
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
  spare_part_quality?: SparePartQuality;
  discount_code?: string;
  discount_amount?: number;
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
