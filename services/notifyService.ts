import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

/**
 * Thin client around the `push-dispatch` Edge Function. The function resolves
 * recipient Expo tokens server-side (service role) and fans out to Expo's push
 * API, so the app only has to say *who* and *what*.
 *
 * All helpers are best-effort: a push failure must never block the underlying
 * action (sending a message, accepting an order, ...), so errors are logged
 * and swallowed.
 */

export interface PushResult {
  sent: number;
  failed: number;
  errors?: string[];
}

export type PushAudience = 'all' | 'customers' | 'technicians';

export interface PushPayload {
  title: string;
  body: string;
  /** Deep-link payload. Include `screen` and ids (e.g. orderId) for routing. */
  data?: Record<string, unknown>;
}

const invoke = async (body: Record<string, unknown>): Promise<PushResult> => {
  try {
    const { data, error } = await supabase.functions.invoke('push-dispatch', {
      body,
    });
    if (error) {
      logger.warn('push-dispatch invoke failed', error);
      return { sent: 0, failed: 0 };
    }
    return (data as PushResult) ?? { sent: 0, failed: 0 };
  } catch (e) {
    logger.warn('push-dispatch threw', e);
    return { sent: 0, failed: 0 };
  }
};

/** Notify one or more specific users. `excludeUserId` skips the actor. */
export const notifyUsers = async (
  userIds: string | string[],
  payload: PushPayload,
  excludeUserId?: string
): Promise<PushResult> => {
  const ids = (Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean);
  if (ids.length === 0) return { sent: 0, failed: 0 };
  return invoke({ userIds: ids, excludeUserId, ...payload });
};

/** Notify a whole audience segment (used by admin broadcasts). */
export const notifyAudience = async (
  audience: PushAudience,
  payload: PushPayload
): Promise<PushResult> => invoke({ audience, ...payload });
