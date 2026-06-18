// push-dispatch — server-side Expo Push API fan-out.
//
// Sends notifications through Expo's Push API (https://exp.host). Recipient
// tokens are either passed in directly (`tokens`) or resolved server-side
// (service role) from `userIds` / `audience` so clients never read other
// users' tokens. Expo relays to FCM v1 (Android) and APNs (iOS) using the
// credentials configured on the EAS project.
//
// Request body — one of the following shapes:
//   { mode: 'stats' }
//     → returns { totalUsers, withToken } for the admin debug screen.
//
//   { tokens: string[], title, body, data? }
//     → send to an explicit list of Expo push tokens.
//
//   { userIds: string[],  title, body, data?, excludeUserId? }
//   { audience: 'all'|'customers'|'technicians', title, body, data? }
//     → resolve tokens from public.users, then send.
//
// Response (send):
//   { sent, failed, total, recipients, errors }
//   `recipients` mirrors `total` for backward compatibility with existing
//   callers (notifyService / broadcastService).

// @ts-nocheck — Deno runtime
import { createClient } from 'jsr:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_CHUNK = 100; // Expo accepts up to 100 messages per request.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

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

const isExpoToken = (t: unknown): t is string =>
  typeof t === 'string' &&
  (t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['));

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

    // De-dupe, then split into deliverable Expo tokens vs. legacy/invalid ones
    // (raw FCM/APNs tokens left over from the previous FCM-v1 flow). Invalid
    // tokens are counted as failures and cleared from the DB so they self-heal
    // when the user next opens the app and re-registers an Expo token.
    tokens = [...new Set(tokens)];
    const expoTokens = tokens.filter(isExpoToken);
    const invalidTokens = tokens.filter((t) => !isExpoToken(t));
    console.log(
      `push-dispatch: resolved ${tokens.length} token(s) — ` +
        `${expoTokens.length} expo, ${invalidTokens.length} invalid`
    );

    if (invalidTokens.length) {
      await clearTokens(admin, invalidTokens);
    }

    let sent = 0;
    let failed = invalidTokens.length;
    const errors: string[] = invalidTokens.length ? ['not_expo_token'] : [];
    const deadTokens: string[] = [];

    // --- Send in chunks via the Expo Push API. -----------------------------
    const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN'); // optional
    for (let i = 0; i < expoTokens.length; i += EXPO_CHUNK) {
      const chunk = expoTokens.slice(i, i + EXPO_CHUNK);
      const messages = chunk.map((to) => ({
        to,
        title,
        body,
        data: data ?? {},
        sound: 'default',
        priority: 'high',
        channelId: 'default',
      }));

      try {
        const res = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
            ...(expoAccessToken
              ? { Authorization: `Bearer ${expoAccessToken}` }
              : {}),
          },
          body: JSON.stringify(messages),
        });

        const out = await res.json().catch(() => null);

        if (!res.ok || !out) {
          failed += chunk.length;
          errors.push(`http_${res.status}`);
          continue;
        }

        // Top-level request error (e.g. auth / payload problem).
        if (out.errors?.length) {
          failed += chunk.length;
          for (const e of out.errors) errors.push(e?.code || 'request_error');
          continue;
        }

        // Per-message tickets, in the same order as the request.
        const tickets = Array.isArray(out.data) ? out.data : [];
        tickets.forEach((ticket: any, idx: number) => {
          if (ticket?.status === 'ok') {
            sent += 1;
          } else {
            failed += 1;
            const code = ticket?.details?.error || ticket?.message || 'error';
            errors.push(code);
            // A dead/uninstalled token — clear it so we stop retrying it.
            if (code === 'DeviceNotRegistered' && chunk[idx]) {
              deadTokens.push(chunk[idx]);
            }
          }
        });
      } catch (e) {
        failed += chunk.length;
        errors.push(msg(e));
      }
    }

    if (deadTokens.length) {
      await clearTokens(admin, deadTokens);
    }

    console.log(
      `push-dispatch: sent=${sent} failed=${failed} total=${tokens.length}`
    );
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

/** Null out push_token rows whose token value is in `values`. */
async function clearTokens(admin: any, values: string[]): Promise<void> {
  try {
    await admin
      .from('users')
      .update({ push_token: null })
      .in('push_token', [...new Set(values)]);
  } catch (e) {
    console.error('push-dispatch: clearTokens failed', msg(e));
  }
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
