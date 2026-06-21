import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';
import { uploadCommunityImage } from './storageService';
import { sendNotification } from '../utils/notifications';

/** Post category tags (matches the community_posts.tag check constraint). */
export type CommunityTag = 'سؤال' | 'نصيحة' | 'مشكلة' | 'عام';
export const COMMUNITY_TAGS: CommunityTag[] = ['سؤال', 'نصيحة', 'مشكلة', 'عام'];

// ── Types ───────────────────────────────────────────────────────────────
export interface CommunityPost {
  id: string;
  technician_id: string;
  content: string;
  image_url: string | null;
  likes_count: number;
  comments_count: number;
  report_count: number;
  tag: CommunityTag;
  created_at: string;
  // Joined / derived
  author_name: string;
  author_specialty: string;
  liked_by_me: boolean;
}

export interface CommunityComment {
  id: string;
  post_id: string;
  technician_id: string;
  parent_id: string | null;
  content: string;
  likes_count: number;
  created_at: string;
  author_name: string;
  author_specialty: string;
  liked_by_me: boolean;
}

/** A comment plus its nested replies — produced by buildCommentTree. */
export interface CommunityCommentNode extends CommunityComment {
  replies: CommunityCommentNode[];
}

interface TechnicianLite {
  user_id: string;
  name: string | null;
  specialization: string[] | null;
}

const POST_COLUMNS =
  'id, technician_id, content, image_url, likes_count, comments_count, report_count, tag, created_at';

/** Short label for a post used inside notification bodies. */
const postSnippet = (content: string): string => {
  const t = (content ?? '').trim().replace(/\s+/g, ' ');
  return t.length > 40 ? `${t.slice(0, 40)}…` : t;
};

/** Resolve a single author's display name (falls back to "فني"). */
const authorDisplayName = async (id: string): Promise<string> => {
  const map = await fetchAuthors([id]);
  return map.get(id)?.name || 'فني';
};

/** Build a {userId -> {name, specialty}} map for the given author ids. */
const fetchAuthors = async (ids: string[]): Promise<Map<string, { name: string; specialty: string }>> => {
  const map = new Map<string, { name: string; specialty: string }>();
  const unique = Array.from(new Set(ids)).filter(Boolean);
  if (unique.length === 0) return map;
  const { data, error } = await supabase
    .from('technicians')
    .select('user_id, name, specialization')
    .in('user_id', unique);
  if (error) {
    logger.warn('community fetchAuthors failed', error);
    return map;
  }
  for (const t of (data ?? []) as TechnicianLite[]) {
    map.set(t.user_id, {
      name: t.name?.trim() || '',
      specialty: Array.isArray(t.specialization) ? t.specialization.filter(Boolean).join('، ') : '',
    });
  }
  return map;
};

// ── Feed ────────────────────────────────────────────────────────────────
/** Posts sorted newest-first, enriched with author + whether `meId` liked. */
export const listPosts = async (meId: string): Promise<CommunityPost[]> => {
  const { data, error } = await supabase
    .from('community_posts')
    .select(POST_COLUMNS)
    .order('created_at', { ascending: false });
  if (error) {
    logger.warn('listPosts failed', error);
    throw error;
  }
  const posts = (data ?? []) as any[];
  if (posts.length === 0) return [];

  const ids = posts.map((p) => p.id);
  const [authors, likedRes] = await Promise.all([
    fetchAuthors(posts.map((p) => p.technician_id)),
    supabase
      .from('community_likes')
      .select('post_id')
      .eq('technician_id', meId)
      .in('post_id', ids),
  ]);
  const likedSet = new Set((likedRes.data ?? []).map((r: any) => r.post_id));

  return posts.map((p) => {
    const a = authors.get(p.technician_id);
    return {
      ...p,
      tag: (p.tag ?? 'عام') as CommunityTag,
      author_name: a?.name || 'فني',
      author_specialty: a?.specialty || '',
      liked_by_me: likedSet.has(p.id),
    } as CommunityPost;
  });
};

// ── Create ──────────────────────────────────────────────────────────────
export const createPost = async (
  meId: string,
  content: string,
  imageUri?: string | null,
  tag: CommunityTag = 'عام'
): Promise<void> => {
  const trimmed = content.trim();
  if (!trimmed) throw new Error('المحتوى مطلوب');
  let imageUrl: string | null = null;
  if (imageUri) {
    imageUrl = await uploadCommunityImage(meId, imageUri);
  }
  const { error } = await supabase
    .from('community_posts')
    .insert({ technician_id: meId, content: trimmed, image_url: imageUrl, tag });
  if (error) {
    logger.warn('createPost failed', error);
    throw error;
  }
};

