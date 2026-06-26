// notify-segment — audience notification with preference filtering + in-app insert.
//
// This is the "separate path" used by admin broadcasts, offer auto-notify,
// scheduled notifications and automation rules. It does NOT replace
// push-dispatch (order/chat pushes keep using that untouched). Flow:
//   1. Resolve target users by audience (service role).
//   2. Drop users who opted out of the notification's category.
//   3. Insert an in-app `notifications` row for each remaining user (so it
//      shows in the bell), respecting bilingual title/body.
//   4. Push to those who still have push enabled + a token, by delegating the
//      actual Expo send to push-dispatch (explicit `tokens` list).
//
// Auth: admins (app_metadata.is_admin / roles includes 'admin') OR an internal
// caller presenting the service-role key (cron / triggers).
//
// Body:
//   {
//     audience: 'all'|'customers'|'technicians',
//     category?: 'promo'|'announcement'|'order'|'arrival',
//     title, body,                              // primary text
//     title_ar?, title_en?, body_ar?, body_en?, // optional bilingual
//     data?, type?, relatedId?
//   }

// @ts-nocheck — Deno runtime
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// category → preference column. Opt-out model: a user is skipped only when they
// have an explicit `false` for that column.
const CATEGORY_PREF: Record<string, string> = {
  promo: 'promotions',
  announcement: 'system_announcements',
  order: 'order_updates',
  arrival: 'technician_arrival',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    const payload = await req.json();
    const {
      audience,
      category,
      title,
      body,
      title_ar,
      title_en,
      body_ar,
      body_en,
      data,
      type,
      relatedId,
    } = payload ?? {};

    // --- Authorization --------------------------------------------------------
    const authHeader = req.headers.get('Authorization') ?? '';
    const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();
    let allowed = bearer === serviceKey; // internal (cron / trigger) caller
    if (!allowed && bearer) {
      try {
        const { data: u } = await admin.auth.getUser(bearer);
        const meta = (u?.user?.app_metadata ?? {}) as Record<string, unknown>;
        const roles = meta.roles;
        allowed =
          meta.is_admin === true || (Array.isArray(roles) && roles.includes('admin'));
      } catch {
        allowed = false;
      }
    }
    if (!allowed) return json({ error: 'forbidden' }, 403);

    if (!audience || !title || !body) {
      return json({ error: 'audience, title and body are required' }, 400);
    }

    // --- Resolve target users -------------------------------------------------
    let q = admin.from('users').select('id, push_token, role');
    if (audience === 'customers') q = q.or('role.eq.customer,role.is.null');
    else if (audience === 'technicians') q = q.eq('role', 'technician');
    const { data: users, error: usersErr } = await q;
    if (usersErr) return json({ error: usersErr.message }, 500);

    const ids = (users ?? []).map((u) => u.id);
    if (ids.length === 0) return json({ sent: 0, failed: 0, inApp: 0, recipients: 0 });

    // --- Preference filtering (opt-out only) ----------------------------------
    const prefCol = category ? CATEGORY_PREF[category] : undefined;
    const prefMap = new Map<string, Record<string, unknown>>();
    {
      const { data: prefs } = await admin
        .from('notification_preferences')
        .select('*')
        .in('user_id', ids);
      for (const p of prefs ?? []) prefMap.set(p.user_id, p);
    }
    const optedOut = (uid: string, col?: string): boolean => {
      if (!col) return false;
      const p = prefMap.get(uid);
      return !!p && p[col] === false;
    };

    const targets = (users ?? []).filter((u) => !optedOut(u.id, prefCol));

    // --- In-app notifications (bell) -----------------------------------------
    const notifType = type ?? (category === 'promo' ? 'promo' : 'general');
    const tAr = title_ar ?? title;
    const tEn = title_en ?? title;
    const bAr = body_ar ?? body;
    const bEn = body_en ?? body;
    let inApp = 0;
    if (targets.length > 0) {
      const rows = targets.map((u) => ({
        user_id: u.id,
        title_ar: tAr,
        title_en: tEn,
        body_ar: bAr,
        body_en: bEn,
        type: notifType,
        related_id: relatedId ?? null,
      }));
      // Insert in chunks to stay within statement limits.
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await admin.from('notifications').insert(rows.slice(i, i + 500));
        if (!error) inApp += Math.min(500, rows.length - i);
        else console.error('notify-segment: in-app insert failed', error.message);
      }
    }

    // --- Push (delegate Expo send to push-dispatch) --------------------------
    const tokens = targets
      .filter((u) => {
        const p = prefMap.get(u.id);
        const pushOff = !!p && p.push_enabled === false;
        return !pushOff && typeof u.push_token === 'string' && u.push_token.length > 0;
      })
      .map((u) => u.push_token as string);

    let sent = 0;
    let failed = 0;
    if (tokens.length > 0) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/push-dispatch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
          },
          body: JSON.stringify({ tokens, title, body, data: data ?? {} }),
        });
        const out = await res.json().catch(() => null);
        sent = out?.sent ?? 0;
        failed = out?.failed ?? 0;
      } catch (e) {
        console.error('notify-segment: push-dispatch call failed', String(e));
      }
    }

    console.log(
      `notify-segment: audience=${audience} category=${category ?? '-'} ` +
        `targets=${targets.length} inApp=${inApp} sent=${sent} failed=${failed}`
    );
    return json({ sent, failed, inApp, recipients: targets.length });
  } catch (e) {
    console.error('notify-segment: unhandled error', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
