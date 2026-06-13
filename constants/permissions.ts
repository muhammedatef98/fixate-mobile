/**
 * Client-side mirror of the server permission model (see
 * supabase/migrations/2026_06_13_admin_rbac.sql).
 *
 * IMPORTANT: this is for UX gating only (hiding cards the user can't use).
 * Real enforcement lives in Postgres RLS + SECURITY DEFINER RPCs via
 * `has_admin_permission()`. Never treat the client list as authoritative.
 */

export type PermissionKey =
  | 'dashboard_access'
  | 'analytics_reporting'
  | 'user_management'
  | 'technician_management'
  | 'order_management'
  | 'support_management'
  | 'ratings_moderation'
  | 'billing_management'
  | 'platform_settings'
  | 'staff_management'
  | 'full_admin_access';

export type PermissionGroup =
  | 'overview'
  | 'people'
  | 'operations'
  | 'support'
  | 'content'
  | 'finance'
  | 'system';

export interface PermissionMeta {
  key: PermissionKey;
  group: PermissionGroup;
  labelEn: string;
  labelAr: string;
  descEn: string;
  descAr: string;
}

export const PERMISSIONS: PermissionMeta[] = [
  { key: 'dashboard_access', group: 'overview', labelEn: 'Dashboard access', labelAr: 'الوصول للوحة التحكم', descEn: 'View the admin dashboard and overview stats.', descAr: 'عرض لوحة التحكم والإحصائيات.' },
  { key: 'analytics_reporting', group: 'overview', labelEn: 'Analytics & reporting', labelAr: 'التحليلات والتقارير', descEn: 'View reports, analytics and exports.', descAr: 'عرض التقارير والتحليلات والتصدير.' },
  { key: 'user_management', group: 'people', labelEn: 'User management', labelAr: 'إدارة المستخدمين', descEn: 'View and manage customer accounts.', descAr: 'عرض وإدارة حسابات العملاء.' },
  { key: 'technician_management', group: 'people', labelEn: 'Technician management', labelAr: 'إدارة الفنيين', descEn: 'Verify, approve and manage technicians.', descAr: 'توثيق وإدارة الفنيين.' },
  { key: 'order_management', group: 'operations', labelEn: 'Order management', labelAr: 'إدارة الطلبات', descEn: 'View and manage repair orders.', descAr: 'عرض وإدارة طلبات الإصلاح.' },
  { key: 'support_management', group: 'support', labelEn: 'Support & chat', labelAr: 'الدعم والمحادثات', descEn: 'Handle support conversations and close chats.', descAr: 'إدارة محادثات الدعم وإغلاقها.' },
  { key: 'ratings_moderation', group: 'content', labelEn: 'Ratings & comments', labelAr: 'التقييمات والتعليقات', descEn: 'Moderate ratings, reviews and comments.', descAr: 'الإشراف على التقييمات والتعليقات.' },
  { key: 'billing_management', group: 'finance', labelEn: 'Billing & invoices', labelAr: 'الفوترة والفواتير', descEn: 'View invoices, payments and billing settings.', descAr: 'عرض الفواتير والمدفوعات وإعدادات الفوترة.' },
  { key: 'platform_settings', group: 'system', labelEn: 'Platform settings', labelAr: 'إعدادات المنصة', descEn: 'Edit platform-wide settings and configuration.', descAr: 'تعديل إعدادات المنصة.' },
  { key: 'staff_management', group: 'system', labelEn: 'Staff & permissions', labelAr: 'الفريق والصلاحيات', descEn: 'Manage admin staff, roles and permissions.', descAr: 'إدارة الفريق والأدوار والصلاحيات.' },
  { key: 'full_admin_access', group: 'system', labelEn: 'Full admin access', labelAr: 'صلاحية كاملة', descEn: 'Unrestricted access to every admin capability.', descAr: 'وصول كامل غير مقيّد لكل الإمكانات.' },
];

export const PERMISSION_GROUPS: { key: PermissionGroup; labelEn: string; labelAr: string }[] = [
  { key: 'overview', labelEn: 'Overview', labelAr: 'نظرة عامة' },
  { key: 'people', labelEn: 'People', labelAr: 'الأشخاص' },
  { key: 'operations', labelEn: 'Operations', labelAr: 'العمليات' },
  { key: 'support', labelEn: 'Support', labelAr: 'الدعم' },
  { key: 'content', labelEn: 'Content', labelAr: 'المحتوى' },
  { key: 'finance', labelEn: 'Finance', labelAr: 'المالية' },
  { key: 'system', labelEn: 'System', labelAr: 'النظام' },
];

export type RoleKey =
  | 'super_admin'
  | 'admin'
  | 'operations_manager'
  | 'support_manager'
  | 'support_agent'
  | 'billing_admin';

/** Returns true if the effective permission set satisfies `required`. */
export const hasPermission = (
  perms: readonly string[] | null | undefined,
  required: PermissionKey
): boolean => {
  if (!perms || perms.length === 0) return false;
  return perms.includes('full_admin_access') || perms.includes(required);
};

export const permissionLabel = (key: string, isRTL: boolean): string => {
  const m = PERMISSIONS.find((p) => p.key === key);
  if (!m) return key;
  return isRTL ? m.labelAr : m.labelEn;
};
