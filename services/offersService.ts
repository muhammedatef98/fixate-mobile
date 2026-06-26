import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';
import { notifySegment, type PushAudience } from './notifyService';

export interface Offer {
  id: string;
  title: string;
  description: string | null;
  discount_pct: number | null;
  image_url: string | null;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type OfferInput = {
  title: string;
  description?: string | null;
  discount_pct?: number | null;
  image_url?: string | null;
  valid_from?: string | null;
  valid_until?: string | null;
  is_active?: boolean;
};

const COLUMNS =
  'id, title, description, discount_pct, image_url, valid_from, valid_until, is_active, created_at, updated_at';

/** Active + currently-valid offers for the customer offers screen (RLS-gated). */
export const listActiveOffers = async (): Promise<Offer[]> => {
  const { data, error } = await supabase
    .from('offers')
    .select(COLUMNS)
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (error) {
    logger.warn('listActiveOffers failed', error);
    throw error;
  }
  // Belt-and-braces validity filter (RLS already enforces it server-side).
  const now = Date.now();
  return (data ?? []).filter((o: Offer) => {
    const from = o.valid_from ? new Date(o.valid_from).getTime() : -Infinity;
    const until = o.valid_until ? new Date(o.valid_until).getTime() : Infinity;
    return from <= now && until >= now;
  });
};

/** All offers, newest first — admin management view. */
export const adminListOffers = async (): Promise<Offer[]> => {
  const { data, error } = await supabase
    .from('offers')
    .select(COLUMNS)
    .order('created_at', { ascending: false });
  if (error) {
    logger.warn('adminListOffers failed', error);
    throw error;
  }
  return (data ?? []) as Offer[];
};

export const createOffer = async (input: OfferInput): Promise<Offer> => {
  const { data, error } = await supabase
    .from('offers')
    .insert({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      discount_pct: input.discount_pct ?? null,
      image_url: input.image_url ?? null,
      valid_from: input.valid_from ?? new Date().toISOString(),
      valid_until: input.valid_until ?? null,
      is_active: input.is_active ?? true,
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data as Offer;
};

export const updateOffer = async (id: string, input: OfferInput): Promise<Offer> => {
  const { data, error } = await supabase
    .from('offers')
    .update({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      discount_pct: input.discount_pct ?? null,
      image_url: input.image_url ?? undefined,
      valid_from: input.valid_from ?? undefined,
      valid_until: input.valid_until ?? null,
      is_active: input.is_active ?? undefined,
    })
    .eq('id', id)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data as Offer;
};

export const setOfferActive = async (id: string, isActive: boolean): Promise<void> => {
  const { error } = await supabase.from('offers').update({ is_active: isActive }).eq('id', id);
  if (error) throw error;
};

export const deleteOffer = async (id: string): Promise<void> => {
  const { error } = await supabase.from('offers').delete().eq('id', id);
  if (error) throw error;
};

/**
 * Notify an audience about an offer (§2). Routes through notify-segment so it
 * appears in the bell, respects the "promotions" opt-out, and pushes. Used by
 * the auto-notify toggle on save and the manual "Send notification" action.
 */
export const notifyOffer = async (
  offer: Offer,
  audience: PushAudience
): Promise<{ sent: number; failed: number; inApp?: number; recipients?: number }> => {
  const body =
    offer.description?.trim() ||
    (offer.discount_pct
      ? `خصم ${offer.discount_pct}% — Save ${offer.discount_pct}%`
      : offer.title);
  return notifySegment(audience, {
    category: 'promo',
    title: offer.title,
    body,
    data: { type: 'offer', offerId: offer.id, screen: 'offers' },
  });
};
