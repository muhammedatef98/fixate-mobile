/**
 * offerMarketplaceService.ts — reverse-marketplace technician quotes.
 *
 * NOT the promo "offers" feature (services/offersService.ts / admin-offers).
 * This module is the client for the `order_offers` table + RPCs introduced in
 * migration 20260704150000: a customer's repair request stays open
 * (orders.status = 'pending', technician_id IS NULL) while nearby technicians
 * submit quotes; the customer accepts exactly one and the winner is assigned
 * atomically server-side (accept_order_offer locks the order row, expires the
 * losing offers, and spawns the pickup delivery task for pickup orders).
 */
import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';
import { subscribeUnique } from '../utils/realtimeChannel';
import { notifyUsers } from './notifyService';
import { validatePrice } from '../utils/validation';
import { latestRelevantOffer, dedupeOffersByTechnician } from '../utils/offerStatus';

export type OrderOfferStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'withdrawn';

export interface OrderOffer {
  id: string;
  order_id: string;
  technician_id: string;
  amount: number;
  note: string | null;
  status: OrderOfferStatus;
  created_at: string;
  updated_at: string;
  decided_at: string | null;
  // Joined technician display info (customer view).
  technician?: {
    name: string | null;
    avatar_url: string | null;
  } | null;
  technician_rating?: number | null;
  technician_total_jobs?: number | null;
}

export const OFFER_STATUS_LABELS: Record<OrderOfferStatus, { ar: string; en: string }> = {
  pending: { ar: 'بانتظار قرارك', en: 'Awaiting your decision' },
  accepted: { ar: 'مقبول', en: 'Accepted' },
  // Distinct from 'expired': the customer explicitly declined THIS offer;
  // the technician may still send a revised one while the order is open.
  rejected: { ar: 'رفضته — قد يصلك عرض جديد منه', en: 'You declined it — they may re-offer' },
  expired: { ar: 'انتهى — تم اختيار فني آخر', en: 'Closed — another offer was chosen' },
  withdrawn: { ar: 'مسحوب من الفني', en: 'Withdrawn by technician' },
};

/**
 * Technician submits (or revises) a quote on an open request.
 * Server enforces: approved+active technician, order still open.
 */
export const submitOffer = async (
  orderId: string,
  amount: number,
  note?: string
): Promise<OrderOffer> => {
  const priceCheck = validatePrice(amount);
  if (!priceCheck.valid) throw new Error(priceCheck.message);

  const { data, error } = await supabase.rpc('submit_order_offer', {
    p_order_id: orderId,
    p_amount: amount,
    p_note: note ?? null,
  });
  if (error) {
    logger.warn('submitOffer failed', error);
    throw error;
  }
  const offer = data as OrderOffer;

  // Best-effort push to the customer — never blocks the offer itself.
  try {
    const { data: order } = await supabase
      .from('orders')
      .select('user_id, device_brand, device_model')
      .eq('id', orderId)
      .maybeSingle();
    if (order?.user_id) {
      void notifyUsers(order.user_id, {
        title: 'وصلك عرض جديد 💰',
        body: `عرض بقيمة ${Math.round(amount)} ر.س على طلب ${order.device_brand ?? ''} ${order.device_model ?? ''}`.trim(),
        data: { screen: 'order-offers', orderId },
      });
    }
  } catch (e) {
    logger.warn('offer push failed', e);
  }
  return offer;
};

/** Customer: all offers on one of their orders, newest first, with tech info. */
export const getOffersForOrder = async (orderId: string): Promise<OrderOffer[]> => {
  const { data, error } = await supabase
    .from('order_offers')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });
  if (error) {
    logger.warn('getOffersForOrder failed', error);
    return [];
  }
  // Resubmission after rejection means a technician can have several
  // historical rows here — the customer sees one entry per technician
  // (their latest relevant offer), live offers first.
  const offers = dedupeOffersByTechnician((data ?? []) as OrderOffer[]);

  // Enrich with the technician's public display card + stats. The users table
  // is RLS-locked to own-row reads, so names come from the public_user_cards
  // view (the app-wide pattern for cross-user display info). Best-effort.
  try {
    const techIds = [...new Set(offers.map((o) => o.technician_id))];
    if (techIds.length > 0) {
      const [{ data: cards }, { data: techs }] = await Promise.all([
        supabase.from('public_user_cards').select('id, name, avatar_url').in('id', techIds),
        supabase.from('technicians').select('user_id, rating, total_jobs').in('user_id', techIds),
      ]);
      const cardById = new Map((cards ?? []).map((c: any) => [c.id, c]));
      const techById = new Map((techs ?? []).map((t: any) => [t.user_id, t]));
      for (const o of offers) {
        const card = cardById.get(o.technician_id);
        const t = techById.get(o.technician_id);
        o.technician = card
          ? { name: card.name ?? null, avatar_url: card.avatar_url ?? null }
          : null;
        o.technician_rating = t?.rating ?? null;
        o.technician_total_jobs = t?.total_jobs ?? null;
      }
    }
  } catch (e) {
    logger.warn('offer tech enrichment failed', e);
  }
  return offers;
};

