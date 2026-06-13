import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';
import type { PermissionKey, RoleKey } from '../constants/permissions';

export interface AdminRole {
  id: string;
  key: RoleKey | string;
  name_en: string;
  name_ar: string;
  description: string | null;
  is_system: boolean;
  rank: number;
}

export interface AdminPermissionRow {
  key: string;
  group_key: string;
  label_en: string;
  label_ar: string;
  description: string | null;
  sort_order: number;
}

export interface StaffMember {
  id: string;
  user_id: string;
  role_id: string;
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined/derived:
  role_key?: string;
  role_name_ar?: string;
  role_name_en?: string;
  user_name?: string;
  user_email?: string;
  user_phone?: string | null;
  overrides?: { permission_key: string; effect: 'grant' | 'revoke' }[];
}

/** Effective permission keys for the signed-in user (server-computed). */
export const getMyPermissions = async (): Promise<string[]> => {
  try {
    const { data, error } = await supabase.rpc('my_admin_permissions');
    if (error) {
      logger.warn('my_admin_permissions failed', error);
      return [];
    }
    return Array.isArray(data) ? (data as string[]) : [];
  } catch (e) {
    logger.warn('getMyPermissions threw', e);
    return [];
  }
};

export const listRoles = async (): Promise<AdminRole[]> => {
  const { data, error } = await supabase
    .from('admin_roles')
    .select('*')
    .order('rank', { ascending: true });
  if (error) {
    logger.warn('listRoles failed', error);
    return [];
  }
  return (data ?? []) as AdminRole[];
};

export const listPermissionCatalog = async (): Promise<AdminPermissionRow[]> => {
  const { data, error } = await supabase
    .from('admin_permissions')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) {
    logger.warn('listPermissionCatalog failed', error);
    return [];
  }
  return (data ?? []) as AdminPermissionRow[];
};

/** Permission keys granted by a role preset (before per-user overrides). */
export const getRolePermissions = async (roleId: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from('admin_role_permissions')
    .select('permission_key')
    .eq('role_id', roleId);
  if (error) {
    logger.warn('getRolePermissions failed', error);
    return [];
  }
  return (data ?? []).map((r: any) => r.permission_key);
};

/** Full staff list with role + user details and per-user overrides. */
export const listStaff = async (): Promise<StaffMember[]> => {
  const { data: staff, error } = await supabase
    .from('admin_staff')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) {
    logger.warn('listStaff failed', error);
    return [];
  }
  const rows = (staff ?? []) as StaffMember[];
  if (!rows.length) return [];

  const roleIds = Array.from(new Set(rows.map((s) => s.role_id)));
  const userIds = Array.from(new Set(rows.map((s) => s.user_id)));
  const staffIds = rows.map((s) => s.id);

  const [{ data: roles }, { data: users }, { data: overrides }] = await Promise.all([
    supabase.from('admin_roles').select('id, key, name_ar, name_en').in('id', roleIds),
    supabase.from('users').select('id, name, email, phone').in('id', userIds),
    supabase
      .from('admin_staff_permission_overrides')
      .select('staff_id, permission_key, effect')
      .in('staff_id', staffIds),
  ]);

  const roleMap = new Map((roles ?? []).map((r: any) => [r.id, r]));
  const userMap = new Map((users ?? []).map((u: any) => [u.id, u]));
  const ovMap = new Map<string, { permission_key: string; effect: 'grant' | 'revoke' }[]>();
  (overrides ?? []).forEach((o: any) => {
    const list = ovMap.get(o.staff_id) ?? [];
    list.push({ permission_key: o.permission_key, effect: o.effect });
    ovMap.set(o.staff_id, list);
  });

  return rows.map((s) => {
    const role = roleMap.get(s.role_id);
    const user = userMap.get(s.user_id);
    return {
      ...s,
      role_key: role?.key,
      role_name_ar: role?.name_ar,
      role_name_en: role?.name_en,
      user_name: user?.name,
      user_email: user?.email,
      user_phone: user?.phone,
      overrides: ovMap.get(s.id) ?? [],
    };
  });
};

/**
 * Effective permissions for a staff member = role grants ∪ override grants
 * minus override revokes. Computed client-side for the editor preview; the
 * server is the source of truth for enforcement.
 */
export const computeEffective = (
  rolePerms: string[],
  overrides: { permission_key: string; effect: 'grant' | 'revoke' }[]
): Set<string> => {
  const eff = new Set(rolePerms);
  overrides.forEach((o) => {
    if (o.effect === 'grant') eff.add(o.permission_key);
    if (o.effect === 'revoke') eff.delete(o.permission_key);
  });
  return eff;
};

/** Search existing users to promote (by name / email / phone). */
export const searchPromotableUsers = async (
  query: string,
  limit = 20
): Promise<{ id: string; name: string; email: string; phone: string | null }[]> => {
  const q = query.trim();
  let sel = supabase.from('users').select('id, name, email, phone').limit(limit);
  if (q) {
    sel = sel.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
  }
  const { data, error } = await sel;
  if (error) {
    logger.warn('searchPromotableUsers failed', error);
    return [];
  }
  return (data ?? []) as any;
};

export const assignStaff = async (
  userId: string,
  roleKey: string,
  notes?: string
): Promise<void> => {
  const { error } = await supabase.rpc('admin_assign_staff', {
    p_user_id: userId,
    p_role_key: roleKey,
    p_notes: notes ?? null,
  });
  if (error) throw error;
};

export const setStaffActive = async (userId: string, active: boolean): Promise<void> => {
  const { error } = await supabase.rpc('admin_set_staff_active', {
    p_user_id: userId,
    p_active: active,
  });
  if (error) throw error;
};

export const removeStaff = async (userId: string): Promise<void> => {
  const { error } = await supabase.rpc('admin_remove_staff', { p_user_id: userId });
  if (error) throw error;
};

export const setPermissionOverride = async (
  userId: string,
  permissionKey: PermissionKey,
  effect: 'grant' | 'revoke' | null
): Promise<void> => {
  const { error } = await supabase.rpc('admin_set_permission_override', {
    p_user_id: userId,
    p_permission_key: permissionKey,
    p_effect: effect,
  });
  if (error) throw error;
};

export interface AuditEntry {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: any;
  created_at: string;
  actor_name?: string;
}

export const listAudit = async (limit = 50): Promise<AuditEntry[]> => {
  const { data, error } = await supabase
    .from('admin_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    logger.warn('listAudit failed', error);
    return [];
  }
  const rows = (data ?? []) as AuditEntry[];
  const actorIds = Array.from(new Set(rows.map((r) => r.actor_id).filter(Boolean))) as string[];
  if (actorIds.length) {
    const { data: users } = await supabase.from('users').select('id, name').in('id', actorIds);
    const map = new Map((users ?? []).map((u: any) => [u.id, u.name]));
    rows.forEach((r) => {
      if (r.actor_id) r.actor_name = map.get(r.actor_id);
    });
  }
  return rows;
};
