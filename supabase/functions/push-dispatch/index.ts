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
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const EXPO_CHUNK = 100; // Expo accepts up to 100 messages per request.
const RECEIPT_CHUNK = 1000; // Expo accepts up to 1000 receipt ids per request.

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

// A deliverable Expo push token is fully bracketed: "ExponentPushToken[...]"
// (or the "ExpoPushToken[...]" variant). A prefix-only / truncated value such
// as "ExponentPushToken[" passes a naive startsWith() check but makes Expo
// reject the ENTIRE batch with HTTP 400 — so require the closing bracket and a
// non-empty body, and forbid stray whitespace.
const EXPO_TOKEN_RE = /^Expo(nent)?PushToken\[[^\]\s]+\]$/;
const isExpoToken = (t: unknown): t is string =>
  typeof t === 'string' && EXPO_TOKEN_RE.test(t.trim());

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

    // --- Authorization: audience-wide sends are gated. ---------------------
    // Targeted sends — explicit `tokens` (incl. push-to-self) and `userIds`
    // (order-flow counterparty notifications) — stay open to any authenticated
    // caller. Segment broadcasts are gated:
    //   • 'all' / 'customers' → admin only (app_metadata.is_admin === true, or
    //     app_metadata.roles including 'admin'; same rule as constants/admin.ts).
    //   • 'technicians'       → admin, OR the owner of the order referenced by
    //     data.orderId. This keeps the customer→technicians "new order" push
    //     working without letting anyone spam all technicians at will.
    if (payload.audience) {
      const caller = await getCaller(req, admin);
      let allowed = caller?.isAdmin === true;

      if (!allowed && payload.audience === 'technicians') {
        const orderId = (payload.data as Record<string, unknown> | undefined)?.orderId;
        allowed =
          !!caller?.userId &&
          typeof orderId === 'string' &&
          orderId.length > 0 &&
          (await callerOwnsOrder(admin, caller.userId, orderId));
      }

      if (!allowed) {
        console.warn(
          `push-dispatch: rejected audience send (audience=${payload.audience} ` +
            `caller=${caller?.userId ?? 'anon'} admin=${caller?.isAdmin ?? false})`
        );
        return json({ error: 'forbidden: not authorized for this audience' }, 403);
      }
    }

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
    // Maps an accepted ticket's receipt id → the token it was sent to, so a
    // later receipt error (DeviceNotRegistered) can be traced back and pruned.
    const ticketToToken: Record<string, string> = {};

    // --- Send via the Expo Push API. ---------------------------------------
    const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN'); // optional

    // Send one batch of tokens. Expo validates the whole request as a unit, so
    // a single malformed token makes the ENTIRE batch fail with HTTP 400 — the
    // root cause of `broadcast push errors ["http_400"]`. When that happens we
    // bisect the batch to isolate the culprit, prune it, and still deliver to
    // every good token, instead of dropping the whole broadcast on the floor.
    const sendBatch = async (batch: string[]): Promise<void> => {
      if (batch.length === 0) return;

      const messages = batch.map((to) => ({
        to,
        title,
        body,
        data: data ?? {},
        sound: 'default',
        priority: 'high',
        channelId: 'default',
      }));

      let res: Response;
      try {
        res = await fetch(EXPO_PUSH_URL, {
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
      } catch (e) {
        // Network-level failure (not a token problem) — count and move on.
        failed += batch.length;
        errors.push(msg(e));
        return;
      }

      const out = await res.json().catch(() => null);

      // Batch-level rejection: non-2xx (typically HTTP 400) or a top-level
      // `errors` array. Expo validates the whole request as a unit, so the most
      // common real-world cause here is PUSH_TOO_MANY_EXPERIENCE_IDS — tokens
      // belonging to more than one Expo project mixed into one request (e.g.
      // after the EAS projectId changed). Bisecting eventually produces
      // single-project sub-requests that succeed.
      const topError = out?.errors?.[0];
      const batchRejected = !res.ok || !out || (out.errors?.length ?? 0) > 0;
      if (batchRejected) {
        if (batch.length > 1) {
          const mid = Math.floor(batch.length / 2);
          await sendBatch(batch.slice(0, mid));
          await sendBatch(batch.slice(mid));
          return;
        }

        // Down to a single token and still rejected. Only prune it if the error
        // is specific to the token itself ("...is not a valid Expo push
        // token"); other 400s (rate limits, transient/project issues) are NOT
        // the token's fault, so log loudly and count failed without deleting a
        // potentially-good token.
        failed += 1;
        const code = topError?.code || `http_${res.status}`;
        const message: string = topError?.message || '';
        errors.push(code);
        const tokenIsInvalid = /not a valid expo push token/i.test(message);
        if (tokenIsInvalid) {
          deadTokens.push(batch[0]);
          console.error(
            `push-dispatch: dropping invalid token (${code}): ${batch[0]}`
          );
        } else {
          console.error(
            `push-dispatch: batch rejected for token ${batch[0]} — ` +
              `code=${code} message=${message || `http_${res.status}`} ` +
              `(kept; not a token-format error)`
          );
        }
        return;
      }

      // Per-message tickets, in the same order as the request.
      const tickets = Array.isArray(out.data) ? out.data : [];
      tickets.forEach((ticket: any, idx: number) => {
        if (ticket?.status === 'ok') {
          sent += 1;
          // Remember which token this receipt id belongs to so we can audit
          // its delivery outcome via the receipts API below.
          if (ticket?.id && batch[idx]) {
            ticketToToken[ticket.id] = batch[idx];
          }
        } else {
          failed += 1;
          const code = ticket?.details?.error || ticket?.message || 'error';
          errors.push(code);
          // A dead/uninstalled token — clear it so we stop retrying it.
          if (code === 'DeviceNotRegistered' && batch[idx]) {
            deadTokens.push(batch[idx]);
          }
        }
      });
    };

    for (let i = 0; i < expoTokens.length; i += EXPO_CHUNK) {
      await sendBatch(expoTokens.slice(i, i + EXPO_CHUNK));
    }

    // --- Check delivery receipts. ------------------------------------------
    // A send ticket only confirms Expo *accepted* the message for delivery.
    // The real outcome (DeviceNotRegistered, InvalidCredentials, MessageTooBig,
    // …) surfaces later via the receipts API. Poll it so dead tokens get pruned
    // and credential/config errors are logged loudly instead of swallowed.
    const receiptIds = Object.keys(ticketToToken);
    for (let i = 0; i < receiptIds.length; i += RECEIPT_CHUNK) {
      const idChunk = receiptIds.slice(i, i + RECEIPT_CHUNK);
      try {
        const res = await fetch(EXPO_RECEIPTS_URL, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(expoAccessToken
              ? { Authorization: `Bearer ${expoAccessToken}` }
              : {}),
          },
          body: JSON.stringify({ ids: idChunk }),
        });

        const out = await res.json().catch(() => null);
        if (!res.ok || !out?.data) {
          errors.push(`receipts_http_${res.status}`);
          continue;
        }

        // Receipts not yet processed simply won't appear in `data` — that's
        // fine, the token stays as-is and we'll learn its fate on a later send.
        for (const [id, receipt] of Object.entries<any>(out.data)) {
          if (receipt?.status !== 'error') continue;

          // This token was counted as sent on the ticket, but delivery failed.
          sent = Math.max(0, sent - 1);
          failed += 1;
          const code = receipt?.details?.error || receipt?.message || 'receipt_error';
          errors.push(code);

          if (code === 'DeviceNotRegistered') {
            // Dead/uninstalled device — prune so we stop retrying it.
            const tok = ticketToToken[id];
            if (tok) deadTokens.push(tok);
          } else {
            // InvalidCredentials, MessageTooBig, MessageRateExceeded, … are
            // config/payload problems, NOT dead tokens. Log them separately so
            // they don't get silently swallowed (and don't delete the token).
            console.error(
              `push-dispatch: receipt error code=${code} id=${id} ` +
                `details=${JSON.stringify(receipt?.details ?? {})}`
            );
          }
        }
      } catch (e) {
        errors.push(`receipts_${msg(e)}`);
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

/**
 * Resolve the caller from their JWT (sent as the Authorization header by
 * supabase.functions.invoke) into { userId, isAdmin }. Admin is the server-set
 * claim app_metadata.is_admin === true, or app_metadata.roles containing
 * 'admin' — never a client-writable field. Returns null on any failure
 * (missing header, invalid token, lookup error) so callers deny by default.
 */
async function getCaller(
  req: Request,
  admin: any
): Promise<{ userId: string; isAdmin: boolean } | null> {
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!jwt) return null;
    const { data, error } = await admin.auth.getUser(jwt);
    if (error || !data?.user) return null;
    const meta = (data.user.app_metadata ?? {}) as Record<string, unknown>;
    const roles = meta.roles;
    const isAdmin =
      meta.is_admin === true ||
      (Array.isArray(roles) && roles.includes('admin'));
    return { userId: data.user.id as string, isAdmin };
  } catch {
    return null;
  }
}

/**
 * True when `userId` owns the given order — used to authorize the
 * customer→technicians "new order" broadcast without granting blanket
 * audience access. Service-role read, so RLS never hides the row.
 */
async function callerOwnsOrder(
  admin: any,
  userId: string,
  orderId: string
): Promise<boolean> {
  try {
    const { data, error } = await admin
      .from('orders')
      .select('id')
      .eq('id', orderId)
      .eq('user_id', userId)
      .maybeSingle();
    return !error && !!data;
  } catch {
    return false;
  }
}

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
