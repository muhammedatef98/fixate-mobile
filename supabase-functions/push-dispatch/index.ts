// push-dispatch — server-side FCM v1 push fan-out.
//
// Sends notifications through the Firebase Cloud Messaging v1 HTTP API using a
// service-account-minted OAuth2 access token. Recipient tokens are either
// passed in directly (`tokens`) or resolved server-side (service role) from
// `userIds` / `audience` so clients never read other users' tokens.
//
// Request body — one of the following shapes:
//   { mode: 'stats' }
//     → returns { totalUsers, withToken } for the admin debug screen.
//
//   { tokens: string[], title, body, data? }
//     → send to an explicit list of FCM registration tokens.
//
//   { userIds: string[],  title, body, data?, excludeUserId? }
//   { audience: 'all'|'customers'|'technicians', title, body, data? }
//     → resolve tokens from public.users, then send.
//
// Response (send):
//   { sent, failed, total, recipients, errors }
//   `recipients` mirrors `total` for backward compatibility with existing
//   callers (notifyService / broadcastService).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id?: string;
  token_uri?: string;
}

interface PushRequest {
  mode?: 'stats';
  tokens?: string[];
  userIds?: string[];
  audience?: 'all' | 'customers' | 'technicians';
  excludeUserId?: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as PushRequest;
    console.log(
      `push-dispatch: invoked mode=${payload.mode ?? 'send'} ` +
        `hasTokens=${!!payload.tokens?.length} audience=${payload.audience ?? '-'} ` +
        `userIds=${payload.userIds?.length ?? 0}`
    );

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    // --- Stats mode: counts only, no send. ---------------------------------
    if (payload.mode === 'stats') {
      const [{ count: totalUsers }, { count: withToken }] = await Promise.all([
        admin.from('users').select('id', { count: 'exact', head: true }),
        admin
          .from('users')
          .select('id', { count: 'exact', head: true })
          .not('push_token', 'is', null),
      ]);
      console.log(
        `push-dispatch: stats totalUsers=${totalUsers} withToken=${withToken}`
      );
      return json({ totalUsers: totalUsers ?? 0, withToken: withToken ?? 0 });
    }

    const { title, body, data } = payload;
    if (!title || !body) {
      return json({ error: 'title and body are required' }, 400);
    }

    // --- Resolve recipient tokens. -----------------------------------------
    let tokens: string[];
    if (payload.tokens?.length) {
      tokens = payload.tokens.filter(
        (t): t is string => typeof t === 'string' && t.length > 0
      );
    } else if (payload.userIds?.length || payload.audience) {
      let query = admin
        .from('users')
        .select('id, push_token, role')
        .not('push_token', 'is', null);

      if (payload.userIds?.length) {
        query = query.in('id', payload.userIds);
      } else if (payload.audience === 'customers') {
        query = query.or('role.eq.customer,role.is.null');
      } else if (payload.audience === 'technicians') {
        query = query.eq('role', 'technician');
      }

      const { data: rows, error } = await query;
      if (error) return json({ error: error.message }, 500);
      tokens = (rows ?? [])
        .filter((r) => r.id !== payload.excludeUserId)
        .map((r) => r.push_token as string)
        .filter((t): t is string => typeof t === 'string' && t.length > 0);
    } else {
      return json({ error: 'tokens, userIds or audience is required' }, 400);
    }

    // De-dupe — a user might have the same token mirrored more than once.
    tokens = [...new Set(tokens)];
    console.log(`push-dispatch: resolved ${tokens.length} token(s)`);

    if (tokens.length === 0) {
      return json({ sent: 0, failed: 0, total: 0, recipients: 0, errors: ['no_tokens'] });
    }

    // --- Mint a short-lived FCM access token. ------------------------------
    const saJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON');
    if (!saJson) {
      console.error('push-dispatch: FIREBASE_SERVICE_ACCOUNT_JSON is not set');
      return json(
        { error: 'FIREBASE_SERVICE_ACCOUNT_JSON secret is missing on the Edge Function' },
        500
      );
    }

    let serviceAccount: ServiceAccount;
    try {
      serviceAccount = JSON.parse(saJson) as ServiceAccount;
    } catch (_e) {
      console.error('push-dispatch: FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON');
      return json({ error: 'FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON' }, 500);
    }

