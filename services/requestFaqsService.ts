import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

/**
 * Admin-controlled FAQ catalogue powering the in-app chatbot. Reads are
 * open to everyone (the chat needs them); writes are gated by the
 * `request_faqs_admin_all` RLS policy → only `is_admin = true` users
 * can mutate. The admin UI in /admin-request-settings exposes
 * enable/disable + edit + create. There is no hard-delete in the UI;
 * disabling a FAQ hides it from both the matcher and the suggestions
 * (matches the project posture: "archive/disable, never destroy").
 *
 * `related` stores OTHER faq codes (not UUIDs) so reordering or soft-
 * renaming a row never breaks follow-up chip references.
 */
export interface RequestFaq {
  id: string;
  code: string;
  q_ar: string;
  q_en: string;
  a_ar: string;
  a_en: string;
  keywords: string[];
  strong: string[];
  related: string[];
  enabled: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { ts: number; rows: RequestFaq[] } | null = null;

export const invalidateRequestFaqsCache = (): void => {
  cache = null;
};

/** All FAQs, ordered by `sort_order` then `code`. Cached for 5 minutes. */
export const listRequestFaqs = async (): Promise<RequestFaq[]> => {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) return cache.rows;
  try {
    const { data, error } = await supabase
      .from('request_faqs')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('code', { ascending: true });
    if (error) throw error;
    const rows = (data ?? []).map((r: any) => ({
      ...r,
      // Supabase returns text[] as JS arrays already; coerce defensively
      // so a missing column (older client) never blows up the matcher.
      keywords: Array.isArray(r.keywords) ? r.keywords : [],
      strong: Array.isArray(r.strong) ? r.strong : [],
      related: Array.isArray(r.related) ? r.related : [],
    })) as RequestFaq[];
    cache = { ts: Date.now(), rows };
    return rows;
  } catch (e) {
    logger.warn('listRequestFaqs failed', e);
    return [];
  }
};

export type CreateRequestFaqInput = {
  code: string;
  q_ar: string;
  q_en: string;
  a_ar: string;
  a_en: string;
  keywords?: string[];
  strong?: string[];
  related?: string[];
  enabled?: boolean;
  sort_order?: number;
};

export const createRequestFaq = async (
  input: CreateRequestFaqInput
): Promise<RequestFaq> => {
  const row = {
    code: input.code.trim().toLowerCase(),
    q_ar: input.q_ar.trim(),
    q_en: input.q_en.trim(),
    a_ar: input.a_ar.trim(),
    a_en: input.a_en.trim(),
    keywords: (input.keywords ?? []).map((k) => k.trim()).filter(Boolean),
    strong: (input.strong ?? []).map((k) => k.trim()).filter(Boolean),
    related: (input.related ?? []).map((k) => k.trim().toLowerCase()).filter(Boolean),
    enabled: input.enabled ?? true,
    sort_order: input.sort_order ?? 100,
  };
  const { data, error } = await supabase
    .from('request_faqs')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  invalidateRequestFaqsCache();
  return data as RequestFaq;
};

export const updateRequestFaq = async (
  id: string,
  patch: Partial<Pick<
    RequestFaq,
    'q_ar' | 'q_en' | 'a_ar' | 'a_en' | 'keywords' | 'strong' | 'related' | 'enabled' | 'sort_order'
  >>
): Promise<RequestFaq> => {
  // Defensive normalisation: trim strings, drop empties, lowercase
  // related codes so the matcher's lookup stays case-insensitive.
  const clean: any = { ...patch };
  if (clean.q_ar != null) clean.q_ar = String(clean.q_ar).trim();
  if (clean.q_en != null) clean.q_en = String(clean.q_en).trim();
  if (clean.a_ar != null) clean.a_ar = String(clean.a_ar).trim();
  if (clean.a_en != null) clean.a_en = String(clean.a_en).trim();
  if (Array.isArray(clean.keywords)) clean.keywords = clean.keywords.map((k: string) => k.trim()).filter(Boolean);
  if (Array.isArray(clean.strong))   clean.strong   = clean.strong.map((k: string) => k.trim()).filter(Boolean);
  if (Array.isArray(clean.related))  clean.related  = clean.related.map((k: string) => k.trim().toLowerCase()).filter(Boolean);

  const { data, error } = await supabase
    .from('request_faqs')
    .update(clean)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  invalidateRequestFaqsCache();
  return data as RequestFaq;
};

export const setRequestFaqEnabled = async (
  id: string,
  enabled: boolean
): Promise<RequestFaq> => updateRequestFaq(id, { enabled });
