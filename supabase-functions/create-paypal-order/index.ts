// Supabase Edge Function: create-paypal-order
//
// Creates a PayPal order via the v2 Orders API. The payable amount is
// computed SERVER-SIDE from the orders row — client never supplies it.
//
// Currency: PayPal does not support SAR. We display SAR in the app, but
// the charge to PayPal is in USD. The USD figure is returned to the
// client so it can show "You will be charged $X.YZ in USD" before the
// customer taps Continue.
//
// Required secrets:
//   PAYPAL_CLIENT_ID
//   PAYPAL_CLIENT_SECRET     — never returned to the client
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Optional secrets:
//   PAYPAL_ENV               'sandbox' (default) | 'live'
//   PAYPAL_SAR_USD_RATE      static FX rate, default 0.2667 (1 SAR ≈ 0.2667 USD)
//   PAYPAL_RETURN_URL        default 'fixatee://paypal-return'
//   PAYPAL_CANCEL_URL        default 'fixatee://paypal-cancel'
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
const SAR_USD_RATE        = Number(Deno.env.get('PAYPAL_SAR_USD_RATE') ?? '0.2667');
const RETURN_URL          = Deno.env.get('PAYPAL_RETURN_URL') ?? 'fixatee://paypal-return';
const CANCEL_URL          = Deno.env.get('PAYPAL_CANCEL_URL') ?? 'fixatee://paypal-cancel';
const REQUEST_TIMEOUT_MS  = 20000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

async function getPaypalAccessToken(): Promise<string> {
  const basic = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`paypal_oauth_${res.status}`);
    const data = await res.json();
    if (!data?.access_token) throw new Error('paypal_oauth_no_token');
    return data.access_token as string;
  } finally {
    clearTimeout(t);
  }
}

// Round to PayPal's required 2-decimal USD string.
function toMoney(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      console.warn('[create-paypal-order] PayPal credentials missing');
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
    const orderId = String((body as any).orderId ?? '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(orderId)) return json({ error: 'invalid_order_id' }, 400);

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Ownership + amount computation — server is the only authority.
    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select('id, user_id, status, payment_status, final_price, estimated_price, discount_amount, accessories, protection_addons, order_number')
      .eq('id', orderId)
      .maybeSingle();
    if (orderErr || !order) return json({ error: 'order_not_found' }, 404);
    if (order.user_id !== user.id) return json({ error: 'forbidden' }, 403);
    if (order.payment_status === 'paid') return json({ error: 'already_paid' }, 409);

    const repairPrice = Number(order.final_price ?? order.estimated_price ?? 0);
    const discount    = Number(order.discount_amount ?? 0);
    const accessories = Array.isArray(order.accessories) ? order.accessories : [];
    const protection  = Array.isArray(order.protection_addons) ? order.protection_addons : [];
    const addonsTotal = [...accessories, ...protection].reduce(
      (s: number, a: any) => s + Number(a?.price ?? 0), 0,
    );
    const sarAmount = Math.max(0, repairPrice - discount + addonsTotal);
    if (!Number.isFinite(sarAmount) || sarAmount <= 0) {
      return json({ error: 'invalid_amount' }, 400);
    }

    // SAR is not on the PayPal supported list — settle in USD and disclose.
    const fxRate = Number.isFinite(SAR_USD_RATE) && SAR_USD_RATE > 0 ? SAR_USD_RATE : 0.2667;
    const usdAmount = Math.max(0.01, sarAmount * fxRate);  // PayPal floor
    const usdAmountStr = toMoney(usdAmount);

    const token = await getPaypalAccessToken();

    const createBody = {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: orderId,
        description: `Fixate repair ${order.order_number ?? orderId.slice(0, 8)} (SAR ${toMoney(sarAmount)})`.slice(0, 127),
        custom_id: orderId,
        amount: {
          currency_code: 'USD',
          value: usdAmountStr,
        },
      }],
      application_context: {
        brand_name: 'Fixate',
        landing_page: 'LOGIN',
        user_action: 'PAY_NOW',
        return_url: RETURN_URL,
        cancel_url: CANCEL_URL,
      },
    };

    const ctrl = new AbortController();
    const tt = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    const createRes = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(createBody),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(tt));
    const createJson = await createRes.json().catch(() => null);
    if (!createRes.ok || !createJson?.id) {
      console.warn(`[create-paypal-order] PayPal ${createRes.status}`);
      return json({ error: 'paypal_create_failed' }, 502);
    }

    const approveLink = (createJson.links ?? []).find((l: any) => l.rel === 'approve' || l.rel === 'payer-action');
    if (!approveLink?.href) {
      console.warn('[create-paypal-order] no approve link');
      return json({ error: 'paypal_create_failed' }, 502);
    }

    // Audit row — status pending until capture lands.
    const { error: insertErr } = await admin.from('payments').insert({
      order_id: orderId,
      user_id: user.id,
      provider: 'paypal',
      provider_payment_id: createJson.id,
      amount: sarAmount,
      currency: 'SAR',
      status: 'pending',
      metadata: {
        paypal_env: PAYPAL_ENV,
        paypal_order_id: createJson.id,
        usd_amount: Number(usdAmountStr),
        usd_currency: 'USD',
        fx_rate: fxRate,
        fx_source: 'static_env',
      },
    });
    if (insertErr) {
      console.warn(`[create-paypal-order] payments insert ${insertErr.message?.slice(0, 200)}`);
    }

    return json({
      ok: true,
      paypalOrderId: createJson.id,
      approveUrl: approveLink.href,
      sarAmount,
      usdAmount: Number(usdAmountStr),
      fxRate,
      env: PAYPAL_ENV,
    });
  } catch (e) {
    const aborted = (e as any)?.name === 'AbortError';
    console.warn(`[create-paypal-order] unhandled: ${aborted ? 'timeout' : (e as Error).message?.slice(0, 200)}`);
    return json({ error: 'paypal_create_failed' }, 502);
  }
});
