import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

export type UserAccountStatus = 'active' | 'suspended' | 'blocked';
export type TechnicianStatus =
  | 'active'
  | 'under_review'
  | 'suspended'
  | 'excluded';
/** The couriers table constrains this to three values (no 'under_review'). */
export type CourierStatus = 'active' | 'suspended' | 'excluded';

export type ModerationTarget = 'user' | 'technician' | 'courier';

export interface ModerationLog {
  id: string;
  actor_id: string | null;
  target_type: ModerationTarget;
  target_id: string;
  action: string;
  reason: string | null;
  created_at: string;
}

const currentActor = async (): Promise<string | null> => {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
};

const log = async (
  targetType: ModerationTarget,
  targetId: string,
  action: string,
  reason?: string | null
) => {
  try {
    await supabase.from('moderation_logs').insert({
      actor_id: await currentActor(),
      target_type: targetType,
      target_id: targetId,
      action,
      reason: reason ?? null,
    });
  } catch (e) {
    logger.warn('moderation log insert failed', e);
  }
};

/** Update a user's account status. A suspended/blocked user is locked out
 *  of the whole app (see the root gate in app/_layout.tsx). */
export const setUserStatus = async (
  userId: string,
  status: UserAccountStatus,
  reason?: string
): Promise<void> => {
  const { error } = await supabase
    .from('users')
    .update({ account_status: status, status_updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
  await log('user', userId, `status:${status}`, reason);
};

export const setUserNotes = async (
  userId: string,
  notes: string
): Promise<void> => {
  const { error } = await supabase
    .from('users')
    .update({ admin_notes: notes })
    .eq('id', userId);
  if (error) throw error;
  await log('user', userId, 'notes_updated');
};

/** Update a technician's lifecycle status. An excluded technician is removed
 *  from job assignment / new request allocation. */
export const setTechnicianStatus = async (
  technicianId: string,
  status: TechnicianStatus,
  reason?: string
): Promise<void> => {
  const { error } = await supabase
    .from('technicians')
    .update({ technician_status: status, status_updated_at: new Date().toISOString() })
    .eq('id', technicianId);
  if (error) throw error;
  await log('technician', technicianId, `status:${status}`, reason);
};

export const setTechnicianNotes = async (
  technicianId: string,
  notes: string
): Promise<void> => {
  const { error } = await supabase
    .from('technicians')
    .update({ admin_notes: notes })
    .eq('id', technicianId);
  if (error) throw error;
  await log('technician', technicianId, 'notes_updated');
};

/** Update a courier's lifecycle status. Suspended/excluded couriers are no
 *  longer offered delivery tasks (enforced in the claim RPCs). */
export const setCourierStatus = async (
  courierId: string,
  status: CourierStatus,
  reason?: string
): Promise<void> => {
  const { error } = await supabase
    .from('couriers')
    .update({ courier_status: status, status_updated_at: new Date().toISOString() })
    .eq('id', courierId);
  if (error) throw error;
  await log('courier', courierId, `status:${status}`, reason);
};

export const setCourierNotes = async (
  courierId: string,
  notes: string
): Promise<void> => {
  const { error } = await supabase
    .from('couriers')
    .update({ admin_notes: notes })
    .eq('id', courierId);
  if (error) throw error;
  await log('courier', courierId, 'notes_updated');
};

export const listModerationLogs = async (
  targetType: ModerationTarget,
  targetId: string
): Promise<ModerationLog[]> => {
  try {
    const { data, error } = await supabase
      .from('moderation_logs')
      .select('*')
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []) as ModerationLog[];
  } catch (e) {
    logger.warn('listModerationLogs failed', e);
    return [];
  }
};
