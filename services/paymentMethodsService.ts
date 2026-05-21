import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

export interface PaymentMethod {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  icon: string | null;
  enabled: boolean;
  is_coming_soon: boolean;
  show_in_request_step: boolean;
  show_in_payment_page: boolean;
  sort_order: number;
}

/** All payment methods, ordered. Admin screen uses this. */
export const listPaymentMethods = async (): Promise<PaymentMethod[]> => {
  try {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data ?? []) as PaymentMethod[];
  } catch (e) {
    logger.warn('listPaymentMethods failed', e);
    return [];
  }
};

/** Methods to show in the illustrative payment step during request creation. */
export const getRequestStepMethods = async (): Promise<PaymentMethod[]> =>
  (await listPaymentMethods()).filter((m) => m.enabled && m.show_in_request_step);

/** Methods to show on the real payment page (after quote acceptance). */
export const getPaymentPageMethods = async (): Promise<PaymentMethod[]> =>
  (await listPaymentMethods()).filter((m) => m.enabled && m.show_in_payment_page);

export const updatePaymentMethod = async (
  id: string,
  patch: Partial<Omit<PaymentMethod, 'id' | 'code'>>
): Promise<void> => {
  const { error } = await supabase.from('payment_methods').update(patch).eq('id', id);
  if (error) throw error;
};
