import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';
import { subscribeUnique } from '../utils/realtimeChannel';
import { notifyUsers } from './notifyService';

export type SupportStatus = 'open' | 'waiting' | 'assigned' | 'closed';

/** Operational context an agent needs while handling a support thread (§9). */
export interface SupportUserContext {
  profile: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    role: string | null;
    is_verified: boolean | null;
    account_status: string | null;
    created_at: string | null;
  } | null;
  orders: {
    id: string;
    order_number: string | null;
    device_brand: string | null;
    device_model: string | null;
    status: string;
    created_at: string | null;
  }[];
}

/**
 * Load the user behind a support thread plus their recent orders/requests so
 * the agent can see who they're talking to and inspect their context without
 * leaving the conversation. Admin RLS gates the reads.
 */
export const getUserSupportContext = async (
  userId: string
): Promise<SupportUserContext> => {
  const [profileRes, ordersRes] = await Promise.all([
    supabase
      .from('users')
      .select('id, name, email, phone, role, is_verified, account_status, created_at')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('orders')
      .select('id, order_number, device_brand, device_model, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);
  if (profileRes.error) logger.warn('support context profile failed', profileRes.error);
  if (ordersRes.error) logger.warn('support context orders failed', ordersRes.error);
  return {
    profile: (profileRes.data ?? null) as SupportUserContext['profile'],
    orders: (ordersRes.data ?? []) as SupportUserContext['orders'],
  };
};

export interface SupportThread {
  id: string;
  user_id: string;
  subject: string | null;
  last_message_at: string;
  unread_for_admin: boolean;
  unread_for_user: boolean;
  status?: SupportStatus;
  closed_at?: string | null;
  closed_reason?: string | null;
  assigned_admin_id?: string | null;
  assigned_at?: string | null;
  last_admin_id?: string | null;
  auto_reply_sent?: boolean;
  internal_note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  id: string;
  thread_id: string;
  sender_id: string | null;
  is_admin: boolean;
  is_system?: boolean;
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

export type ThreadFilter = 'waiting' | 'assigned' | 'closed' | 'all';

export interface ListThreadsOptions {
  /** 'waiting', 'assigned', 'closed', or 'all' (default). */
  status?: ThreadFilter;
}

export type AdminThread = SupportThread & {
  user_name?: string;
  user_email?: string;
  assigned_admin_name?: string;
  last_admin_name?: string;
};

export const listAllThreads = async (opts: ListThreadsOptions = {}): Promise<AdminThread[]> => {
  const status = opts.status ?? 'all';
  let q = supabase
    .from('support_threads')
    .select('*')
    .order('last_message_at', { ascending: false })
    .limit(300);
  if (status === 'closed') {
    q = q.eq('status', 'closed');
  } else if (status === 'waiting') {
    // Legacy 'open'/NULL behave as waiting (no agent yet).
    q = q.or('status.eq.waiting,status.eq.open,status.is.null') as typeof q;
  } else if (status === 'assigned') {
    q = q.eq('status', 'assigned');
  }
  const { data: threads, error } = await q;
  if (error) {
    logger.warn('listAllThreads failed', error);
    return [];
  }
  const list = threads ?? [];
  if (!list.length) return [];

  const userIds = Array.from(new Set(list.map((t: any) => t.user_id).filter(Boolean)));
  const adminIds = Array.from(
    new Set(
      list.flatMap((t: any) => [t.assigned_admin_id, t.last_admin_id]).filter(Boolean)
    )
  );
  const allIds = Array.from(new Set([...userIds, ...adminIds]));
  const { data: users } = await supabase.from('users').select('id, name, email').in('id', allIds);
  const lookup = new Map<string, { name?: string; email?: string }>();
  (users ?? []).forEach((u: any) => lookup.set(u.id, { name: u.name, email: u.email }));

  return list.map((t: any) => ({
    ...t,
    user_name: lookup.get(t.user_id)?.name,
    user_email: lookup.get(t.user_id)?.email,
    assigned_admin_name: t.assigned_admin_id ? lookup.get(t.assigned_admin_id)?.name : undefined,
    last_admin_name: t.last_admin_id ? lookup.get(t.last_admin_id)?.name : undefined,
  }));
};

/** Assign (claim) a thread to an agent. Defaults to the current user. */
export const assignThread = async (threadId: string, adminId?: string): Promise<void> => {
  const { error } = await supabase.rpc('support_assign_thread', {
    p_thread_id: threadId,
    p_admin_id: adminId ?? null,
  });
  if (error) {
    logger.warn('support_assign_thread failed', error);
    throw error;
  }
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

  // Fire-and-forget: when a customer writes in, push to the assigned CS agent
  // (falling back to the last admin who replied). A push failure must never
  // block the message send.
  if (!isAdmin) {
    void (async () => {
      try {
        const { data: thread } = await supabase
          .from('support_threads')
          .select('assigned_admin_id, last_admin_id')
          .eq('id', threadId)
          .single();
        const adminId = thread?.assigned_admin_id ?? thread?.last_admin_id;
        if (!adminId) return;
        await notifyUsers(adminId, {
          title: 'رسالة دعم جديدة',
          body: trimmed.slice(0, 100),
          data: { screen: 'support-thread', threadId },
        });
      } catch (e) {
        logger.warn('support new-message notify failed', e);
      }
    })();
  }

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

/**
 * Notify-then-close idle sweep (§9): warns the user with a system message at
 * `warnMinutes` of inactivity, then closes `graceMinutes` later if they still
 * haven't replied. A new user message clears the warning and reopens the
 * thread. Returns the number of threads closed on this pass.
 */
export const sweepIdleThreads = async (
  warnMinutes = 5,
  graceMinutes = 1
): Promise<number> => {
  try {
    const { data, error } = await supabase.rpc('support_idle_sweep', {
      warn_minutes: warnMinutes,
      grace_minutes: graceMinutes,
    });
    if (error) {
      logger.warn('support_idle_sweep failed', error);
      return 0;
    }
    return typeof data === 'number' ? data : 0;
  } catch (e) {
    logger.warn('sweepIdleThreads threw', e);
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
