import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';
import { subscribeUnique } from '../utils/realtimeChannel';

export type ListingCategory = 'used_device' | 'accessory' | 'spare_part' | 'other';
export type ListingStatus = 'pending' | 'active' | 'sold' | 'rejected' | 'archived';
export type ContactPreference = 'dm' | 'phone' | 'both';
export type ContactMethod = 'whatsapp' | 'phone' | 'in_app';
export type DeviceType =
  | 'phone'
  | 'laptop'
  | 'tablet'
  | 'watch'
  | 'gaming'
  | 'headphones'
  | 'tv'
  | 'appliance'
  | 'accessory'
  | 'other';
export type ListingCondition = 'new' | 'like_new' | 'used' | 'refurbished' | 'for_parts';

/** Device/item categories for marketplace listings and filters. */
export const MARKET_DEVICE_TYPES: { id: DeviceType; ar: string; en: string; icon: string }[] = [
  { id: 'phone',      ar: 'جوال',           en: 'Mobile phone',     icon: 'cellphone' },
  { id: 'laptop',     ar: 'لابتوب',         en: 'Laptop',           icon: 'laptop' },
  { id: 'tablet',     ar: 'تابلت',          en: 'Tablet',           icon: 'tablet' },
  { id: 'watch',      ar: 'ساعة ذكية',      en: 'Smart watch',      icon: 'watch' },
  { id: 'gaming',     ar: 'أجهزة ألعاب',    en: 'Gaming console',   icon: 'gamepad-variant' },
  { id: 'headphones', ar: 'سماعات',         en: 'Headphones',       icon: 'headphones' },
  { id: 'tv',         ar: 'شاشات وتلفاز',   en: 'TV / Display',     icon: 'television' },
  { id: 'appliance',  ar: 'أجهزة منزلية',   en: 'Home appliance',   icon: 'home-outline' },
  { id: 'accessory',  ar: 'إكسسوار',        en: 'Accessory',        icon: 'cable-data' },
  { id: 'other',      ar: 'أخرى',           en: 'Other',            icon: 'dots-horizontal' },
];

export interface MarketListing {
  id: string;
  seller_id: string;
  title: string;
  description?: string | null;
  category: ListingCategory;
  device_type?: DeviceType | null;
  condition?: ListingCondition | null;
  price: number;
  currency: string;
  city?: string | null;
  contact_phone?: string | null;
  /** Legacy three-way enum — preserved for backward compat. */
  contact_preference?: ContactPreference;
  /** New, multi-select contact methods. Falls back to contact_preference. */
  contact_methods?: ContactMethod[] | null;
  images: string[];
  status: ListingStatus;
  created_at?: string;
  updated_at?: string;
  removed_at?: string | null;
  removed_reason?: string | null;
}

/**
 * Soft-delete a listing by the owner: sets status to 'archived' and stamps
 * `removed_at` so admins can review owner-removed listings later. We keep
 * the row (rather than hard-deleting) so any conversation history,
 * receipts, or future disputes remain intact.
 */
export const removeListingByOwner = async (
  id: string,
  reason?: string
): Promise<MarketListing> => {
  const { data, error } = await supabase
    .from('market_listings')
    .update({
      status: 'archived',
      removed_at: new Date().toISOString(),
      removed_reason: reason ?? null,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as MarketListing;
};

/** Resolve the set of contact methods a listing supports, honouring both
 *  the new `contact_methods` array and the legacy `contact_preference`. */
export const resolveContactMethods = (l: MarketListing): Set<ContactMethod> => {
  if (Array.isArray(l.contact_methods) && l.contact_methods.length > 0) {
    return new Set(l.contact_methods);
  }
  const pref = l.contact_preference ?? 'both';
  if (pref === 'phone') return new Set(['phone', 'whatsapp']);
  if (pref === 'dm')    return new Set(['in_app']);
  return new Set(['phone', 'whatsapp', 'in_app']);
};

export interface CreateListingInput {
  title: string;
  description?: string;
  category: ListingCategory;
  price: number;
  city?: string;
  contact_phone?: string;
  /** Legacy three-way enum — translated into contact_methods on insert. */
  contact_preference?: ContactPreference;
  /** New per-method opt-in array. Wins over contact_preference when set. */
  contact_methods?: ContactMethod[];
  device_type?: DeviceType;
  condition?: ListingCondition;
  images?: string[];
}

export interface ListingComment {
  id: string;
  listing_id: string;
  user_id: string;
  parent_id?: string | null;
  content: string;
  created_at: string;
  author_name?: string | null;
}

export interface UserCard {
  id: string;
  name: string | null;
  avatar_url: string | null;
}

/** Read a user's public display card (name + avatar) via the
 *  `public_user_cards` view, which is readable regardless of the
 *  users-table RLS. */
export const getUserCard = async (userId: string): Promise<UserCard | null> => {
  const { data, error } = await supabase
    .from('public_user_cards')
    .select('id, name, avatar_url')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    logger.warn('getUserCard failed', error);
    return null;
  }
  return (data ?? null) as UserCard | null;
};

export const getListing = async (id: string): Promise<MarketListing | null> => {
  const { data, error } = await supabase
    .from('market_listings')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    logger.warn('getListing failed', error);
    return null;
  }
  return (data ?? null) as MarketListing | null;
};

