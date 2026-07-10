/**
 * pricingOptions.ts — structured option lists for the admin pricing forms so
 * data entry is dropdown-driven (device types, accessory/protection presets)
 * instead of loose free text. Brands/models/repair-types are sourced live from
 * repairData via the helpers below.
 */
import { BRANDS, ISSUES, type Issue } from './repairData';

export interface Opt {
  value: string;
  ar: string;
  en: string;
}

/** Device types used across the request flow and pricing registry. */
export const DEVICE_TYPE_OPTIONS: Opt[] = [
  { value: 'phone', ar: 'جوال', en: 'Phone' },
  { value: 'tablet', ar: 'تابلت', en: 'Tablet' },
  { value: 'laptop', ar: 'لابتوب', en: 'Laptop' },
  { value: 'watch', ar: 'ساعة', en: 'Watch' },
  { value: 'gaming', ar: 'أجهزة ألعاب', en: 'Gaming' },
  { value: 'tv', ar: 'تلفاز', en: 'TV' },
  { value: 'headphones', ar: 'سماعات', en: 'Headphones' },
  { value: 'printer', ar: 'طابعة', en: 'Printer' },
  { value: 'appliance', ar: 'أجهزة منزلية', en: 'Appliance' },
  { value: 'other', ar: 'أخرى', en: 'Other' },
];

/** Common accessory presets — picking one pre-fills key + bilingual names. */
export const ACCESSORY_PRESETS: Opt[] = [
  { value: 'charger', ar: 'شاحن', en: 'Charger' },
  { value: 'cable', ar: 'كيبل شحن', en: 'Charging cable' },
  { value: 'adapter', ar: 'محول', en: 'Adapter' },
  { value: 'case', ar: 'جراب حماية', en: 'Protective case' },
  { value: 'screen_protector', ar: 'واقي شاشة', en: 'Screen protector' },
  { value: 'power_bank', ar: 'باور بانك', en: 'Power bank' },
  { value: 'earphones', ar: 'سماعات', en: 'Earphones' },
  { value: 'stylus', ar: 'قلم', en: 'Stylus pen' },
  { value: 'mouse', ar: 'ماوس', en: 'Mouse' },
  { value: 'keyboard', ar: 'لوحة مفاتيح', en: 'Keyboard' },
  { value: 'cooling_pad', ar: 'قاعدة تبريد', en: 'Cooling pad' },
  { value: 'strap', ar: 'سوار', en: 'Strap' },
  { value: 'controller', ar: 'يد تحكم', en: 'Controller' },
  { value: 'charging_dock', ar: 'قاعدة شحن', en: 'Charging dock' },
  { value: 'headset', ar: 'سماعة رأس', en: 'Headset' },
  { value: 'remote', ar: 'ريموت تحكم', en: 'Remote control' },
  { value: 'wall_mount', ar: 'حامل جداري', en: 'Wall mount' },
  { value: 'hdmi', ar: 'كيبل HDMI', en: 'HDMI cable' },
  { value: 'cleaning_kit', ar: 'طقم تنظيف', en: 'Cleaning kit' },
  { value: 'ear_tips', ar: 'سدادات أذن', en: 'Ear tips' },
];

/** Protection package presets. */
export const PROTECTION_PRESETS: Opt[] = [
  { value: 'screen_protector', ar: 'واقي شاشة مركّب', en: 'Installed screen protector' },
  { value: 'protective_case', ar: 'كفر حماية', en: 'Protective case' },
  { value: 'full_protection', ar: 'باقة الحماية الشاملة', en: 'Full protection package' },
];

/** Brands, optionally narrowed to a device type. Value = brand name (matches
 *  what the request flow stores on the order). */
export const brandOptions = (deviceType?: string | null): Opt[] => {
  const effective = deviceType === 'tablet' ? 'phone' : deviceType;
  const list = BRANDS.filter((b) => !effective || b.deviceType === effective);
  const seen = new Set<string>();
  const out: Opt[] = [];
  for (const b of list) {
    if (seen.has(b.name)) continue;
    seen.add(b.name);
    out.push({ value: b.name, ar: b.name, en: b.name });
  }
  return out;
};

/** Models for a brand name. */
export const modelOptions = (brandName?: string | null): Opt[] => {
  if (!brandName) return [];
  const brand = BRANDS.find((b) => b.name === brandName);
  return (brand?.models ?? []).map((m) => ({ value: m, ar: m, en: m }));
};

/** Repair types (issue catalog) for a device type. Value = issue id (what the
 *  request passes as repair_type). */
export const repairTypeOptions = (deviceType?: string | null): Opt[] => {
  const effective = deviceType === 'tablet' ? 'tablet' : deviceType;
  const list: Issue[] = ISSUES.filter((i) => !effective || i.deviceType === effective);
  return list.map((i) => ({ value: i.id, ar: i.nameAr, en: i.name }));
};
