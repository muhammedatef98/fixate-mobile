/**
 * offersSeen.ts — remembers when the customer last opened the offers screen
 * for each order, so the "new offers" signal is meaningful: it counts only
 * pending offers that arrived AFTER the last visit and clears once the screen
 * is viewed again.
 *
 * AsyncStorage-backed (`@fixate/*` key convention, non-sensitive). Device-
 * local by design — "seen" is a per-device reading state, not server data.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './logger';

const key = (orderId: string) => `@fixate/offers-seen/${orderId}`;

/** ISO timestamp of the last offers-screen visit for this order, or null. */
export async function getOffersLastSeen(orderId: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key(orderId));
  } catch (e) {
    logger.warn('[offersSeen] read failed', e);
    return null;
  }
}

/** Batch read for the orders list (one storage round-trip). */
export async function getOffersLastSeenMap(
  orderIds: string[]
): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  if (orderIds.length === 0) return out;
  try {
    const pairs = await AsyncStorage.multiGet(orderIds.map(key));
    orderIds.forEach((id, i) => {
      out[id] = pairs[i]?.[1] ?? null;
    });
  } catch (e) {
    logger.warn('[offersSeen] batch read failed', e);
    for (const id of orderIds) out[id] = null;
  }
  return out;
}

/** Mark the offers screen as viewed now (clears the "new" signal). */
export async function markOffersSeen(orderId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key(orderId), new Date().toISOString());
  } catch (e) {
    logger.warn('[offersSeen] write failed', e);
  }
}
