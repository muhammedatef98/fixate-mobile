import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

export type ListingCategory = 'used_device' | 'accessory' | 'spare_part' | 'other';
export type ListingStatus = 'pending' | 'active' | 'sold' | 'rejected' | 'archived';
export type ContactPreference = 'dm' | 'phone' | 'both';
export type ContactMethod = 'whatsapp' | 'phone' | 'in_app';
export type DeviceType = 'phone' | 'laptop' | 'tablet' | 'watch' | 'accessory' | 'other';
export type ListingCondition = 'new' | 'like_new' | 'used' | 'refurbished' | 'for_parts';

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
}

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
  contact_preference?: ContactPreference;
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

export const createListing = async (
  sellerId: string,
  input: CreateListingInput
): Promise<MarketListing> => {
  const { data, error } = await supabase
    .from('market_listings')
    .insert({
      seller_id: sellerId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      category: input.category,
      price: input.price,
      city: input.city?.trim() || null,
      contact_phone: input.contact_phone?.trim() || null,
      contact_preference: input.contact_preference ?? 'both',
      images: input.images ?? [],
      // RLS allows seller insert; status defaults to 'pending' so admin can
      // moderate the first wave of listings before they go public.
    })
    .select()
    .single();
  if (error) throw error;
  return data as MarketListing;
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

export const subscribeMarketMessages = (
  threadId: string,
  onInsert: (m: MarketMessage) => void
) =>
  supabase
    .channel(`market-thread-${threadId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'market_messages', filter: `thread_id=eq.${threadId}` },
      (payload) => onInsert(payload.new as MarketMessage)
    )
    .subscribe();
