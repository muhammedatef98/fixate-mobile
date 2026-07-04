export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'picking_up'
  | 'diagnosing'
  // Technician finished the inspection and submitted a final quote.
  // The customer must accept it before any repair work continues.
  | 'quoted'
  // Customer accepted the quote; the order is payment-ready and the
  // customer is sent to the real payment page.
  | 'awaiting_payment'
  | 'waiting_parts'
  | 'repairing'
  | 'testing'
  | 'delivering'
  | 'completed'
  | 'cancelled'
  // Technician declined the request, with a reason saved on the order (FEAT-03).
  | 'rejected';

// Fulfillment / hand-over modes a customer can choose:
//   mobile           – the technician comes to the customer's location
//   pickup           – Fixate picks up & returns the device
//   personal_handoff – the customer personally hands over and picks up the
//                      device at an agreed meet-up point (cheaper, no
//                      return-leg fee on rejected quotes)
export type ServiceType = 'mobile' | 'pickup' | 'personal_handoff';

export type SparePartQuality = 'original' | 'high_quality' | 'economy';

// Customer-facing payment options. The 'online' id is kept (DB-compatible)
// but surfaced to the user as "Apple Pay (Coming Soon)" — UI-ready only, no
// real gateway is wired; the choice is stored so it can be activated later.
export type PaymentMethod = 'cash' | 'card' | 'online';

export const PAYMENT_METHODS: {
  id: PaymentMethod;
  labelAr: string;
  labelEn: string;
  icon: string;
  comingSoon?: boolean;
}[] = [
  { id: 'cash', labelAr: 'نقداً عند الاستلام', labelEn: 'Cash on delivery', icon: 'cash' },
  { id: 'card', labelAr: 'بطاقة / فيزا', labelEn: 'Card / Visa', icon: 'credit-card-outline' },
  { id: 'online', labelAr: 'Apple Pay (قريبًا)', labelEn: 'Apple Pay (Coming Soon)', icon: 'apple', comingSoon: true },
];

// A selectable optional item (accessory or protection add-on). Kept generic
// so the same shape can later be backed by an admin-managed catalog table.
export interface AddonItem {
  id: string;
  name_ar: string;
  name_en: string;
  price: number;
}

// Accessory suggestions keyed by device type. Falls back to a generic list
// for device types without specific entries (e.g. 'other').
export const ACCESSORY_SUGGESTIONS: Record<string, AddonItem[]> = {
  phone: [
    { id: 'charger', name_ar: 'شاحن', name_en: 'Charger', price: 60 },
    { id: 'cable', name_ar: 'كيبل شحن', name_en: 'Charging cable', price: 25 },
    { id: 'adapter', name_ar: 'محول', name_en: 'Adapter', price: 40 },
    { id: 'case', name_ar: 'جراب حماية', name_en: 'Protective case', price: 35 },
    { id: 'screen_protector', name_ar: 'واقي شاشة', name_en: 'Screen protector', price: 30 },
  ],
  tablet: [
    { id: 'charger', name_ar: 'شاحن', name_en: 'Charger', price: 70 },
    { id: 'cable', name_ar: 'كيبل شحن', name_en: 'Charging cable', price: 30 },
    { id: 'case', name_ar: 'جراب حماية', name_en: 'Protective case', price: 55 },
    { id: 'screen_protector', name_ar: 'واقي شاشة', name_en: 'Screen protector', price: 45 },
    { id: 'stylus', name_ar: 'قلم', name_en: 'Stylus pen', price: 90 },
  ],
  laptop: [
    { id: 'charger', name_ar: 'شاحن', name_en: 'Charger / adapter', price: 130 },
    { id: 'case', name_ar: 'حقيبة', name_en: 'Laptop sleeve', price: 70 },
    { id: 'mouse', name_ar: 'ماوس', name_en: 'Mouse', price: 50 },
    { id: 'keyboard', name_ar: 'لوحة مفاتيح', name_en: 'Keyboard accessory', price: 80 },
    { id: 'cooling_pad', name_ar: 'قاعدة تبريد', name_en: 'Cooling pad', price: 75 },
  ],
  watch: [
    { id: 'charger', name_ar: 'شاحن', name_en: 'Charger', price: 45 },
    { id: 'strap', name_ar: 'سوار', name_en: 'Watch strap', price: 40 },
    { id: 'screen_protector', name_ar: 'واقي شاشة', name_en: 'Screen protector', price: 25 },
  ],
  gaming: [
    { id: 'controller', name_ar: 'يد تحكم', name_en: 'Controller', price: 180 },
    { id: 'cable', name_ar: 'كيبل', name_en: 'Cable', price: 30 },
    { id: 'charging_dock', name_ar: 'قاعدة شحن', name_en: 'Charging dock', price: 90 },
    { id: 'headset', name_ar: 'سماعة', name_en: 'Gaming headset', price: 150 },
  ],
  tv: [
    { id: 'remote', name_ar: 'ريموت تحكم', name_en: 'Remote control', price: 60 },
    { id: 'wall_mount', name_ar: 'حامل جداري', name_en: 'Wall mount', price: 90 },
    { id: 'hdmi', name_ar: 'كيبل HDMI', name_en: 'HDMI cable', price: 35 },
    { id: 'cleaning_kit', name_ar: 'طقم تنظيف الشاشة', name_en: 'Screen cleaning kit', price: 30 },
  ],
  headphones: [
    { id: 'ear_tips', name_ar: 'سدادات أذن', name_en: 'Ear tips', price: 25 },
    { id: 'case', name_ar: 'علبة حماية', name_en: 'Protective case', price: 35 },
    { id: 'cable', name_ar: 'كيبل شحن', name_en: 'Charging cable', price: 25 },
  ],
  generic: [
    { id: 'charger', name_ar: 'شاحن', name_en: 'Charger', price: 50 },
    { id: 'cable', name_ar: 'كيبل', name_en: 'Cable', price: 25 },
    { id: 'case', name_ar: 'حافظة', name_en: 'Case', price: 35 },
  ],
};