/** Count of live offers, for badges on the customer's order card. */
export const getPendingOfferCount = async (orderId: string): Promise<number> => {
  const { count, error } = await supabase
    .from('order_offers')
    .select('*', { count: 'exact', head: true })
    .eq('order_id', orderId)
    .eq('status', 'pending');
  if (error) {
    logger.warn('getPendingOfferCount failed', error);
    return 0;
  }
  return count ?? 0;
};

/**
 * Technician: my current position on a specific order (or null). With
 * resubmission there can be several historical rows — the live pending offer
 * wins, otherwise the most recent decided one (so a fresh rejection shows).
 */
export const getMyOfferForOrder = async (
  technicianId: string,
  orderId: string
): Promise<OrderOffer | null> => {
  const { data, error } = await supabase
    .from('order_offers')
    .select('*')
    .eq('order_id', orderId)
    .eq('technician_id', technicianId)
    .order('created_at', { ascending: false });
  if (error) {
    logger.warn('getMyOfferForOrder failed', error);
    return null;
  }
  return latestRelevantOffer((data ?? []) as OrderOffer[]);
};

/** Technician: all my offers (for the "my offers" awareness on lists). */
export const getMyOffers = async (technicianId: string): Promise<OrderOffer[]> => {
  const { data, error } = await supabase
    .from('order_offers')
    .select('*')
    .eq('technician_id', technicianId)
    .order('created_at', { ascending: false });
  if (error) {
    logger.warn('getMyOffers failed', error);
    return [];
  }
  return data ?? [];
};

/**
 * Customer accepts one offer. Atomic server-side: assigns the technician,
 * moves the order to 'accepted', expires competing offers, creates the pickup
 * delivery task for pickup orders. Returns the order id.
 */
export const acceptOffer = async (offer: OrderOffer): Promise<string> => {
  const { data, error } = await supabase.rpc('accept_order_offer', {
    p_offer_id: offer.id,
  });
  if (error) {
    logger.warn('acceptOffer failed', error);
    throw error;
  }
  const orderId = data as string;

  // Notify winner + losers (best-effort).
  try {
    void notifyUsers(offer.technician_id, {
      title: 'تم قبول عرضك ✅',
      body: 'وافق العميل على عرضك وهو الآن يؤكد الدفع. ستصلك رسالة عند التأكيد.',
      data: { screen: 'order-details', orderId },
    });
    const { data: losers } = await supabase
      .from('order_offers')
      .select('technician_id')
      .eq('order_id', orderId)
      .eq('status', 'expired');
    const loserIds = (losers ?? [])
      .map((l: any) => l.technician_id)
      .filter((id: string) => id !== offer.technician_id);
    if (loserIds.length > 0) {
      void notifyUsers(loserIds, {
        title: 'انتهى الطلب',
        body: 'اختار العميل عرضاً آخر لهذا الطلب. شكراً لمشاركتك.',
        data: { screen: 'available-orders' },
      });
    }
  } catch (e) {
    logger.warn('accept-offer pushes failed', e);
  }
  return orderId;
};

/** Customer declines a specific offer (the request stays open for others). */
export const rejectOffer = async (offer: OrderOffer): Promise<void> => {
  const { error } = await supabase.rpc('reject_order_offer', {
    p_offer_id: offer.id,
  });
  if (error) {
    logger.warn('rejectOffer failed', error);
    throw error;
  }
  void notifyUsers(offer.technician_id, {
    title: 'تم رفض عرضك',
    body: 'رفض العميل عرضك على هذا الطلب. يمكنك تقديم عرض محدّث إن رغبت.',
    data: { screen: 'available-orders' },
  });
};

/** Technician withdraws their own pending offer. */
export const withdrawOffer = async (offerId: string): Promise<void> => {
  const { error } = await supabase.rpc('withdraw_order_offer', {
    p_offer_id: offerId,
  });
  if (error) {
    logger.warn('withdrawOffer failed', error);
    throw error;
  }
};

/** Realtime: offer changes on one order (customer's offers screen). */
export const subscribeToOrderOffers = (
  orderId: string,
  onChange: () => void
): (() => void) =>
  subscribeUnique(`order-offers-${orderId}`, (ch) =>
    ch.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'order_offers',
        filter: `order_id=eq.${orderId}`,
      },
      () => onChange()
    )
  );
