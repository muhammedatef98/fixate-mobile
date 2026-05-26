import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';
import { subscribeUnique } from '../utils/realtimeChannel';

export interface SupportThread {
  id: string;
  user_id: string;
  subject: string | null;
  last_message_at: string;
  unread_for_admin: boolean;
  unread_for_user: boolean;
  status?: 'open' | 'closed';
  closed_at?: string | null;
  closed_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  is_admin: boolean;
  content: string;
  created_at: string;
}

/**
 * Returns the caller's existing support thread, creating one if it doesn't
 * exist yet. Users have at most one thread (UNIQUE on user_id).
 */
export const getOrCreateMyThread = async (userId: string): Promise<SupportThread> => {
  const { data: existing, error: selErr } = await supabase
    .from('support_threads')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (selErr) {
    logger.warn('support thread select failed', selErr);
  }
  if (existing) return existing as SupportThread;

  const { data, error } = await supabase
    .from('support_threads')
    .insert({ user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data as SupportThread;
};

export interface ListThreadsOptions {
  /** 'open' (default), 'closed', or 'all'. */
  status?: 'open' | 'closed' | 'all';
}

export const listAllThreads = async (
  opts: ListThreadsOptions = {}
): Promise<(SupportThread & { user_name?: string; user_email?: string; last_preview?: string })[]> => {
  const status = opts.status ?? 'open';
  let q = supabase
    .from('support_threads')
    .select('*')
    .order('last_message_at', { ascending: false })
    .limit(200);
  if (status !== 'all') {
    // Treat rows with NULL status (legacy) as 'open' so they remain visible
    // after the migration ships but before triggers re-fill them.
    if (status === 'open') {
      q = q.or('status.eq.open,status.is.null') as typeof q;
    } else {
      q = q.eq('status', 'closed');
    }
  }
  const { data: threads, error } = await q;
  if (error) {
    logger.warn('listAllThreads failed', error);
    return [];
  }
  const list = threads ?? [];
  if (!list.length) return [];

  const userIds = Array.from(new Set(list.map((t: any) => t.user_id).filter(Boolean)));
  const { data: users } = await supabase
    .from('users')
    .select('id, name, email')
    .in('id', userIds);
  const lookup = new Map<string, { name?: string; email?: string }>();
  (users ?? []).forEach((u: any) => lookup.set(u.id, { name: u.name, email: u.email }));

  return list.map((t: any) => ({
    ...t,
    user_name: lookup.get(t.user_id)?.name,
    user_email: lookup.get(t.user_id)?.email,
  }));
};

export const getMessages = async (threadId: string, limit = 200): Promise<SupportMessage[]> => {
  const { data, error } = await supabase
    .from('support_messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) {
    logger.warn('getMessages failed', error);
    return [];
  }
  return data as SupportMessage[];
};

export const sendMessage = async (
  threadId: string,
  senderId: string,
  isAdmin: boolean,
  content: string
): Promise<SupportMessage> => {
  const trimmed = content.trim();
  if (!trimmed) throw new Error('Empty message');
  const { data, error } = await supabase
    .from('support_messages')
    .insert({
      thread_id: threadId,
      sender_id: senderId,
      is_admin: isAdmin,
      content: trimmed,
    })
    .select()
    .single();
  if (error) throw error;
  return data as SupportMessage;
};

export const markRead = async (threadId: string, asAdmin: boolean): Promise<void> => {
  const updates: any = asAdmin
    ? { unread_for_admin: false }
    : { unread_for_user: false };
  await supabase.from('support_threads').update(updates).eq('id', threadId);
};

/**
 * Subscribe to new messages on a support thread. Returns a cleanup
 * function (invoke it from useEffect cleanup or via a ref).
 */
export const subscribeMessages = (
  threadId: string,
  onInsert: (msg: SupportMessage) => void
): (() => void) => {
  return subscribeUnique(`support-thread-${threadId}`, (ch) =>
    ch.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'support_messages',
        filter: `thread_id=eq.${threadId}`,
      },
      (payload: any) => onInsert(payload.new as SupportMessage)
    )
  );
};

/**
 * Closes idle threads where the last message was from the customer more
 * than `idleMinutes` ago (default 5). Returns the number of threads closed.
 * Safe to call opportunistically (e.g. when admin opens the support list,
 * or on app foreground) — it is also intended to be wired to a cron job.
 */
export const closeIdleThreads = async (idleMinutes = 5): Promise<number> => {
  try {
    const { data, error } = await supabase.rpc('support_close_idle_threads', {
      idle_minutes: idleMinutes,
    });
    if (error) {
      logger.warn('support_close_idle_threads failed', error);
      return 0;
    }
    return typeof data === 'number' ? data : 0;
  } catch (e) {
    logger.warn('closeIdleThreads threw', e);
    return 0;
  }
};

export const closeThread = async (threadId: string, reason = 'manual'): Promise<void> => {
  const { error } = await supabase.rpc('support_close_thread', {
    p_thread_id: threadId,
    p_reason: reason,
  });
  if (error) {
    logger.warn('support_close_thread failed', error);
    throw error;
  }
};

export const subscribeAllThreads = (onChange: () => void): (() => void) => {
  return subscribeUnique('support-threads-feed', (ch) =>
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'support_threads' }, onChange)
  );
};
