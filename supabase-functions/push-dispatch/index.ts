// push-dispatch — server-side Expo push fan-out.
//
// Resolves recipient Expo push tokens server-side (service role) so clients
// never have to read other users' tokens, then sends through the Expo Push
// API and returns accurate { sent, failed } counts plus per-ticket errors.
//
// Request body (one of `userIds` or `audience` is required):
//   {
//     userIds?: string[],                       // explicit recipients
//     audience?: 'all'|'customers'|'technicians',// broadcast audience
//     excludeUserId?: string,                    // skip this user (e.g. sender)
//     title: string,
//     body: string,
//     data?: Record<string, unknown>            // deep-link payload (orderId, screen, ...)
//   }
import { createClient } from 'jsr:@supabase/supabase-js@2';

const EXPO_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_BATCH_SIZE = 100;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

interface PushRequest {
  userIds?: string[];
  audience?: 'all' | 'customers' | 'technicians';
  excludeUserId?: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as PushRequest;
    const { userIds, audience, excludeUserId, title, body, data } = payload;

    if (!title || !body) {
      return json({ error: 'title and body are required' }, 400);
    }
    if (!userIds?.length && !audience) {
      return json({ error: 'userIds or audience is required' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Resolve tokens.
    let query = admin
      .from('users')
      .select('id, push_token, role')
      .not('push_token', 'is', null);

    if (userIds?.length) {
      query = query.in('id', userIds);
    } else if (audience === 'customers') {
      query = query.or('role.eq.customer,role.is.null');
    } else if (audience === 'technicians') {
      query = query.eq('role', 'technician');
    }

    const { data: rows, error } = await query;
    if (error) return json({ error: error.message }, 500);

    const tokens = (rows ?? [])
      .filter((r) => r.id !== excludeUserId)
      .map((r) => r.push_token as string)
      .filter(
        (t) => typeof t === 'string' && t.startsWith('ExponentPushToken')
      );

    // Log the resolved recipient count so "0 sent" is attributable.
    console.log(
      `push-dispatch: audience=${audience ?? 'userIds'} resolved ${tokens.length} valid token(s)`
    );

    if (tokens.length === 0) {
      // No registered tokens at all — surface it explicitly instead of a
      // silent "0 sent" so the admin UI can explain the real cause.
      return json({ sent: 0, failed: 0, recipients: 0, errors: ['no_tokens'] });
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < tokens.length; i += EXPO_BATCH_SIZE) {
      const slice = tokens.slice(i, i + EXPO_BATCH_SIZE);
      const messages = slice.map((to) => ({
        to,
        sound: 'default',
        title,
        body,
        data: data ?? {},
        priority: 'high',
        channelId: 'default',
      }));

      try {
        const res = await fetch(EXPO_URL, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messages),
        });

        if (!res.ok) {
          failed += slice.length;
          errors.push(`HTTP ${res.status}`);
          continue;
        }

        const out = (await res.json()) as {
          data?: Array<{ status?: string; message?: string }>;
        };
        const tickets = out?.data ?? [];
        for (const t of tickets) {
          if (t.status === 'ok') sent += 1;
          else {
            failed += 1;
            if (t.message) errors.push(t.message);
          }
        }
        if (tickets.length < slice.length) {
          failed += slice.length - tickets.length;
        }
      } catch (e) {
        failed += slice.length;
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }

    console.log(`push-dispatch: sent=${sent} failed=${failed}`);
    // De-dupe the error list so the caller sees distinct failure reasons.
    return json({
      sent,
      failed,
      recipients: tokens.length,
      errors: [...new Set(errors)].slice(0, 10),
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