export const listComments = async (listingId: string): Promise<ListingComment[]> => {
  // We deliberately don't join the users table here — it's RLS-restricted
  // for non-admin readers, which used to make this query silently fail.
  // Instead we persist `author_name` at insert time.
  const { data, error } = await supabase
    .from('market_comments')
    .select('*')
    .eq('listing_id', listingId)
    .order('created_at', { ascending: true });
  if (error) {
    logger.warn('listComments failed', error);
    return [];
  }
  return (data ?? []) as ListingComment[];
};

export const addComment = async (
  listingId: string,
  userId: string,
  content: string,
  opts?: { parentId?: string | null; authorName?: string | null }
): Promise<ListingComment> => {
  const payload: any = {
    listing_id: listingId,
    user_id: userId,
    content: content.trim(),
    parent_id: opts?.parentId ?? null,
    author_name: opts?.authorName ?? null,
  };
  // Progressive fallback: pre-migration DB lacks parent_id/author_name.
  let res = await supabase.from('market_comments').insert(payload).select().maybeSingle();
  if (res.error) {
    logger.warn('addComment falling back without new columns', res.error);
    res = await supabase
      .from('market_comments')
      .insert({ listing_id: listingId, user_id: userId, content: content.trim() })
      .select()
      .maybeSingle();
  }
  if (res.error) throw res.error;
  return res.data as ListingComment;
};

export const deleteComment = async (commentId: string): Promise<void> => {
  const { error } = await supabase.from('market_comments').delete().eq('id', commentId);
  if (error) throw error;
};

export type SortKey = 'newest' | 'price_asc' | 'price_desc';

export interface BrowseFilters {
  category?: ListingCategory;
  deviceType?: DeviceType;
  condition?: ListingCondition;
  city?: string;
  /** ILIKE-style search across title + description. */
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: SortKey;
  /** Pagination — 0-based. */
  page?: number;
  pageSize?: number;
}

export const browseListings = async (
  filters: BrowseFilters = {}
): Promise<MarketListing[]> => {
  const page = filters.page ?? 0;
  const pageSize = filters.pageSize ?? 40;
  let q = supabase
    .from('market_listings')
    .select('*')
    .eq('status', 'active')
    .range(page * pageSize, page * pageSize + pageSize - 1);

  // Sort
  switch (filters.sort) {
    case 'price_asc':
      q = q.order('price', { ascending: true });
      break;
    case 'price_desc':
      q = q.order('price', { ascending: false });
      break;
    case 'newest':
    default:
      q = q.order('created_at', { ascending: false });
      break;
  }

  if (filters.category)    q = q.eq('category', filters.category);
  if (filters.deviceType)  q = q.eq('device_type', filters.deviceType);
  if (filters.condition)   q = q.eq('condition', filters.condition);
  if (filters.city)        q = q.eq('city', filters.city);
  if (typeof filters.minPrice === 'number') q = q.gte('price', filters.minPrice);
  if (typeof filters.maxPrice === 'number') q = q.lte('price', filters.maxPrice);
  if (filters.search?.trim()) {
    const s = filters.search.trim().replace(/[%_]/g, '');
    q = q.or(`title.ilike.%${s}%,description.ilike.%${s}%`);
  }

  const { data, error } = await q;
  if (error) {
    logger.warn('browseListings failed', error);
    return [];
  }
  return (data ?? []) as MarketListing[];
};

export const myListings = async (sellerId: string): Promise<MarketListing[]> => {
  const { data, error } = await supabase
    .from('market_listings')
    .select('*')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });
  if (error) {
    logger.warn('myListings failed', error);
    return [];
  }
  return (data ?? []) as MarketListing[];
};

// Translate the legacy `contact_preference` enum into the new
// `contact_methods` array. Always returns at least one method so the
// buyer-side always has at least one channel to pick.
const methodsFromPreference = (
  input: CreateListingInput
): ContactMethod[] => {
  if (Array.isArray(input.contact_methods) && input.contact_methods.length > 0) {
    return input.contact_methods;
  }
  switch (input.contact_preference) {
    case 'phone': return ['phone', 'whatsapp'];
    case 'dm':    return ['in_app'];
    case 'both':
    default:      return ['phone', 'whatsapp', 'in_app'];
  }
};

