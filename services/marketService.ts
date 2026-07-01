import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';
import { subscribeUnique } from '../utils/realtimeChannel';

export type ListingCategory = 'used_device' | 'accessory' | 'spare_part' | 'other';

/**
 * Marketplace listing lifecycle (v3 — see migration
 * 2026_05_27_market_lifecycle_v3.sql).
 *
 *   draft               → seller saved but not submitted
 *   pending             → submitted, awaiting admin moderation
 *   live                → admin-approved, publicly browsable
 *   sold                → owner marked as sold
 *   hidden_by_owner     → owner unlisted; reversible
 *   delete_requested    → owner asked Fixate to remove the listing
 *   rejected            → admin rejected; owner may edit & resubmit
 *   archived_by_admin   → admin archived; client cannot restore
 *
 * Legacy `active` / `archived` values are accepted on read and normalised
 * to `live` / `archived_by_admin` via {@link normalizeStatus}. Old clients
 * may still emit them; the DB CHECK constraint accepts both.
 */
export type ListingStatus =
  | 'draft'
  | 'pending'
  | 'live'
  | 'sold'
  | 'hidden_by_owner'
  | 'delete_requested'
  | 'rejected'
  | 'archived_by_admin';

/** Raw status as it may appear in the DB (incl. legacy values). */
type RawListingStatus = ListingStatus | 'active' | 'archived';

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
  | 'salvage'
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
  { id: 'salvage',    ar: 'تشليح',          en: 'Salvage',          icon: 'tools' },
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
  /** Owner-removed timestamp (legacy column; still set on hide for compat). */
  removed_at?: string | null;
  /** Optional owner-supplied reason. Legacy; superseded by `moderation_reason`. */
  removed_reason?: string | null;
  /** Admin reason attached to reject / archive transitions. */
  moderation_reason?: string | null;
  /** Admin-only internal notes. Not shown to sellers. */
  admin_notes?: string | null;
  /** Set when status enters `hidden_by_owner`. */
  hidden_at?: string | null;
  /** Set when status enters `delete_requested`. */
  delete_requested_at?: string | null;
  /** Set when status enters `archived_by_admin`. */
  archived_at?: string | null;
  /** True when posted by an admin — shows the Fixate Certified badge (FEAT-8). */
  is_official?: boolean | null;
}

/** Normalise legacy DB statuses (`active`, `archived`) to the v3 vocabulary. */
const normalizeStatus = (raw: RawListingStatus | string | null | undefined): ListingStatus => {
  if (raw === 'active') return 'live';
  if (raw === 'archived') return 'archived_by_admin';
  return (raw ?? 'pending') as ListingStatus;
};

const normalizeRow = <T extends { status?: any } | null | undefined>(row: T): T => {
  if (row && typeof row === 'object' && 'status' in row && row.status) {
    (row as any).status = normalizeStatus((row as any).status);
  }
  return row;
};

const normalizeRows = <T extends { status?: any }>(rows: T[]): T[] => {
  for (const r of rows) normalizeRow(r);
  return rows;
};

// ---------------------------------------------------------------------------
// Seller state-machine helpers. The DB RLS WITH CHECK already enforces the
// allowed transitions; these helpers exist so the UI calls intent-named
// functions instead of raw status updates.
// ---------------------------------------------------------------------------

