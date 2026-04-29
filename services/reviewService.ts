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
