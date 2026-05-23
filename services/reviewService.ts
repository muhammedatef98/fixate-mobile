import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

export interface Review {
  id: string;
  order_id: string;
  user_id: string;
  technician_id: string | null;
  rating: number;
  comment?: string;
  created_at?: string;
}

export const submitReview = async (
  orderId: string,
  userId: string,
  technicianId: string | null,
  rating: number,
  comment?: string
): Promise<Review> => {
  if (rating < 1 || rating > 5) throw new Error('Rating must be 1-5');
  const { data, error } = await supabase
    .from('reviews')
    .insert({ order_id: orderId, user_id: userId, technician_id: technicianId, rating, comment: comment?.trim() || null })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getReviewByOrder = async (orderId: string, userId: string): Promise<Review | null> => {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('order_id', orderId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    logger.error('getReviewByOrder', error);
    return null;
  }
  return data;
};

export interface TechnicianRatingSummary {
  technician_id: string;
  average_rating: number;
  rating_count: number;
  last_rated_at?: string | null;
}

/** Aggregate average + count for a technician. Reads from the
 *  `technician_rating_summary` view; cheap and safe to call from a profile. */
export const getTechnicianRating = async (
  technicianId: string
): Promise<TechnicianRatingSummary | null> => {
  const { data, error } = await supabase
    .from('technician_rating_summary')
    .select('*')
    .eq('technician_id', technicianId)
    .maybeSingle();
  if (error) {
    logger.warn('getTechnicianRating', error);
    return null;
  }
  return data as TechnicianRatingSummary | null;
};

export interface TechnicianReview extends Review {
  customer_name?: string | null;
}

/** Recent reviews for a technician — used on the technician public profile. */
export const listTechnicianReviews = async (
  technicianId: string,
  limit = 20
): Promise<TechnicianReview[]> => {
  const { data, error } = await supabase
    .from('reviews')
    .select('id, order_id, user_id, technician_id, rating, comment, created_at')
    .eq('technician_id', technicianId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    logger.warn('listTechnicianReviews', error);
    return [];
  }
  return (data ?? []) as TechnicianReview[];
};

/** Admin-only feed; reads from `admin_ratings_feed` which respects RLS. */
export const adminListRatings = async (limit = 200) => {
  const { data, error } = await supabase
    .from('admin_ratings_feed')
    .select('*')
    .limit(limit);
  if (error) throw error;
  return data ?? [];
};
