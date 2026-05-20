import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';
import { validatePrice } from '../utils/validation';
import { callEdgeFunction } from './edgeInvoke';

export interface Payment {
  id: string;
  order_id: string;
  user_id: string;
  provider: string;
  provider_payment_id?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded' | 'cancelled';
  metadata?: Record<string, any>;
  failure_reason?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreatePaymentResponse {
  payment: Payment;
  clientSecret?: string;
  publishableKey?: string;
}

/**
 * Create a payment intent via the create-payment Edge Function.
 * The Edge Function (server-side) talks to Stripe with the secret key
 * and inserts a row in public.payments. The mobile app never sees the Stripe secret.
 */
export const createPayment = async (
  orderId: string,
  amount: number,
  currency: string = 'SAR'
): Promise<CreatePaymentResponse> => {
  const priceCheck = validatePrice(amount);
  if (!priceCheck.valid) {
    throw new Error(priceCheck.message);
  }
  if (!orderId) {
    throw new Error('Order ID is required');
  }

  try {
    const { data, errorMessage } = await callEdgeFunction<CreatePaymentResponse>(
      'create-payment',
      { orderId, amount, currency }
    );
    if (errorMessage) throw new Error(errorMessage);
    if (!data) throw new Error('Empty response from payment service');
    return data;
  } catch (error: any) {
    logger.error('Create payment error', error);
    throw error;
  }
};

export const getPaymentByOrderId = async (orderId: string): Promise<Payment | null> => {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error: any) {
    logger.error('Get payment error', error);
    return null;
  }
};

export const getMyPayments = async (userId: string): Promise<Payment[]> => {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    logger.error('Get my payments error', error);
    return [];
  }
};
