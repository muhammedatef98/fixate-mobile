// Catalog of services a technician can switch on/off based on what they can
// currently take. Kept separate from repairData so availability management
// stays independent of the device/brand search data.
//
// Scaling note: add an entry here and it automatically appears in the
// technician availability panel. Backend overrides (per-technician rows in
// `service_availability`) layer on top of these defaults.

export interface ServiceCatalogItem {
  id: string;
  nameAr: string;
  nameEn: string;
  icon: string; // MaterialCommunityIcons name
  /** Default availability when the technician hasn't set a preference. */
  defaultEnabled: boolean;
}

export const SERVICE_CATALOG: ServiceCatalogItem[] = [
  { id: 'phone', nameAr: 'صيانة الجوالات', nameEn: 'Phone repair', icon: 'cellphone', defaultEnabled: true },
  { id: 'tablet', nameAr: 'صيانة التابلت', nameEn: 'Tablet repair', icon: 'tablet', defaultEnabled: true },
  { id: 'laptop', nameAr: 'صيانة اللابتوب', nameEn: 'Laptop repair', icon: 'laptop', defaultEnabled: true },
  { id: 'watch', nameAr: 'صيانة الساعات الذكية', nameEn: 'Smart watch repair', icon: 'watch', defaultEnabled: true },
  { id: 'mobile_service', nameAr: 'فني متنقل (في الموقع)', nameEn: 'Mobile (on-site) service', icon: 'account-wrench', defaultEnabled: true },
  { id: 'pickup_service', nameAr: 'استلام وتوصيل', nameEn: 'Pickup & delivery', icon: 'truck-delivery', defaultEnabled: true },
];
