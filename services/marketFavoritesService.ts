/**
 * marketFavoritesService.ts
 *
 * Per-user market favorites. Row Level Security in the database guarantees
 * a user can only ever see or mutate their own rows, so the service stays
 * thin — no client-side ownership checks needed.
 */
import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

/** All listing ids the current authenticated user has favorited. */
export const listMyFavoriteIds = async (userId: string): Promise<string[]> => {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('market_favorites')
    .select('listing_id')
    .eq('user_id', userId);
  if (error) {
    logger.warn('listMyFavoriteIds failed', error);
    return [];
  }
  return (data ?? []).map((r: any) => r.listing_id as string);
};

export const addFavorite = async (userId: string, listingId: string): Promise<void> => {
  if (!userId || !listingId) return;
  // Composite PK is (user_id, listing_id) so duplicate inserts are no-ops.
  const { error } = await supabase
    .from('market_favorites')
    .upsert(
      { user_id: userId, listing_id: listingId },
      { onConflict: 'user_id,listing_id', ignoreDuplicates: true },
    );
  if (error) {
    logger.warn('addFavorite failed', error);
    throw error;
  }
};

export const removeFavorite = async (userId: string, listingId: string): Promise<void> => {
  if (!userId || !listingId) return;
  const { error } = await supabase
    .from('market_favorites')
    .delete()
    .eq('user_id', userId)
    .eq('listing_id', listingId);
  if (error) {
    logger.warn('removeFavorite failed', error);
    throw error;
  }
};
