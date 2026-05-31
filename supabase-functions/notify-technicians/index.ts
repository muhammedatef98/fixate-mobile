// Supabase Edge Function: notify-technicians
//
// Sends push notifications via Firebase Cloud Messaging (HTTP v1 API) to all
// available technicians when a new order is created.
//
// AUTH POLICY (H-15):
//   - Must be invoked with a valid Supabase auth JWT (Authorization: Bearer ...).
//   - Caller must be either:
//       * the customer who owns `orderId`, OR
//       * an admin (public.users.is_admin = true).
//   - Anonymous and unrelated authenticated callers are rejected with 401/403.
//   - Internal errors are NEVER returned to the client; the response body
//     uses generic error keys only.
//
// DEPLOYMENT:
//   - Deploy with verify_jwt = true (this is the default):
//       supabase functions deploy notify-technicians --no-verify-jwt=false
//     The platform-level JWT check rejects unauthenticated traffic before
//     this function code even runs; the in-body check is a defense-in-depth
//     enforcement of caller-must-be-owner-or-admin.
//   - As of this commit the function is NOT deployed. The hardened source
//     here is the safe default when it is eventually deployed.
//
// Required secrets:
//   - FCM_PROJECT_ID
//   - FCM_SERVICE_ACCOUNT_JSON (the entire service-account JSON string)
//   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

// @ts-nocheck — Deno runtime
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { create, getNumericDate } from 'https://deno.land/x/djwt@v2.9.1/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const JSON_HEADERS = { ...corsHeaders, 'Content-Type': 'application/json' };

interface NotifyBody {
  orderId: string;
  orderData: {
    brand?: string;
    model?: string;
    issue?: string;
    [k: string]: any;
  };
}

// Extract the bearer JWT from the incoming request. Missing / malformed
// header returns null so we can reject before doing any work.
function extractBearer(req: Request): string | null {
  const h = req.headers.get('Authorization') || req.headers.get('authorization');
  if (!h) return null;
  const m = /^Bearer\s+([^\s]+)$/i.exec(h);
  return m ? m[1] : null;
}

async function pemToArrayBuffer(pem: string): Promise<ArrayBuffer> {
  const base64 = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
  return buffer;
}

async function getAccessToken(serviceAccount: any): Promise<string> {
  const now = getNumericDate(0);
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: getNumericDate(3600),
  };
  const key = await crypto.subtle.importKey(
    'pkcs8',
    await pemToArrayBuffer(serviceAccount.private_key as string),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const jwt = await create({ alg: 'RS256', typ: 'JWT' }, payload, key);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error('fcm_oauth_failed');
  return json.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const projectId           = Deno.env.get('FCM_PROJECT_ID');
    const serviceAccountJson  = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON');
    const supabaseUrl         = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey             = Deno.env.get('SUPABASE_ANON_KEY')!;

    if (!projectId || !serviceAccountJson) {
      // Operator-side problem — surface a generic key to the client.
      return new Response(JSON.stringify({ error: 'unavailable' }), { status: 503, headers: JSON_HEADERS });
    }

    // ── AUTHN: caller must present a valid bearer JWT ────────────────────
    const jwt = extractBearer(req);
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: JSON_HEADERS });
    }
    // Verify the JWT by asking Supabase for the user it represents.
    // We use a per-request anon client + bearer; an invalid/expired token
    // returns no user, which we reject below.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false },
    });
    const { data: callerData, error: callerErr } = await callerClient.auth.getUser(jwt);
    if (callerErr || !callerData?.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: JSON_HEADERS });
    }
    const callerId = callerData.user.id;

    // ── BODY PARSING ─────────────────────────────────────────────────────
    let parsed: NotifyBody | null = null;
    try {
      parsed = (await req.json()) as NotifyBody;
    } catch {
      return new Response(JSON.stringify({ error: 'invalid_body' }), { status: 400, headers: JSON_HEADERS });
    }
    const orderId = String(parsed?.orderId ?? '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
      return new Response(JSON.stringify({ error: 'invalid_body' }), { status: 400, headers: JSON_HEADERS });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // ── AUTHZ: caller must own the order OR be admin ─────────────────────
    const { data: order, error: ordErr } = await adminClient
      .from('orders')
      .select('id, user_id, status')
      .eq('id', orderId)
      .maybeSingle();
    if (ordErr || !order) {
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: JSON_HEADERS });
    }
    if (order.user_id !== callerId) {
      const { data: profile } = await adminClient
        .from('users')
        .select('is_admin')
        .eq('id', callerId)
        .maybeSingle();
      if (!profile?.is_admin) {
        return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: JSON_HEADERS });
      }
    }

    // ── PUSH FAN-OUT ─────────────────────────────────────────────────────
    const { data: technicians, error: listErr } = await adminClient.auth.admin.listUsers();
    if (listErr) {
      console.warn(`[notify-technicians] listUsers failed: ${listErr.message?.slice(0, 200) ?? 'unknown'}`);
      return new Response(JSON.stringify({ error: 'unavailable' }), { status: 502, headers: JSON_HEADERS });
    }

    const tokens: string[] = technicians.users
      .filter((u: any) => u.user_metadata?.role === 'technician' && u.user_metadata?.fcm_token)
      .map((u: any) => u.user_metadata.fcm_token);

    if (tokens.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, total: 0 }), { headers: JSON_HEADERS });
    }

    let serviceAccount: any;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch {
      console.warn('[notify-technicians] FCM_SERVICE_ACCOUNT_JSON malformed');
      return new Response(JSON.stringify({ error: 'unavailable' }), { status: 503, headers: JSON_HEADERS });
    }

    let accessToken: string;
    try {
      accessToken = await getAccessToken(serviceAccount);
    } catch (e) {
      console.warn(`[notify-technicians] fcm token failed: ${(e as Error).message?.slice(0, 200)}`);
      return new Response(JSON.stringify({ error: 'unavailable' }), { status: 502, headers: JSON_HEADERS });
    }

    const orderData = parsed?.orderData ?? {};
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
    const results = await Promise.allSettled(
      tokens.map((token) =>
        fetch(fcmUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            message: {
              token,
              notification: {
                title: 'طلب جديد متاح',
                body: `${orderData?.brand ?? ''} ${orderData?.model ?? ''} - ${orderData?.issue ?? ''}`.trim(),
              },
              data: { orderId, type: 'new_order' },
              android: { priority: 'HIGH' },
              apns: { payload: { aps: { sound: 'default' } } },
            },
          }),
        })
      )
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    return new Response(
      JSON.stringify({ success: true, sent: succeeded, total: tokens.length }),
      { headers: JSON_HEADERS }
    );
  } catch (e) {
    console.warn(`[notify-technicians] unhandled: ${(e as Error).message?.slice(0, 200)}`);
    return new Response(JSON.stringify({ error: 'unavailable' }), { status: 500, headers: JSON_HEADERS });
  }
});