    // The project_id baked into the service account is authoritative — it must
    // match the messaging project the SA is authorized for. Prefer it over the
    // FIREBASE_PROJECT_ID env var, which is easy to mistype (a typo there
    // produces an opaque FCM "PERMISSION_DENIED on resource project ...").
    const projectId = serviceAccount.project_id || Deno.env.get('FIREBASE_PROJECT_ID');
    if (!projectId) {
      console.error('push-dispatch: no project_id in service account and FIREBASE_PROJECT_ID unset');
      return json({ error: 'FIREBASE project id is missing (service account + env both empty)' }, 500);
    }
    console.log(`push-dispatch: target FCM project=${projectId}`);

    let accessToken: string;
    try {
      accessToken = await getAccessToken(serviceAccount);
      console.log('push-dispatch: obtained FCM access token');
    } catch (e) {
      console.error('push-dispatch: failed to mint access token', e);
      return json({ error: `OAuth token exchange failed: ${msg(e)}` }, 500);
    }

    // --- Send one message per token via FCM v1. ----------------------------
    const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
    const stringData = stringifyData(data);

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    const results = await Promise.allSettled(
      tokens.map((token) => {
        // FCM v1 only accepts raw FCM registration tokens. Expo push tokens
        // (the legacy format) cannot be delivered through it — flag them
        // clearly instead of issuing a guaranteed-to-fail request.
        if (token.startsWith('ExponentPushToken')) {
          return Promise.reject(new Error('expo_token_not_supported_by_fcm_v1'));
        }
        return sendOne(url, accessToken, token, { title, body }, stringData);
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled') {
        sent += 1;
      } else {
        failed += 1;
        errors.push(msg(r.reason));
      }
    }

    console.log(`push-dispatch: sent=${sent} failed=${failed} total=${tokens.length}`);
    return json({
      sent,
      failed,
      total: tokens.length,
      recipients: tokens.length,
      errors: [...new Set(errors)].slice(0, 10),
    });
  } catch (e) {
    console.error('push-dispatch: unhandled error', e);
    return json({ error: msg(e) }, 500);
  }
});

/** POST a single FCM v1 message. Resolves on success, rejects with the error. */
async function sendOne(
  url: string,
  accessToken: string,
  token: string,
  notification: { title: string; body: string },
  data: Record<string, string>
): Promise<void> {
  const message = {
    message: {
      token,
      notification,
      data,
      android: { priority: 'high' },
      apns: { headers: { 'apns-priority': '10' } },
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });

  if (res.ok) return;

  // Surface the FCM error status + message (e.g. UNREGISTERED,
  // INVALID_ARGUMENT, PERMISSION_DENIED) so the caller can tell a dead token
  // from a project/permission misconfiguration.
  const text = await res.text();
  let detail = `HTTP ${res.status}`;
  try {
    const parsed = JSON.parse(text);
    const status = parsed?.error?.status;
    const message = parsed?.error?.message;
    detail = [status, message].filter(Boolean).join(': ') || detail;
  } catch (_e) {
    // Non-JSON body — keep the HTTP status.
  }
  throw new Error(detail);
}

/** Build (and exchange) a service-account JWT for an OAuth2 access token. */
async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: sa.client_email,
    scope: FCM_SCOPE,
    aud: sa.token_uri || GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const key = await importPrivateKey(sa.private_key);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned)
  );
  const jwt = `${unsigned}.${b64urlBytes(new Uint8Array(signature))}`;

  const res = await fetch(sa.token_uri || GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const out = (await res.json()) as { access_token?: string; error_description?: string };
  if (!res.ok || !out.access_token) {
    throw new Error(out.error_description || `HTTP ${res.status}`);
  }
  return out.access_token;
}

/** Import a PEM PKCS#8 private key for RSASSA-PKCS1-v1_5 signing. */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    der.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

/** FCM data payloads must be string→string. Stringify any non-string values. */
function stringifyData(data?: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  if (!data) return out;
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) continue;
    out[k] = typeof v === 'string' ? v : JSON.stringify(v);
  }
  return out;
}

function b64url(s: string): string {
  return b64urlBytes(new TextEncoder().encode(s));
}

function b64urlBytes(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
