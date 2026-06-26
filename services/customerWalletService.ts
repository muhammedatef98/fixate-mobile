import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

/**
 * Customer wallet (§15) — balance + ledger. Distinct from the technician
 * earnings wallet in walletService.ts. Mutations go through the
 * `wallet_add_transaction` RPC so the balance always matches the ledger.
 */
export type WalletTxnType = 'credit' | 'debit';

export interface CustomerWalletTransaction {
  id: string;
  wallet_id: string;
  type: WalletTxnType;
  amount: number;
  description: string | null;
  order_id: string | null;
  created_at: string;
}

/** Current balance for a user. Returns 0 when no wallet exists yet. */
export const getWalletBalance = async (userId: string): Promise<number> => {
  if (!userId) return 0;
  try {
    const { data, error } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return Number(data?.balance ?? 0);
  } catch (e) {
    logger.warn('getWalletBalance failed', e);
    return 0;
  }
};

export const listWalletTransactions = async (
  userId: string,
  limit = 100
): Promise<CustomerWalletTransaction[]> => {
  if (!userId) return [];
  try {
    // RLS scopes wallet_transactions to the caller's own wallet, so we can
    // select directly and order by recency.
    const { data: wallet } = await supabase
      .from('wallets')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    if (!wallet?.id) return [];
    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('wallet_id', wallet.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as CustomerWalletTransaction[];
  } catch (e) {
    logger.warn('listWalletTransactions failed', e);
    return [];
  }
};

/**
 * Apply a credit/debit to the *current user's* wallet (the RPC uses auth.uid()).
 * Returns the new balance. Throws on insufficient balance for debits.
 */
export const addWalletTransaction = async (
  type: WalletTxnType,
  amount: number,
  description?: string,
  orderId?: string
): Promise<number> => {
  const { data, error } = await supabase.rpc('wallet_add_transaction', {
    p_type: type,
    p_amount: amount,
    p_description: description ?? null,
    p_order_id: orderId ?? null,
  });
  if (error) throw error;
  return Number(data ?? 0);
};

/** Convenience: credit the wallet (e.g. a promo/discount monetary credit). */
export const creditWallet = (amount: number, description?: string, orderId?: string) =>
  addWalletTransaction('credit', amount, description, orderId);

/** Convenience: debit the wallet (e.g. applying balance at checkout). */
export const debitWallet = (amount: number, description?: string, orderId?: string) =>
  addWalletTransaction('debit', amount, description, orderId);
