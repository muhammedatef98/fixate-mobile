import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

export interface DiscountCode {
  id: string;
  code: string;
  description_ar?: string | null;
  description_en?: string | null;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  max_discount?: number | null;
  min_order_total?: number | null;
  usage_limit?: number | null;
  used_count: number;
  per_user_limit?: number | null;
  starts_at?: string | null;
  expires_at?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DiscountValidation {
  valid: boolean;
  reason?: string;
  amount_saved?: number;
  code?: DiscountCode;
}

const reasonText = (key: string, lang: 'ar' | 'en'): string => {
  const ar: Record<string, string> = {
    not_found: 'كود غير صحيح',
    inactive: 'الكود غير مفعّل',
    expired: 'انتهت صلاحية الكود',
    not_started: 'الكود لم يبدأ بعد',
    usage_limit: 'تم استخدام الكود بالكامل',
    per_user_limit: 'لا يمكنك استخدام هذا الكود مرة أخرى',
    min_order: 'قيمة الطلب لا تستوفي الحد الأدنى',
  };
  const en: Record<string, string> = {
    not_found: 'Invalid code',
    inactive: 'Code is not active',
    expired: 'Code has expired',
    not_started: 'Code is not yet active',
    usage_limit: 'Code usage limit reached',
    per_user_limit: 'You have already used this code',
    min_order: 'Order does not meet the minimum total',
  };
  return (lang === 'ar' ? ar : en)[key] ?? key;
};

const computeAmount = (code: DiscountCode, orderTotal: number): number => {
  let amount = code.discount_type === 'percent'
    ? (orderTotal * code.discount_value) / 100
    : code.discount_value;
  if (code.discount_type === 'percent' && code.max_discount && code.max_discount > 0) {
    amount = Math.min(amount, code.max_discount);
  }
  amount = Math.min(amount, orderTotal);
  return Math.round(amount * 100) / 100;
};

// Customer-side: validate a code against an order total. RLS policy
// `discount_codes_read_active` already filters out inactive / expired / not-yet-
// started rows, so a missing match means "either bad code OR ineligible for
// the customer right now" — both surface as `not_found`.
export const validateDiscountCode = async (
  rawCode: string,
  orderTotal: number,
  userId: string,
  lang: 'ar' | 'en' = 'ar'
): Promise<DiscountValidation> => {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { valid: false, reason: reasonText('not_found', lang) };

  const { data, error } = await supabase
    .from('discount_codes')
    .select('*')
    .eq('code', code)
    .maybeSingle();

  if (error) {
    logger.warn('validateDiscountCode lookup failed', error);
    return { valid: false, reason: reasonText('not_found', lang) };
  }
  if (!data) return { valid: false, reason: reasonText('not_found', lang) };

  const c = data as DiscountCode;
  if (!c.is_active) return { valid: false, reason: reasonText('inactive', lang) };
  if (c.usage_limit != null && c.used_count >= c.usage_limit) {
    return { valid: false, reason: reasonText('usage_limit', lang) };
  }
  if (c.min_order_total != null && orderTotal < c.min_order_total) {
    return { valid: false, reason: reasonText('min_order', lang) };
  }

  if (c.per_user_limit != null && c.per_user_limit > 0) {
    const { count } = await supabase
      .from('discount_redemptions')
      .select('*', { count: 'exact', head: true })
      .eq('code_id', c.id)
      .eq('user_id', userId);
    if ((count ?? 0) >= c.per_user_limit) {
      return { valid: false, reason: reasonText('per_user_limit', lang) };
    }
  }

  const amount = computeAmount(c, orderTotal);
  return { valid: true, amount_saved: amount, code: c };
};

// Insert the redemption row after the order is created. Per-user enforcement
// is also defended at the DB layer by the redemptions count check above and
// via admin reporting on the discount_redemptions table.
export const recordDiscountRedemption = async (
  codeId: string,
  userId: string,
  orderId: string | null,
  amountSaved: number
): Promise<void> => {
  const { error } = await supabase.from('discount_redemptions').insert({
    code_id: codeId,
    user_id: userId,
    order_id: orderId,
    amount_saved: amountSaved,
  });
  if (error) logger.warn('recordDiscountRedemption failed', error);
};

// ---------------- Admin CRUD ----------------
// All of these rely on the RLS policy `discount_codes_admin_all` — non-admins
// will receive an RLS denial from PostgREST, which we surface as-is.

export const adminListDiscountCodes = async (): Promise<DiscountCode[]> => {
  const { data, error } = await supabase
    .from('discount_codes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    logger.warn('adminListDiscountCodes failed', error);
    return [];
  }
  return (data ?? []) as DiscountCode[];
};

export type DiscountCodeInput = Omit<
  DiscountCode,
  'id' | 'used_count' | 'created_at' | 'updated_at'
>;

export const adminCreateDiscountCode = async (
  input: DiscountCodeInput
): Promise<DiscountCode> => {
  const payload = { ...input, code: input.code.trim().toUpperCase() };
  const { data, error } = await supabase
    .from('discount_codes')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as DiscountCode;
};

export const adminUpdateDiscountCode = async (
  id: string,
  patch: Partial<DiscountCodeInput>
): Promise<DiscountCode> => {
  const cleaned: Record<string, any> = { ...patch };
  if (cleaned.code) cleaned.code = String(cleaned.code).trim().toUpperCase();
  const { data, error } = await supabase
    .from('discount_codes')
    .update(cleaned)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as DiscountCode;
};

export const adminDeleteDiscountCode = async (id: string): Promise<void> => {
  const { error } = await supabase.from('discount_codes').delete().eq('id', id);
  if (error) throw error;
};

export const adminToggleDiscountCode = async (
  id: string,
  isActive: boolean
): Promise<DiscountCode> =>
  adminUpdateDiscountCode(id, { is_active: isActive } as Partial<DiscountCodeInput>);