/** Owner hides a listing from public browse. Reversible via `unhideListing`. */
export const hideListing = async (id: string): Promise<MarketListing> => {
  const { data, error } = await supabase
    .from('market_listings')
    .update({
      status: 'hidden_by_owner',
      hidden_at: new Date().toISOString(),
      // Mirror into legacy column for older rows / queries.
      removed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return normalizeRow(data) as MarketListing;
};

/** Owner re-lists a previously hidden listing. Returns to `pending` so admin
 *  re-moderates before it goes public again. */
export const unhideListing = async (id: string): Promise<MarketListing> => {
  const { data, error } = await supabase
    .from('market_listings')
    .update({
      status: 'pending',
      hidden_at: null,
      removed_at: null,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return normalizeRow(data) as MarketListing;
};

/** Owner asks Fixate to permanently remove the listing. Admin reviews. */
export const requestListingDeletion = async (
  id: string,
  reason?: string
): Promise<MarketListing> => {
  const { data, error } = await supabase
    .from('market_listings')
    .update({
      status: 'delete_requested',
      delete_requested_at: new Date().toISOString(),
      removed_reason: reason ?? null,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return normalizeRow(data) as MarketListing;
};

/** Owner marks a `live` listing as sold. */
export const markListingSold = async (id: string): Promise<MarketListing> => {
  const { data, error } = await supabase
    .from('market_listings')
    .update({ status: 'sold' })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return normalizeRow(data) as MarketListing;
};

/**
 * @deprecated Replaced by {@link hideListing} (now correctly maps to
 * `hidden_by_owner` instead of the admin-only `archived_by_admin`). Kept
 * as a thin alias so any in-flight callers keep compiling.
 */
export const removeListingByOwner = hideListing;

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
  /** When true (admin authors), the listing is auto-branded Fixate Certified. */
  official?: boolean;
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
  is_verified: boolean;
}

/** Read a user's public display card (name + avatar + verified flag) via the
 *  `public_user_cards` view, which is readable regardless of the
 *  users-table RLS. */
export const getUserCard = async (userId: string): Promise<UserCard | null> => {
  const { data, error } = await supabase
    .from('public_user_cards')
    .select('id, name, avatar_url, is_verified')
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
  return data ? (normalizeRow(data) as MarketListing) : null;
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

// Grid-only column list — excludes the heavy `description` field so the
// initial browse payload stays small. The full row is fetched lazily by
// market-detail when the buyer opens an individual listing.
const BROWSE_LIST_COLUMNS =
  'id,seller_id,title,category,device_type,condition,price,currency,city,contact_phone,contact_preference,contact_methods,images,status,created_at,updated_at,removed_at,removed_reason,moderation_reason,hidden_at,delete_requested_at,archived_at,is_official';

export const browseListings = async (
  filters: BrowseFilters = {}
): Promise<MarketListing[]> => {
  const page = filters.page ?? 0;
  // Smaller first paint: 20 cards fill the grid 5+ rows on a tall phone,
  // which is plenty for the visible viewport. Callers needing more can
  // ask for additional pages explicitly.
  const pageSize = filters.pageSize ?? 20;
  // Browse the public feed: only admin-approved (`live`) listings show up.
  // We accept the legacy `active` value too so the feed stays populated on
  // databases where the v3 migration hasn't run yet.
  let q = supabase
    .from('market_listings')
    .select(BROWSE_LIST_COLUMNS)
    .in('status', ['live', 'active'])
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
  return normalizeRows((data ?? []) as MarketListing[]);
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
  return normalizeRows((data ?? []) as MarketListing[]);
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
  // FEAT-8 — admin posts are auto-branded "Fixate Certified": a non-editable
  // certified note is appended to the description at save time, and the
  // is_official flag drives the badge in the feed + detail page.
  const CERTIFIED_NOTE_AR = '✅ معتمد من Fixate — جهاز مفحوص وموثّق من فريق Fixate.';
  const CERTIFIED_NOTE_EN = '✅ Fixate Certified — inspected and verified by the Fixate team.';
  const baseDescription = input.description?.trim() || '';
  const finalDescription = input.official
    ? `${baseDescription}${baseDescription ? '\n\n' : ''}${CERTIFIED_NOTE_AR}\n${CERTIFIED_NOTE_EN}`.trim()
    : baseDescription || null;

  const baseRow: Record<string, any> = {
    seller_id: sellerId,
    title: input.title.trim(),
    description: finalDescription,
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
    is_official: input.official ?? false,
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

/**
 * Low-level status update. The DB RLS policies enforce who is allowed to
 * make which transition, so this stays generic. Callers should prefer the
 * intent-named wrappers ({@link hideListing}, {@link markListingSold},
 * {@link adminApprove}, etc.) — this is the escape hatch.
 */
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
  return normalizeRow(data) as MarketListing;
};

// ---------------------------------------------------------------------------
// Admin-only helpers. Each wraps the moderation transition with the right
// timestamp / metadata so the admin queue and audit trail stay clean. The
// `market_listings_admin_all` RLS policy gates all of these server-side.
// ---------------------------------------------------------------------------

/** Admin-only: list everything regardless of status. */
export const adminListAll = async (): Promise<MarketListing[]> => {
  const { data, error } = await supabase
    .from('market_listings')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    logger.warn('adminListAll failed', error);
    return [];
  }
  return normalizeRows((data ?? []) as MarketListing[]);
};

/** Admin-only: approve a pending/rejected/hidden listing → goes live. */
export const adminApprove = async (id: string): Promise<MarketListing> => {
  const { data, error } = await supabase
    .from('market_listings')
    .update({
      status: 'live',
      moderation_reason: null,
      archived_at: null,
      hidden_at: null,
      delete_requested_at: null,
      removed_at: null,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return normalizeRow(data) as MarketListing;
};

/** Admin-only: reject with a reason the seller can see. */
export const adminReject = async (
  id: string,
  reason: string
): Promise<MarketListing> => {
  const { data, error } = await supabase
    .from('market_listings')
    .update({
      status: 'rejected',
      moderation_reason: reason?.trim() || null,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return normalizeRow(data) as MarketListing;
};

/** Admin-only: archive (soft-remove). Seller cannot restore this. */
export const adminArchive = async (
  id: string,
  reason?: string
): Promise<MarketListing> => {
  const { data, error } = await supabase
    .from('market_listings')
    .update({
      status: 'archived_by_admin',
      archived_at: new Date().toISOString(),
      moderation_reason: reason?.trim() || null,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return normalizeRow(data) as MarketListing;
};

/** Admin-only: restore an archived / rejected / hidden listing → pending. */
export const adminRestore = async (id: string): Promise<MarketListing> => {
  const { data, error } = await supabase
    .from('market_listings')
    .update({
      status: 'pending',
      archived_at: null,
      hidden_at: null,
      delete_requested_at: null,
      removed_at: null,
      moderation_reason: null,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return normalizeRow(data) as MarketListing;
};

/** Admin-only: permanent delete. Irreversible — UI must double-confirm. */
export const adminHardDelete = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('market_listings')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

/** Admin-only: set internal notes (not shown to the seller). */
export const adminSetNotes = async (
  id: string,
  notes: string
): Promise<MarketListing> => {
  const { data, error } = await supabase
    .from('market_listings')
    .update({ admin_notes: notes?.trim() || null })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return normalizeRow(data) as MarketListing;
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
  /** Last message snippet kept hot on the thread for inbox rendering. */
  last_message_preview?: string | null;
  /** Per-side "hide from inbox" flag. Reset on next inbound message. */
  archived_for_buyer?: boolean;
  archived_for_seller?: boolean;
  /** Per-side read mark stamped by mark_market_thread_read RPC. */
  last_read_at_buyer?: string | null;
  last_read_at_seller?: string | null;
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
 * Inbox row: a thread joined to the counterparty's public profile card and
 * a slim listing summary. Returned by list_my_market_threads (one round-trip
 * for the whole inbox).
 */
export interface MarketThreadSummary {
  thread_id: string;
  listing_id: string;
  listing_title: string | null;
  listing_price: number | null;
  listing_currency: string | null;
  listing_image: string | null;
  listing_status: string | null;
  counterparty_id: string;
  counterparty_name: string | null;
  counterparty_avatar: string | null;
  my_role: 'buyer' | 'seller';
  last_message_at: string;
  last_message_preview: string | null;
  unread: boolean;
  archived: boolean;
}

/**
 * Opens (or creates) the DM thread for a listing between the current
 * buyer and the seller. Returns the thread.
 *
 * Refuses to create a self-DM at the client layer as well as the DB
 * (the migration adds `CHECK (buyer_id <> seller_id)`); failing fast
 * here gives a friendlier error than a constraint violation.
 */
export const getOrCreateMarketThread = async (
  listingId: string,
  buyerId: string,
  sellerId: string
): Promise<MarketThread> => {
  if (!listingId || !buyerId || !sellerId) {
    throw new Error('listingId, buyerId and sellerId are required');
  }
  if (buyerId === sellerId) {
    throw new Error('You cannot start a chat with yourself');
  }

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

// ---------------------------------------------------------------------
// Inbox-grade APIs (Phase 2 — see 2026_05_31_market_chat_phase2.sql)
// ---------------------------------------------------------------------

/**
 * Lists the current user's market threads in inbox order (most recent
 * activity first). Server-side join gives us counterparty profile +
 * listing summary in one round-trip, avoiding N+1 lookups in the inbox.
 *
 * `before` is the cursor — pass the `last_message_at` of the last row
 * from the previous page for infinite scroll.
 */
export const listMyMarketThreads = async (
  opts?: { limit?: number; before?: string }
): Promise<MarketThreadSummary[]> => {
  const limit = opts?.limit ?? 50;
  const { data, error } = await supabase.rpc('list_my_market_threads', {
    p_limit: limit,
    p_before: opts?.before ?? null,
  });
  if (!error && data && (data as any[]).length > 0) {
    return data as MarketThreadSummary[];
  }
  if (error) logger.warn('listMyMarketThreads RPC failed, falling back to direct query', error);

  // Fallback: query market_threads directly + join listing/counterparty card.
  // Used when the list_my_market_threads RPC is missing in the deployed DB
  // or temporarily returns empty due to a server-side bug. Keeps the inbox
  // visible instead of rendering an empty state forever.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const cursorClause = opts?.before
    ? { col: 'last_message_at', op: 'lt' as const, val: opts.before }
    : null;

  let q = supabase
    .from('market_threads')
    .select('*')
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .order('last_message_at', { ascending: false })
    .limit(limit);
  if (cursorClause) q = q.lt(cursorClause.col, cursorClause.val);

  const { data: threads, error: tErr } = await q;
  if (tErr) {
    logger.warn('listMyMarketThreads fallback failed', tErr);
    return [];
  }
  const list = (threads ?? []) as any[];
  if (list.length === 0) return [];

  const listingIds = Array.from(new Set(list.map((t) => t.listing_id).filter(Boolean)));
  const counterpartyIds = Array.from(
    new Set(
      list
        .map((t) => (t.buyer_id === user.id ? t.seller_id : t.buyer_id))
        .filter(Boolean)
    )
  );

  const [{ data: listings }, { data: cards }] = await Promise.all([
    listingIds.length > 0
      ? supabase
          .from('market_listings')
          .select('id, title, price, currency, images, status')
          .in('id', listingIds)
      : Promise.resolve({ data: [] as any[] }),
    counterpartyIds.length > 0
      ? supabase
          .from('public_user_cards')
          .select('id, name, avatar_url')
          .in('id', counterpartyIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const listingById = new Map((listings ?? []).map((l: any) => [l.id, l]));
  const cardById = new Map((cards ?? []).map((c: any) => [c.id, c]));

  return list.map((t) => {
    const myRole: 'buyer' | 'seller' = t.buyer_id === user.id ? 'buyer' : 'seller';
    const counterpartyId = myRole === 'buyer' ? t.seller_id : t.buyer_id;
    const listing = listingById.get(t.listing_id);
    const card = cardById.get(counterpartyId);
    const unread = myRole === 'buyer' ? !!t.unread_for_buyer : !!t.unread_for_seller;
    const archived = myRole === 'buyer' ? !!t.archived_for_buyer : !!t.archived_for_seller;
    return {
      thread_id: t.id,
      listing_id: t.listing_id,
      listing_title: listing?.title ?? null,
      listing_price: listing?.price ?? null,
      listing_currency: listing?.currency ?? null,
      listing_image: Array.isArray(listing?.images) ? (listing!.images[0] ?? null) : null,
      listing_status: listing?.status ?? null,
      counterparty_id: counterpartyId,
      counterparty_name: card?.name ?? null,
      counterparty_avatar: card?.avatar_url ?? null,
      my_role: myRole,
      last_message_at: t.last_message_at,
      last_message_preview: t.last_message_preview ?? null,
      unread,
      archived,
    } as MarketThreadSummary;
  });
};

/**
 * Marks a thread as read for the current user. Uses an RPC so the
 * client doesn't need to know whether it's the buyer or seller side.
 */
export const markMarketThreadRead = async (threadId: string): Promise<void> => {
  if (!threadId) return;
  const { error } = await supabase.rpc('mark_market_thread_read', {
    p_thread_id: threadId,
  });
  if (error) logger.warn('markMarketThreadRead failed', error);
};

/** Hide/unhide a thread from the caller's inbox (per-side soft archive). */
export const setMarketThreadArchived = async (
  threadId: string,
  archived: boolean
): Promise<void> => {
  if (!threadId) return;
  const { error } = await supabase.rpc('set_market_thread_archived', {
    p_thread_id: threadId,
    p_archived: archived,
  });
  if (error) throw error;
};

/**
 * Subscribe to inbox activity for the current user. Fires on every
 * INSERT/UPDATE on `market_threads` where the user participates; the
 * caller refetches (cheap — RPC returns ≤100 rows) and we keep the
 * subscription dumb on purpose.
 */
export const subscribeMyMarketThreads = (
  userId: string,
  onChange: () => void
): (() => void) => {
  if (!userId) return () => undefined;
  const channelKey = `market-inbox-${userId}`;
  return subscribeUnique(channelKey, (ch) =>
    ch
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'market_threads', filter: `buyer_id=eq.${userId}` },
        () => onChange()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'market_threads', filter: `seller_id=eq.${userId}` },
        () => onChange()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'market_threads', filter: `seller_id=eq.${userId}` },
        () => onChange()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'market_threads', filter: `buyer_id=eq.${userId}` },
        () => onChange()
      )
  );
};
