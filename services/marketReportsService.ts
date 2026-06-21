import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

/**
 * Market listing reports. Buyers/visitors flag a listing with one of a fixed
 * set of reasons plus optional details. The row lands in `market_reports`
 * (RLS gates insert to the reporter, read/update to admins) and surfaces in
 * the admin marketplace "بلاغات الإعلانات" tab.
 */

export interface MarketReport {
  id: string;
  listing_id: string;
  reporter_id: string;
  reason: string;
  details: string | null;
  status: 'pending' | 'reviewed' | 'dismissed';
  created_at: string;
}

/** A report enriched with the listing title + reporter name for the admin list. */
export interface MarketReportRow extends MarketReport {
  listing_title: string | null;
  reporter_name: string | null;
}

export interface SubmitMarketReportPayload {
  listing_id: string;
  reason: string;
  details?: string;
}

/** Insert a report for the current user. Throws so the caller can surface it. */
export async function submitMarketReport(
  payload: SubmitMarketReportPayload
): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const reporterId = auth.user?.id;
  if (!reporterId) throw new Error('تسجيل الدخول مطلوب');

  const { error } = await supabase.from('market_reports').insert({
    listing_id: payload.listing_id,
    reporter_id: reporterId,
    reason: payload.reason,
    details: payload.details?.trim() || null,
  });
  if (error) {
    logger.warn('submitMarketReport failed', error);
    throw error;
  }
}

/** All reports for the admin queue, enriched with listing title + reporter name. */
export async function adminListMarketReports(): Promise<MarketReportRow[]> {
  const { data, error } = await supabase
    .from('market_reports')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    logger.warn('adminListMarketReports failed', error);
    throw error;
  }
  const reports = (data ?? []) as MarketReport[];
  if (reports.length === 0) return [];

  const listingIds = Array.from(new Set(reports.map((r) => r.listing_id)));
  const reporterIds = Array.from(new Set(reports.map((r) => r.reporter_id)));

  const [listingsRes, cardsRes] = await Promise.all([
    supabase.from('market_listings').select('id, title').in('id', listingIds),
    supabase.from('public_user_cards').select('id, name').in('id', reporterIds),
  ]);

  const titleMap = new Map<string, string>();
  (listingsRes.data ?? []).forEach((l: any) => titleMap.set(l.id, l.title));
  const nameMap = new Map<string, string>();
  (cardsRes.data ?? []).forEach((c: any) => nameMap.set(c.id, c.name));

  return reports.map((r) => ({
    ...r,
    listing_title: titleMap.get(r.listing_id) ?? null,
    reporter_name: nameMap.get(r.reporter_id) ?? null,
  }));
}

/** Update a report's status (admin moderation). */
export async function setMarketReportStatus(
  reportId: string,
  status: 'reviewed' | 'dismissed'
): Promise<void> {
  const { error } = await supabase
    .from('market_reports')
    .update({ status })
    .eq('id', reportId);
  if (error) {
    logger.warn('setMarketReportStatus failed', error);
    throw error;
  }
}