export const getAccessorySuggestions = (deviceType?: string | null): AddonItem[] =>
  (deviceType && ACCESSORY_SUGGESTIONS[deviceType]) || ACCESSORY_SUGGESTIONS.generic;

// Optional protection add-ons / packages offered as an upsell in the flow.
export const PROTECTION_ADDONS: AddonItem[] = [
  { id: 'screen_protector', name_ar: 'واقي شاشة مركّب', name_en: 'Installed screen protector', price: 40 },
  { id: 'protective_case', name_ar: 'كفر حماية', name_en: 'Protective case', price: 50 },
  { id: 'full_protection', name_ar: 'باقة الحماية الشاملة', name_en: 'Full protection package', price: 120 },
];

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
  // Phase 1 features
  spare_part_quality?: SparePartQuality;
  discount_code?: string;
  discount_amount?: number;
  payment_method?: PaymentMethod;
  accessories?: AddonItem[];
  protection_addons?: AddonItem[];
  // Delivery pricing by region
  delivery_region?: string | null;
  delivery_area?: string | null;
  delivery_fee?: number | null;
  // Loyalty points
  loyalty_points_earned?: number | null;
  // Technician inspection quote. `final_price` is the quoted amount; the
  // customer accepts/rejects it before repair work proceeds. `quoted_at`
  // records when the technician submitted the quote (best-effort column).
  quote_notes?: string | null;
  quoted_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateOrderData {
  device_brand: string;
  device_model: string;
  issue_description?: string;
  service_type?: ServiceType;
  // Mirrors service_type but stored in its own column so we can evolve the
  // fulfillment options without further DB churn.
  fulfillment_type?: ServiceType;
  address?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  service_id?: string;
  media_urls?: string[];
  customer_phone?: string;
  estimated_price?: number;
  // Phase 1 features
  spare_part_quality?: SparePartQuality;
  discount_code?: string;
  discount_amount?: number;
  payment_method?: PaymentMethod;
  accessories?: AddonItem[];
  protection_addons?: AddonItem[];
  // Delivery pricing by region
  delivery_region?: string | null;
  delivery_area?: string | null;
  delivery_fee?: number | null;
  loyalty_points_earned?: number | null;
}

export const ORDER_STATUS_LABELS_AR: Record<OrderStatus, string> = {
  // Marketplace: an unassigned request is open for technician offers.
  pending: 'بانتظار عروض الفنيين',
  accepted: 'مقبول',
  picking_up: 'جاري الاستلام',
  diagnosing: 'تحت الفحص',
  quoted: 'بانتظار موافقتك على السعر',
  awaiting_payment: 'بإنتظار الدفع',
  waiting_parts: 'انتظار قطع غيار',
  repairing: 'قيد الإصلاح',
  testing: 'اختبار الجودة',
  delivering: 'قيد التسليم',
  completed: 'مكتمل',
  cancelled: 'ملغي',
  rejected: 'مرفوض',
};

export const ACTIVE_STATUSES: OrderStatus[] = [
  'accepted',
  'picking_up',
  'diagnosing',
  'quoted',
  'awaiting_payment',
  'waiting_parts',
  'repairing',
  'testing',
  'delivering',
];

export const isActiveStatus = (status: OrderStatus): boolean =>
  ACTIVE_STATUSES.includes(status);

// The customer must accept the technician's inspection quote before any
// repair work continues. Used to gate the accept/reject UX and the
// technician workflow actions.
export const isAwaitingQuoteApproval = (status: OrderStatus): boolean =>
  status === 'quoted';

export const ORDER_STATUS_LABELS_EN: Record<OrderStatus, string> = {
  // Marketplace: an unassigned request is open for technician offers.
  pending: 'Awaiting offers',
  accepted: 'Accepted',
  picking_up: 'Picking up',
  diagnosing: 'Inspecting',
  quoted: 'Awaiting your approval',
  awaiting_payment: 'Awaiting payment',
  waiting_parts: 'Waiting for parts',
  repairing: 'Repairing',
  testing: 'Quality testing',
  delivering: 'Delivering',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
};

export const isTerminalStatus = (status: OrderStatus): boolean =>
  status === 'completed' || status === 'cancelled' || status === 'rejected';
