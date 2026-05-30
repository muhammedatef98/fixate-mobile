// Supabase Edge Function: capture-paypal-order
//
// Captures an approved PayPal order. Reads the audit row created by
// create-paypal-order, calls PayPal capture, and updates payments +
// orders rows server-side. Idempotent on the same paypalOrderId.
//
// Required secrets:
//   PAYPAL_CLIENT_ID
//   PAYPAL_CLIENT_SECRET
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Optional secrets:
//   PAYPAL_ENV   'sandbox' (default) | 'live'
//
// Deployed with verify_jwt = true.

// @ts-nocheck — Deno runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json' };

const PAYPAL_ENV          = (Deno.env.get('PAYPAL_ENV') ?? 'sandbox').toLowerCase();
const PAYPAL_BASE_URL     = PAYPAL_ENV === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';
const PAYPAL_CLIENT_ID    = Deno.env.get('PAYPAL_CLIENT_ID') ?? '';
const PAYPAL_CLIENT_SECRET= Deno.env.get('PAYPAL_CLIENT_SECRET') ?? '';
const REQUEST_TIMEOUT_MS  = 20000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

async function getPaypalAccessToken(): Promise<string> {
  const basic = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`paypal_oauth_${res.status}`);
    const data = await res.json();
    if (!data?.access_token) throw new Error('paypal_oauth_no_token');
    return data.access_token as string;
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      console.warn('[capture-paypal-order] PayPal credentials missing');
      return json({ error: 'payment_not_configured' }, 500);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'unauthorized' }, 401);

    const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: 'unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const paypalOrderId = String((body as any).paypalOrderId ?? '').trim();
    const orderId       = String((body as any).orderId ?? '').trim();
    if (!paypalOrderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
      return json({ error: 'invalid_input' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Audit row must exist and belong to the caller — prevents replay-from-
    // a-different-user attempts and "capture without create" abuse.
    const { data: paymentRow } = await admin
      .from('payments')
      .select('id, user_id, order_id, status, amount, currency, metadata')
      .eq('provider', 'paypal')
      .eq('provider_payment_id', paypalOrderId)
      .eq('order_id', orderId)
      .maybeSingle();
    if (!paymentRow)          return json({ error: 'payment_not_found' }, 404);
    if (paymentRow.user_id !== user.id) return json({ error: 'forbidden' }, 403);

    // Idempotency: already captured.
    if (paymentRow.status === 'succeeded') {
      return json({ ok: true, alreadyCaptured: true, capture_id: paymentRow.metadata?.capture_id ?? null });
    }

    const token = await getPaypalAccessToken();

    const ctrl = new AbortController();
    const tt = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    const capRes = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        // PayPal-Request-Id makes the capture safely retryable on the same
        // paypalOrderId without double-charging the customer.
        'PayPal-Request-Id': paypalOrderId,
      },
      body: '{}',
      signal: ctrl.signal,
    }).finally(() => clearTimeout(tt));
    const capJson = await capRes.json().catch(() => null);

    const completed = capRes.ok && capJson?.status === 'COMPLETED';
    const captureNode = capJson?.purchase_units?.[0]?.payments?.captures?.[0];
    const captureId = captureNode?.id ?? null;

    if (!completed) {
      const failureReason = capJson?.details?.[0]?.issue ?? `paypal_status_${capRes.status}`;
      await admin.from('payments').update({
        status: 'failed',
        failure_reason: failureReason.slice(0, 200),
        updated_at: new Date().toISOString(),
        metadata: {
          ...(paymentRow.metadata ?? {}),
          last_capture_response: { status: capRes.status, paypalStatus: capJson?.status ?? null },
        },
      }).eq('id', paymentRow.id);
      return json({ error: 'paypal_capture_failed' }, 502);
    }

    // Success — update payments + orders atomically (per-row updates, no tx
    // needed because the only failure mode is the orders update racing the
    // payments row, and the next view of the order would still reconcile).
    await admin.from('payments').update({
      status: 'succeeded',
      updated_at: new Date().toISOString(),
      metadata: {
        ...(paymentRow.metadata ?? {}),
        capture_id: captureId,
        captured_at: new Date().toISOString(),
      },
    }).eq('id', paymentRow.id);

    await admin.from('orders').update({
      payment_method: 'paypal',
      payment_status: 'paid',
      updated_at: new Date().toISOString(),
    }).eq('id', orderId);

    return json({ ok: true, capture_id: captureId });
  } catch (e) {
    const aborted = (e as any)?.name === 'AbortError';
    console.warn(`[capture-paypal-order] unhandled: ${aborted ? 'timeout' : (e as Error).message?.slice(0, 200)}`);
    return json({ error: 'paypal_capture_failed' }, 502);
  }
});
