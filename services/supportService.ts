import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

export interface SupportThread {
  id: string;
  user_id: string;
  subject: string | null;
  last_message_at: string;
  unread_for_admin: boolean;
  unread_for_user: boolean;
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

export const listAllThreads = async (): Promise<(SupportThread & { user_name?: string; user_email?: string; last_preview?: string })[]> => {
  // Don't use PostgREST embed — support_threads.user_id has a FK to
  // auth.users (not public.users), so the embed silently returns null for
  // every user. Fetch threads first, then resolve names/emails in a single
  // follow-up query against public.users.
  const { data: threads, error } = await supabase
    .from('support_threads')
    .select('*')
    .order('last_message_at', { ascending: false })
    .limit(200);
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

export const subscribeMessages = (
  threadId: string,
  onInsert: (msg: SupportMessage) => void
) => {
  return supabase
    .channel(`support-thread-${threadId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'support_messages',
        filter: `thread_id=eq.${threadId}`,
      },
      (payload) => onInsert(payload.new as SupportMessage)
    )
    .subscribe();
};

export const subscribeAllThreads = (onChange: () => void) => {
  return supabase
    .channel('support-threads-feed')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'support_threads' }, onChange)
    .subscribe();
};
