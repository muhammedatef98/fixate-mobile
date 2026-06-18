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
  /** Total tokens the server attempted to deliver to. */
  total?: number;
  /** Number of valid registered tokens the server resolved for this send. */
  recipients?: number;
  errors?: string[];
}

export interface PushStats {
  totalUsers: number;
  withToken: number;
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

/**
 * Admin debug helpers. `getPushStats` returns DB-wide token counts (resolved
 * server-side with the service role, so RLS never hides rows). `sendTestPush`
 * fans a test notification out to ALL registered tokens and returns the raw
 * dispatch result so the admin can see sent/failed/errors end-to-end.
 */
export const getPushStats = async (): Promise<PushStats> => {
  try {
    const { data, error } = await supabase.functions.invoke('push-dispatch', {
      body: { mode: 'stats' },
    });
    if (error) {
      logger.warn('push stats failed', error);
      return { totalUsers: 0, withToken: 0 };
    }
    return (data as PushStats) ?? { totalUsers: 0, withToken: 0 };
  } catch (e) {
    logger.warn('push stats threw', e);
    return { totalUsers: 0, withToken: 0 };
  }
};

export const sendTestPush = async (): Promise<PushResult> =>
  notifyAudience('all', {
    title: 'Fixate test 🔔',
    body: 'Push debug: end-to-end delivery check.',
    data: { type: 'debug_test' },
  });
