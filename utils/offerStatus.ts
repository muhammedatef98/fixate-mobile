/**
 * offerStatus.ts — pure helpers for marketplace offer states.
 *
 * Since offer resubmission after rejection (migration 20260708180000), a
 * technician can have MULTIPLE historical offer rows on one order (rejected /
 * withdrawn history + at most one live pending row, enforced by a partial
 * unique index). These helpers are the single source of truth for:
 *   • which row is "the" offer to show (latest relevant)
 *   • whether the technician may submit again
 *   • the four clearly distinct end-states:
 *       pending  → awaiting the customer's decision
 *       rejected → the CUSTOMER declined this offer (resubmission allowed)
 *       expired  → the order closed because another offer won (no resubmit)
 *       accepted → this offer won
 * Framework-free and unit-tested; screens must not hand-roll this mapping.
 */

export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'withdrawn';

interface OfferLike {
  technician_id: string;
  status: OfferStatus | string;
  created_at: string;
}

const statusRank: Record<string, number> = {
  pending: 0,
  accepted: 1,
  // Decided/inactive states rank equally — recency decides between them.
  rejected: 2,
  withdrawn: 2,
  expired: 2,
};

/**
 * The one row that represents a technician's current position on an order:
 * a live pending offer wins, then an accepted one, otherwise the most recent
 * historical row (so a fresh rejection isn't hidden by an older withdrawal).
 */
export const latestRelevantOffer = <T extends OfferLike>(offers: T[]): T | null => {
  if (offers.length === 0) return null;
  return [...offers].sort((a, b) => {
    const ra = statusRank[a.status] ?? 3;
    const rb = statusRank[b.status] ?? 3;
    if (ra !== rb) return ra - rb;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  })[0];
};

/**
 * Customer-facing list: one entry per technician (their latest relevant
 * offer), live offers first, then by recency — historical rejected rows never
 * duplicate a technician who has since re-offered.
 */
export const dedupeOffersByTechnician = <T extends OfferLike>(offers: T[]): T[] => {
  const byTech = new Map<string, T[]>();
  for (const o of offers) {
    const list = byTech.get(o.technician_id) ?? [];
    list.push(o);
    byTech.set(o.technician_id, list);
  }
  const picked = [...byTech.values()]
    .map((list) => latestRelevantOffer(list))
    .filter((o): o is T => o !== null);
  return picked.sort((a, b) => {
    const ra = statusRank[a.status] ?? 3;
    const rb = statusRank[b.status] ?? 3;
    if (ra !== rb) return ra - rb;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
};

/**
 * May the technician submit (another) offer right now? Server-side truth is
 * the order-open check inside submit_order_offer; this mirrors it for the UI:
 * the order must still be open, and there must be no live/winning offer.
 * A rejected or withdrawn offer never blocks a new one.
 */
export const canSubmitNewOffer = (
  orderIsOpen: boolean,
  currentStatus: OfferStatus | null
): boolean => {
  if (!orderIsOpen) return false;
  return currentStatus !== 'pending' && currentStatus !== 'accepted';
};

/** Technician-facing meta for the current offer state. */
export const technicianOfferStateMeta = (
  status: OfferStatus
): { ar: string; en: string; tone: 'pending' | 'success' | 'danger' | 'muted'; canResubmit: boolean } => {
  switch (status) {
    case 'pending':
      return {
        ar: 'عرضك قيد المراجعة — بانتظار قرار العميل',
        en: 'Your offer is with the customer — awaiting their decision',
        tone: 'pending',
        canResubmit: false,
      };
    case 'accepted':
      return {
        ar: 'قبل العميل عرضك 🎉',
        en: 'The customer accepted your offer 🎉',
        tone: 'success',
        canResubmit: false,
      };
    case 'rejected':
      return {
        ar: 'رفض العميل هذا العرض — يمكنك تقديم عرض جديد بسعر مختلف',
        en: 'The customer declined this offer — you can send a new one at a different price',
        tone: 'danger',
        canResubmit: true,
      };
    case 'withdrawn':
      return {
        ar: 'سحبت هذا العرض — يمكنك تقديم عرض جديد',
        en: 'You withdrew this offer — you can submit a new one',
        tone: 'muted',
        canResubmit: true,
      };
    case 'expired':
      return {
        ar: 'أُغلق الطلب — اختار العميل عرض فني آخر',
        en: 'The request closed — the customer chose another technician’s offer',
        tone: 'muted',
        canResubmit: false,
      };
  }
};

/**
 * The customer's starting estimate as shown to the TECHNICIAN: explicitly an
 * estimate (never a committed price), with a clean inspection-needed fallback
 * for zero/absent values.
 */
export const customerEstimateDisplay = (
  estimatedPrice: number | null | undefined,
  isRTL: boolean
): { label: string; value: string; isEstimate: boolean } => {
  const label = isRTL ? 'التقدير المبدئي للعميل' : "Customer's initial estimate";
  const n = Number(estimatedPrice ?? 0);
  if (!Number.isFinite(n) || n <= 0) {
    return {
      label,
      value: isRTL ? 'يُحدد بعد الفحص' : 'Determined on inspection',
      isEstimate: false,
    };
  }
  return {
    label,
    value: isRTL ? `≈ ${n} ر.س` : `≈ ${n} SAR`,
    isEstimate: true,
  };
};

/**
 * How many LIVE (pending) offers arrived after the customer last opened the
 * offers screen for this order. Drives the "new offers" signal — it hides at
 * zero and clears once the screen is viewed (lastSeen advances).
 */
export const countNewPendingOffers = (
  offers: { status: OfferStatus | string; created_at: string }[],
  lastSeenIso: string | null
): number => {
  const lastSeen = lastSeenIso ? new Date(lastSeenIso).getTime() : 0;
  return offers.filter(
    (o) => o.status === 'pending' && new Date(o.created_at).getTime() > lastSeen
  ).length;
};
