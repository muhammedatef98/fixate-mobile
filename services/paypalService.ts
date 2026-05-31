import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

// PayPal repair-payment client. The hosted PayPal approval page is opened
// via expo-web-browser's openAuthSessionAsync, which uses
// SFAuthenticationSession on iOS / Chrome Custom Tabs on Android. This is
// the safer in-app browser option (system-managed, no shared cookies with
// other WebViews), and the only one that reliably hands the return URL
// back to the app as a Promise.
//
// Two edge functions back this flow:
//   - create-paypal-order: builds a PayPal order in USD from the order's
//                          server-side computed SAR amount.
//   - capture-paypal-order: completes the charge after the user approves.
// Both require a valid Supabase JWT (verify_jwt = true).
//
// No PayPal client_id / client_secret is ever touched on the client side.

export interface PaypalOrderInit {
  paypalOrderId: string;
  approveUrl: string;
  sarAmount: number;
  usdAmount: number;
  fxRate: number;
  env: 'sandbox' | 'live';
}

export interface PaypalCaptureResult {
  ok: boolean;
  capture_id: string | null;
  alreadyCaptured?: boolean;
}

export type PaypalErrorCode =
  | 'unauthorized'
  | 'invalid_order_id'
  | 'order_not_found'
  | 'forbidden'
  | 'already_paid'
  | 'invalid_amount'
  | 'payment_not_configured'
  | 'paypal_create_failed'
  | 'payment_not_found'
  | 'paypal_capture_failed'
  | 'invalid_input'
  | 'user_cancelled'
  | 'network_error';

export class PaypalError extends Error {
  code: PaypalErrorCode;
  constructor(code: PaypalErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

const extractError = (data: unknown, error: unknown): string | undefined => {
  let key: string | undefined = (data as { error?: string } | null)?.error;
  if (!key && error) {
    try {
      const ctx = (error as { context?: { body?: unknown } }).context;
      if (ctx?.body) {
        const parsed =
          typeof ctx.body === 'string' ? JSON.parse(ctx.body) : (ctx.body as { error?: string });
        key = parsed?.error;
      }
    } catch {
      /* ignore */
    }
    key = key || (error as { message?: string }).message;
  }
  return key;
};

const FRIENDLY: Record<string, { ar: string; en: string }> = {
  unauthorized:           { ar: 'الرجاء تسجيل الدخول مرة أخرى', en: 'Please sign in again' },
  invalid_order_id:       { ar: 'الطلب غير صالح', en: 'Invalid order' },
  order_not_found:        { ar: 'الطلب غير موجود', en: 'Order not found' },
  forbidden:              { ar: 'لا يمكنك دفع هذا الطلب', en: 'You cannot pay for this order' },
  already_paid:           { ar: 'الطلب مدفوع بالفعل', en: 'This order is already paid' },
  invalid_amount:         { ar: 'مبلغ الطلب غير صالح', en: 'Order amount is invalid' },
  payment_not_configured: { ar: 'الدفع غير مُهيَّأ', en: 'Payment not configured' },
  paypal_create_failed:   { ar: 'تعذر بدء الدفع عبر PayPal', en: 'Could not start PayPal payment' },
  payment_not_found:      { ar: 'لم يُعثر على عملية الدفع', en: 'Payment not found' },
  paypal_capture_failed:  { ar: 'لم يكتمل الدفع، حاول مرة أخرى', en: 'Payment did not complete, try again' },
  invalid_input:          { ar: 'بيانات غير صحيحة', en: 'Invalid input' },
  user_cancelled:         { ar: 'تم إلغاء الدفع', en: 'Payment cancelled' },
  network_error:          { ar: 'تعذر الاتصال بـ PayPal', en: 'Could not reach PayPal' },
};

export const friendlyPaypalError = (e: unknown, lang: 'ar' | 'en'): string => {
  const code: string =
    e instanceof PaypalError ? e.code
    : (e as { code?: string })?.code ?? 'paypal_create_failed';
  return FRIENDLY[code]?.[lang] ?? FRIENDLY.paypal_create_failed[lang];
};

export const createPaypalOrder = async (orderId: string): Promise<PaypalOrderInit> => {
  if (!orderId) throw new PaypalError('invalid_order_id');
  try {
    const { data, error } = await supabase.functions.invoke<PaypalOrderInit & { error?: string }>(
      'create-paypal-order',
      { body: { orderId } },
    );
    const key = extractError(data, error);
    if (key) throw new PaypalError(key as PaypalErrorCode);
    if (!data?.paypalOrderId || !data?.approveUrl) {
      throw new PaypalError('paypal_create_failed');
    }
    return {
      paypalOrderId: data.paypalOrderId,
      approveUrl: data.approveUrl,
      sarAmount: Number(data.sarAmount),
      usdAmount: Number(data.usdAmount),
      fxRate: Number(data.fxRate),
      env: (data.env as 'sandbox' | 'live') ?? 'sandbox',
    };
  } catch (e) {
    if (e instanceof PaypalError) throw e;
    logger.warn('createPaypalOrder failed', e);
    throw new PaypalError('network_error');
  }
};

export const capturePaypalOrder = async (
  paypalOrderId: string,
  orderId: string,
): Promise<PaypalCaptureResult> => {
  if (!paypalOrderId || !orderId) throw new PaypalError('invalid_input');
  try {
    const { data, error } = await supabase.functions.invoke<PaypalCaptureResult & { error?: string }>(
      'capture-paypal-order',
      { body: { paypalOrderId, orderId } },
    );
    const key = extractError(data, error);
    if (key) throw new PaypalError(key as PaypalErrorCode);
    if (!data?.ok) throw new PaypalError('paypal_capture_failed');
    return {
      ok: true,
      capture_id: data.capture_id ?? null,
      alreadyCaptured: data.alreadyCaptured,
    };
  } catch (e) {
    if (e instanceof PaypalError) throw e;
    logger.warn('capturePaypalOrder failed', e);
    throw new PaypalError('network_error');
  }
};

/**
 * Open the PayPal hosted approval page in the system in-app browser.
 * Returns true when the user completes the approval and PayPal redirects
 * back to the configured return URL. Returns false if the user cancels
 * or dismisses the sheet.
 *
 * The return URL is registered as the app's deep-link scheme
 * (`fixatee://paypal-return`) and matches the PAYPAL_RETURN_URL secret
 * on the edge function side.
 */
export const openPaypalCheckout = async (
  approveUrl: string,
  returnUrl = 'fixatee://paypal-return',
): Promise<{ approved: boolean }> => {
  const result = await WebBrowser.openAuthSessionAsync(approveUrl, returnUrl, {
    showInRecents: false,
  });
  // expo-web-browser results:
  //   'success' — the return URL was hit; treat as approved.
  //   'cancel' / 'dismiss' — user closed the sheet.
  //   'locked' — already open elsewhere.
  return { approved: result.type === 'success' };
};
