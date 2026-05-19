import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

export type WalletEntryKind =
  | 'job_earning'
  | 'inspection_fee'
  | 'platform_commission'
  | 'withdrawal'
  | 'adjustment';

export interface WalletEntry {
  id: string;
  technician_id: string;
  order_id?: string | null;
  amount: number; // signed; credits positive, debits negative
  kind: WalletEntryKind;
  description?: string | null;
  created_at: string;
}

export interface WithdrawalRequest {
  id: string;
  technician_id: string;
  amount: number;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  method?: string | null;
  destination?: string | null;
  notes?: string | null;
  created_at: string;
}

// Reads the wallet balance from the DB view. Falls back to summing all
// entries client-side when the view isn't available (pre-migration). And
// falls back to estimating from completed orders when even the entries
// table isn't ready, so the screen always shows *something* useful.
export const getWalletBalance = async (
  technicianId: string
): Promise<{ balance: number; pendingBackend: boolean }> => {
  if (!technicianId) return { balance: 0, pendingBackend: true };
  try {
    const { data, error } = await supabase
      .from('technician_wallet_balance')
      .select('balance')
      .eq('technician_id', technicianId)
      .maybeSingle();
    if (!error && data) return { balance: Number(data.balance || 0), pendingBackend: false };
  } catch (e) {
    logger.warn('wallet balance view unavailable', e);
  }
  // Fall back to summing entries directly.
  try {
    const { data, error } = await supabase
      .from('technician_wallet_entries')
      .select('amount')
      .eq('technician_id', technicianId);
    if (!error && data) {
      const balance = (data as any[]).reduce((s, r) => s + Number(r.amount || 0), 0);
      return { balance, pendingBackend: false };
    }
  } catch (e) {
    logger.warn('wallet entries table unavailable', e);
  }
  // Last resort: estimate from completed jobs (UI fallback only).
  try {
    const { data } = await supabase
      .from('orders')
      .select('estimated_price, final_price, status')
      .eq('technician_id', technicianId)
      .eq('status', 'completed');
    const rows = data ?? [];
    const balance = rows.reduce(
      (s: number, r: any) => s + Number((r.final_price ?? r.estimated_price) || 0),
      0
    );
    return { balance, pendingBackend: true };
  } catch {
    return { balance: 0, pendingBackend: true };
  }
};

export const listWalletEntries = async (
  technicianId: string,
  limit = 50
): Promise<WalletEntry[]> => {
  try {
    const { data, error } = await supabase
      .from('technician_wallet_entries')
      .select('*')
      .eq('technician_id', technicianId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as WalletEntry[];
  } catch (e) {
    logger.warn('listWalletEntries failed', e);
    return [];
  }
};

export const requestWithdrawal = async (
  technicianId: string,
  amount: number,
  method?: string,
  destination?: string,
  notes?: string
): Promise<WithdrawalRequest | { pendingBackend: true }> => {
  try {
    const { data, error } = await supabase
      .from('technician_withdrawals')
      .insert({
        technician_id: technicianId,
        amount,
        method,
        destination,
        notes,
      })
      .select()
      .single();
    if (error) {
      logger.warn('requestWithdrawal failed (backend pending)', error);
      return { pendingBackend: true };
    }
    return data as WithdrawalRequest;
  } catch (e) {
    logger.warn('requestWithdrawal error', e);
    return { pendingBackend: true };
  }
};

export const listWithdrawals = async (technicianId: string): Promise<WithdrawalRequest[]> => {
  try {
    const { data, error } = await supabase
      .from('technician_withdrawals')
      .select('*')
      .eq('technician_id', technicianId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error || !data) return [];
    return data as WithdrawalRequest[];
  } catch {
    return [];
  }
};