// ── Update (author only — RLS enforces technician_id = auth.uid()) ──────────
export const updatePost = async (
  postId: string,
  patch: { content: string }
): Promise<void> => {
  const trimmed = patch.content.trim();
  if (!trimmed) throw new Error('المحتوى مطلوب');
  const { error } = await supabase
    .from('community_posts')
    .update({ content: trimmed })
    .eq('id', postId);
  if (error) {
    logger.warn('updatePost failed', error);
    throw error;
  }
};

// ── Like (toggle) ─────────────────────────────────────────────────────────
/** Toggle a like. `currentlyLiked` is the caller's current view of the state. */
export const toggleLike = async (
  meId: string,
  postId: string,
  currentlyLiked: boolean
): Promise<void> => {
  if (currentlyLiked) {
    const { error } = await supabase
      .from('community_likes')
      .delete()
      .eq('post_id', postId)
      .eq('technician_id', meId);
    if (error) throw error;
  } else {
    // Ignore unique-violation: a double-tap means it's already liked.
    const { error } = await supabase
      .from('community_likes')
      .insert({ post_id: postId, technician_id: meId });
    if (error && error.code !== '23505') throw error;
    // Notify the post author that their post was liked (best-effort; never
    // self-notify). Only fires on the like (not the unlike) side.
    if (!error) {
      void notifyPostLiked(meId, postId);
    }
  }
};

/** In-app notification to a post author when someone likes their post. */
const notifyPostLiked = async (likerId: string, postId: string): Promise<void> => {
  try {
    const { data: post } = await supabase
      .from('community_posts')
      .select('technician_id, content')
      .eq('id', postId)
      .maybeSingle();
    if (!post || post.technician_id === likerId) return;
    const name = await authorDisplayName(likerId);
    await sendNotification(post.technician_id, {
      titleAr: 'أُعجب بوستك',
      titleEn: 'Your post was liked',
      bodyAr: `${name} أعجبه بوستك: ${postSnippet(post.content)}`,
      bodyEn: `${name} liked your post: ${postSnippet(post.content)}`,
      type: 'general',
      relatedId: postId,
    });
  } catch (e) {
    logger.warn('notifyPostLiked failed', e);
  }
};

// ── Comments (threaded) ─────────────────────────────────────────────────--
/**
 * Flat list of all comments for a post (parent_id included), enriched with
 * author + whether `meId` liked each. The screen builds the reply tree with
 * buildCommentTree(). Fetched flat — a single ORDER BY created_at query —
 * which keeps it simple and avoids a recursive CTE round-trip.
 */
export const listComments = async (
  postId: string,
  meId: string
): Promise<CommunityComment[]> => {
  const { data, error } = await supabase
    .from('community_comments')
    .select('id, post_id, technician_id, parent_id, content, likes_count, created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) {
    logger.warn('listComments failed', error);
    throw error;
  }
  const rows = (data ?? []) as any[];
  if (rows.length === 0) return [];
  const ids = rows.map((c) => c.id);
  const [authors, likedRes] = await Promise.all([
    fetchAuthors(rows.map((c) => c.technician_id)),
    // Skip the per-user likes query when there is no viewer id (e.g. admin
    // moderation view) — passing '' to a uuid column would error.
    meId
      ? supabase
          .from('community_comment_likes')
          .select('comment_id')
          .eq('technician_id', meId)
          .in('comment_id', ids)
      : Promise.resolve({ data: [] as { comment_id: string }[] }),
  ]);
  const likedSet = new Set((likedRes.data ?? []).map((r: any) => r.comment_id));
  return rows.map((c) => {
    const a = authors.get(c.technician_id);
    return {
      ...c,
      likes_count: c.likes_count ?? 0,
      author_name: a?.name || 'فني',
      author_specialty: a?.specialty || '',
      liked_by_me: likedSet.has(c.id),
    } as CommunityComment;
  });
};