export const createListing = async (
  sellerId: string,
  input: CreateListingInput
): Promise<MarketListing> => {
  // Build the row, then strip optional/new columns if the DB rejects
  // them with PGRST204 (column not found in schema cache). This lets
  // the app keep working whether or not the v2 migration is applied
  // on this Supabase project yet.
  const baseRow: Record<string, any> = {
    seller_id: sellerId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    category: input.category,
    price: input.price,
    city: input.city?.trim() || null,
    contact_phone: input.contact_phone?.trim() || null,
    images: input.images ?? [],
    // RLS allows seller insert; status defaults to 'pending' so admin
    // can moderate before listings go public.
  };

  // Optional columns introduced by 2026_05_20_market_haraj_v2.sql.
  const optional: Record<string, any> = {
    contact_methods: methodsFromPreference(input),
    device_type: input.device_type ?? null,
    condition: input.condition ?? null,
  };

  const tryInsert = async (row: Record<string, any>) => {
    return supabase.from('market_listings').insert(row).select().single();
  };

  // First attempt: full payload (base + optional).
  let res = await tryInsert({ ...baseRow, ...optional });

  if (res.error) {
    const msg = (res.error.message || '').toLowerCase();
    const code = (res.error as any).code;
    const missingCol =
      code === 'PGRST204' ||
      msg.includes("could not find the") ||
      msg.includes('column') && msg.includes('schema cache');

    if (missingCol) {
      logger.warn(
        'createListing: optional columns missing from schema, falling back to base payload',
        res.error
      );
      // Retry with only the base columns. Loses contact_methods /
      // device_type / condition on this row until the migration is
      // applied, but the listing still gets posted.
      res = await tryInsert(baseRow);
    }
  }

  if (res.error) throw res.error;
  return res.data as MarketListing;
};

export const updateListingStatus = async (
  id: string,
  status: ListingStatus
): Promise<MarketListing> => {
  const { data, error } = await supabase
    .from('market_listings')
    .update({ status })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as MarketListing;
};

// Admin-only: list everything regardless of status. Relies on the
// `market_listings_admin_all` RLS policy.
export const adminListAll = async (): Promise<MarketListing[]> => {
  const { data, error } = await supabase
    .from('market_listings')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    logger.warn('adminListAll failed', error);
    return [];
  }
  return (data ?? []) as MarketListing[];
};

// ---------------------------------------------------------------------
// Direct-message threads between buyer and seller for a given listing.
// Backed by the `market_threads` / `market_messages` tables (see the
// 2026_05_20_phase2_commitment_broadcasts_market migration).

export interface MarketThread {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  last_message_at: string;
  unread_for_buyer: boolean;
  unread_for_seller: boolean;
  created_at: string;
}

export interface MarketMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

/**
 * Opens (or creates) the DM thread for a listing between the current
 * buyer and the seller. Returns the thread.
 */
export const getOrCreateMarketThread = async (
  listingId: string,
  buyerId: string,
  sellerId: string
): Promise<MarketThread> => {
  const { data: existing } = await supabase
    .from('market_threads')
    .select('*')
    .eq('listing_id', listingId)
    .eq('buyer_id', buyerId)
    .maybeSingle();
  if (existing) return existing as MarketThread;

  const { data, error } = await supabase
    .from('market_threads')
    .insert({ listing_id: listingId, buyer_id: buyerId, seller_id: sellerId })
    .select()
    .single();
  if (error) throw error;
  return data as MarketThread;
};

export const listMarketMessages = async (threadId: string): Promise<MarketMessage[]> => {
  const { data, error } = await supabase
    .from('market_messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) {
    logger.warn('listMarketMessages failed', error);
    return [];
  }
  return (data ?? []) as MarketMessage[];
};

export const sendMarketMessage = async (
  threadId: string,
  senderId: string,
  content: string
): Promise<MarketMessage> => {
  const trimmed = content.trim();
  if (!trimmed) throw new Error('Empty message');
  const { data, error } = await supabase
    .from('market_messages')
    .insert({ thread_id: threadId, sender_id: senderId, content: trimmed })
    .select()
    .single();
  if (error) throw error;
  return data as MarketMessage;
};

/**
 * Subscribe to new messages on a market thread. Returns a cleanup
 * function for useEffect cleanup. subscribeUnique avoids the
 * realtime "callbacks after subscribe()" race on re-mount.
 */
export const subscribeMarketMessages = (
  threadId: string,
  onInsert: (m: MarketMessage) => void
): (() => void) =>
  subscribeUnique(`market-thread-${threadId}`, (ch) =>
    ch.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'market_messages', filter: `thread_id=eq.${threadId}` },
      (payload: any) => onInsert(payload.new as MarketMessage)
    )
  );
