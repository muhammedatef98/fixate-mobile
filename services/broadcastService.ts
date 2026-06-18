import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';
import { notifyAudience } from './notifyService';

export type BroadcastCategory = 'announcement' | 'promo' | 'update' | 'maintenance';
export type BroadcastAudience = 'all' | 'customers' | 'technicians';

export interface Broadcast {
  id: string;
  title: string;
  body: string;
  category: BroadcastCategory;
  audience: BroadcastAudience;
  data: Record<string, any>;
  sent_count: number;
  failed_count: number;
  created_by: string | null;
  created_at: string;
  sent_at: string | null;
  /** Valid registered tokens resolved for this send (transient, not persisted). */
  recipients?: number;
}

export interface CreateBroadcastInput {
  title: string;
  body: string;
  category?: BroadcastCategory;
  audience?: BroadcastAudience;
  data?: Record<string, any>;
}

/**
 * Persist + send a broadcast. The flow:
 *   1. Insert the row (admin RLS gates this; non-admins get a 401).
 *   2. Resolve recipient push tokens via the admin-only RPC
 *      `broadcast_targets`.
 *   3. POST in batches to Expo's push API (the same endpoint
 *      `lib/notifications` already uses for per-user pushes).
 *   4. Record sent/failed counts via `broadcast_mark_sent`.
 *
 * Everything except step 1 is best-effort: a network failure to Expo
 * leaves the broadcast row intact so the admin can re-trigger it later.
 */
export const sendBroadcast = async (
  adminUserId: string,
  input: CreateBroadcastInput
): Promise<Broadcast> => {
  const row = {
    title: input.title.trim(),
    body: input.body.trim(),
    category: input.category ?? 'announcement',
    audience: input.audience ?? 'all',
    data: input.data ?? {},
    created_by: adminUserId,
  };
  const { data, error } = await supabase
    .from('broadcasts')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  const broadcast = data as Broadcast;

  // Fan out server-side via the `push-dispatch` Edge Function. It resolves
  // recipient tokens with the service role (so RLS / token visibility is not a
  // problem) and returns accurate sent/failed counts plus the distinct Expo
  // ticket errors, which surface the *real* delivery failure reason.
  let sent = 0;
  let failed = 0;
  let recipients = 0;
  try {
    const result = await notifyAudience(broadcast.audience, {
      title: broadcast.title,
      body: broadcast.body,
      data: { type: 'broadcast', category: broadcast.category, ...(broadcast.data ?? {}) },
    });
    sent = result.sent;
    failed = result.failed;
    recipients = result.recipients ?? result.sent + result.failed;
    if (result.errors?.length) {
      logger.warn('broadcast push errors', result.errors);
    }
  } catch (e) {
    logger.warn('broadcast push fan-out failed', e);
  }

  try {
    await supabase.rpc('broadcast_mark_sent', {
      p_broadcast_id: broadcast.id,
      p_sent: sent,
      p_failed: failed,
    });
  } catch (e) {
    logger.warn('broadcast_mark_sent failed', e);
  }

  return { ...broadcast, sent_count: sent, failed_count: failed, recipients, sent_at: new Date().toISOString() };
};

export const listBroadcasts = async (): Promise<Broadcast[]> => {
  const { data, error } = await supabase
    .from('broadcasts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    logger.warn('listBroadcasts failed', error);
    return [];
  }
  return (data ?? []) as Broadcast[];
};

