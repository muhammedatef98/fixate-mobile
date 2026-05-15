import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

export type ListingCategory = 'used_device' | 'accessory' | 'spare_part' | 'other';
export type ListingStatus = 'pending' | 'active' | 'sold' | 'rejected' | 'archived';

export interface MarketListing {
  id: string;
  seller_id: string;
  title: string;
  description?: string | null;
  category: ListingCategory;
  price: number;
  currency: string;
  city?: string | null;
  contact_phone?: string | null;
  images: string[];
  status: ListingStatus;
  created_at?: string;
  updated_at?: string;
}

export interface CreateListingInput {
  title: string;
  description?: string;
  category: ListingCategory;
  price: number;
  city?: string;
  contact_phone?: string;
  images?: string[];
}

export const browseListings = async (
  filters?: { category?: ListingCategory; city?: string }
): Promise<MarketListing[]> => {
  let q = supabase
    .from('market_listings')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(100);
  if (filters?.category) q = q.eq('category', filters.category);
  if (filters?.city) q = q.eq('city', filters.city);
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
