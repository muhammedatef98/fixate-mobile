import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

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

  // Resolve targets and fan out to Expo's push API. Done client-side here
  // because we don't yet have a dedicated worker / edge function — but the
  // RPC is admin-only, so this only runs when the admin sends.
  let sent = 0;
  let failed = 0;
  try {
    const { data: targets, error: tErr } = await supabase.rpc('broadcast_targets', {
      p_audience: broadcast.audience,
    });
    if (tErr) {
      logger.warn('broadcast_targets failed', tErr);
    } else {
      const tokens: string[] = (targets ?? [])
        .map((r: any) => r.push_token as string)
        .filter((t: string) => typeof t === 'string' && t.startsWith('ExponentPushToken'));
      const result = await pushToExpo(tokens, broadcast);
      sent = result.sent;
      failed = result.failed;
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

  return { ...broadcast, sent_count: sent, failed_count: failed, sent_at: new Date().toISOString() };
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

// Expo Push API caps each request at 100 messages. Chunk + count.
const EXPO_BATCH_SIZE = 100;
const EXPO_URL = 'https://exp.host/--/api/v2/push/send';

const pushToExpo = async (
  tokens: string[],
  b: Pick<Broadcast, 'title' | 'body' | 'data' | 'category'>
): Promise<{ sent: number; failed: number }> => {
  if (tokens.length === 0) return { sent: 0, failed: 0 };
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < tokens.length; i += EXPO_BATCH_SIZE) {
    const slice = tokens.slice(i, i + EXPO_BATCH_SIZE);
    const messages = slice.map((to) => ({
      to,
      sound: 'default',
      title: b.title,
      body: b.body,
      data: { type: 'broadcast', category: b.category, ...(b.data ?? {}) },
    }));
    try {
      const res = await fetch(EXPO_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });
      if (!res.ok) {
        failed += slice.length;
        continue;
      }
      const json = (await res.json()) as { data?: Array<{ status?: string }> };
      const tickets = json?.data ?? [];
      // Expo returns one ticket per message; "ok" → sent, anything else → failed.
      for (const t of tickets) {
        if (t.status === 'ok') sent += 1;
        else failed += 1;
      }
      // Any missing tickets count as failed.
      if (tickets.length < slice.length) {
        failed += slice.length - tickets.length;
      }
    } catch {
      failed += slice.length;
    }
  }
  return { sent, failed };
};