export const addComment = async (
  meId: string,
  postId: string,
  content: string,
  parentId?: string | null
): Promise<void> => {
  const trimmed = content.trim();
  if (!trimmed) throw new Error('التعليق مطلوب');
  const { error } = await supabase
    .from('community_comments')
    .insert({ post_id: postId, technician_id: meId, content: trimmed, parent_id: parentId ?? null });
  if (error) {
    logger.warn('addComment failed', error);
    throw error;
  }
  // Best-effort in-app notification (never blocks the comment insert).
  void notifyCommentActivity(meId, postId, parentId ?? null);
};

/**
 * Notify the right recipient after a comment/reply:
 *  - reply (parentId set) → the parent comment's author
 *  - top-level comment    → the post author
 * Self-activity is skipped.
 */
const notifyCommentActivity = async (
  senderId: string,
  postId: string,
  parentId: string | null
): Promise<void> => {
  try {
    const { data: post } = await supabase
      .from('community_posts')
      .select('technician_id, content')
      .eq('id', postId)
      .maybeSingle();
    if (!post) return;
    const snippet = postSnippet(post.content);
    const name = await authorDisplayName(senderId);

    if (parentId) {
      const { data: parent } = await supabase
        .from('community_comments')
        .select('technician_id')
        .eq('id', parentId)
        .maybeSingle();
      const recipient = parent?.technician_id;
      if (!recipient || recipient === senderId) return;
      await sendNotification(recipient, {
        titleAr: 'رد جديد على تعليقك',
        titleEn: 'New reply to your comment',
        bodyAr: `ردّ ${name} على تعليقك في: ${snippet}`,
        bodyEn: `${name} replied to your comment on: ${snippet}`,
        type: 'general',
        relatedId: postId,
      });
      return;
    }

    if (post.technician_id === senderId) return;
    await sendNotification(post.technician_id, {
      titleAr: 'تعليق جديد على بوستك',
      titleEn: 'New comment on your post',
      bodyAr: `علّق ${name} على: ${snippet}`,
      bodyEn: `${name} commented on: ${snippet}`,
      type: 'general',
      relatedId: postId,
    });
  } catch (e) {
    logger.warn('notifyCommentActivity failed', e);
  }
};

/** Toggle a like on a comment (works at any nesting level). */
export const toggleCommentLike = async (
  meId: string,
  commentId: string,
  currentlyLiked: boolean
): Promise<void> => {
  if (currentlyLiked) {
    const { error } = await supabase
      .from('community_comment_likes')
      .delete()
      .eq('comment_id', commentId)
      .eq('technician_id', meId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('community_comment_likes')
      .insert({ comment_id: commentId, technician_id: meId });
    if (error && error.code !== '23505') throw error;
  }
};

// ── Report ──────────────────────────────────────────────────────────────
export const reportPost = async (
  meId: string,
  postId: string,
  reason?: string
): Promise<void> => {
  const { error } = await supabase
    .from('community_reports')
    .insert({ post_id: postId, technician_id: meId, reason: reason?.trim() || null });
  // 23505 = already reported by this technician; treat as success.
  if (error && error.code !== '23505') {
    logger.warn('reportPost failed', error);
    throw error;
  }
};

// ── Delete (author or admin via RLS) ───────────────────────────────────────
export const deletePost = async (postId: string): Promise<void> => {
  const { error } = await supabase.from('community_posts').delete().eq('id', postId);
  if (error) throw error;
};

export const deleteComment = async (commentId: string): Promise<void> => {
  const { error } = await supabase.from('community_comments').delete().eq('id', commentId);
  if (error) throw error;
};

// ── Admin ───────────────────────────────────────────────────────────────
/** All posts (admin moderation view). `reportedOnly` filters to flagged ones. */
export const adminListPosts = async (reportedOnly = false): Promise<CommunityPost[]> => {
  let q = supabase
    .from('community_posts')
    .select(POST_COLUMNS)
    .order(reportedOnly ? 'report_count' : 'created_at', { ascending: false });
  if (reportedOnly) q = q.gt('report_count', 0);
  const { data, error } = await q;
  if (error) {
    logger.warn('adminListPosts failed', error);
    throw error;
  }
  const posts = (data ?? []) as any[];
  if (posts.length === 0) return [];
  const authors = await fetchAuthors(posts.map((p) => p.technician_id));
  return posts.map((p) => {
    const a = authors.get(p.technician_id);
    return {
      ...p,
      tag: (p.tag ?? 'عام') as CommunityTag,
      author_name: a?.name || 'فني',
      author_specialty: a?.specialty || '',
      liked_by_me: false,
    } as CommunityPost;
  });
};
