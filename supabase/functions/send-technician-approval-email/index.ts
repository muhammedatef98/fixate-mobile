// send-technician-approval-email
//
// Sends a one-time "you have been approved" email to a technician after an
// admin approves their registration request (app/admin-verifications.tsx).
//
// Guarantees:
//   - Only an admin caller (JWT app_metadata.is_admin === true, or roles
//     contains "admin") can invoke it.
//   - The email is sent at most ONCE per technician. We atomically claim the
//     send by stamping `technicians.approval_email_sent_at` only when it is
//     still NULL and the row is approved; a second call finds no claimable row
//     and safely no-ops.
//   - If the email provider call fails, we release the claim (reset the stamp
//     to NULL) so a later retry can send it, and we return an error that the
//     caller logs. Approval itself is never blocked by an email failure.
//
// Email transport mirrors the existing `send-otp` function (Resend).

// @ts-nocheck — Deno runtime
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

const APPROVAL_EMAIL_HTML = () => `<!doctype html><html dir="rtl"><body style="font-family:Arial,Tahoma,sans-serif;background:#f9fafb;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <h2 style="color:#10b981;margin:0 0 16px;text-align:center;">تم قبول طلبك كفني في Fixate 🎉</h2>
    <p style="color:#1f2937;font-size:15px;line-height:1.9;margin:0;text-align:right;">
      مرحبًا،<br/>
      يسعدنا إبلاغك بأنه تم قبول طلبك للتسجيل كفني في Fixate.<br/>
      يمكنك الآن تسجيل الدخول والبدء في استخدام المنصة.<br/>
      نشكر لك انضمامك إلينا.
    </p>
    <p style="color:#1f2937;font-size:15px;font-weight:bold;margin:20px 0 0;text-align:right;">فريق Fixate</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
    <p style="color:#9ca3af;text-align:center;font-size:11px;margin:0;">Fixate — منصة صيانة الأجهزة الإلكترونية</p>
  </div>
</body></html>`;

const APPROVAL_SUBJECT = 'تم قبول طلبك كفني في Fixate';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
    const FROM = Deno.env.get('RESEND_FROM') || 'Fixate <onboarding@resend.dev>';

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // ── Authorize: caller must be an admin ──────────────────────────────
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ error: 'Missing authorization' }, 401);

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: 'Invalid session' }, 401);

    const meta = (userData.user.app_metadata ?? {}) as Record<string, unknown>;
    const roles = Array.isArray(meta.roles) ? (meta.roles as unknown[]) : [];
    const isAdmin = meta.is_admin === true || roles.includes('admin');
    if (!isAdmin) return json({ error: 'Forbidden' }, 403);

    // ── Input ───────────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const technicianId = String(body.technicianId ?? '').trim();
    if (!technicianId) return json({ error: 'technicianId is required' }, 400);

    // ── Atomically claim the one-time send ──────────────────────────────
    // Only stamps when the row is approved AND not yet sent. If nothing comes
    // back, the email was already sent (or the row isn't approved) → no-op.
    const { data: claimed, error: claimErr } = await admin
      .from('technicians')
      .update({ approval_email_sent_at: new Date().toISOString() })
      .eq('id', technicianId)
      .eq('verification_status', 'approved')
      .is('approval_email_sent_at', null)
      .select('id, user_id, full_name')
      .maybeSingle();

    if (claimErr) {
      console.error('approval-email claim failed', claimErr.message);
      return json({ error: 'DB error', detail: claimErr.message }, 500);
    }
    if (!claimed) {
      // Already sent or not approved — safe, expected no-op.
      return json({ ok: true, skipped: true });
    }

    // ── Resolve the recipient email ─────────────────────────────────────
    let email = '';
    const { data: urow } = await admin
      .from('users')
      .select('email')
      .eq('id', claimed.user_id)
      .maybeSingle();
    email = String((urow as { email?: string } | null)?.email ?? '').trim();

    if (!email) {
      const { data: authUser } = await admin.auth.admin.getUserById(claimed.user_id);
      email = String(authUser?.user?.email ?? '').trim();
    }

    const releaseClaim = async () => {
      await admin
        .from('technicians')
        .update({ approval_email_sent_at: null })
        .eq('id', technicianId);
    };

    if (!email) {
      await releaseClaim();
      return json({ error: 'Technician email not found' }, 422);
    }

    // ── Send via Resend ─────────────────────────────────────────────────
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        subject: APPROVAL_SUBJECT,
        html: APPROVAL_EMAIL_HTML(),
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      console.error('approval-email send failed', detail);
      await releaseClaim();
      return json({ error: 'Email send failed', detail }, 502);
    }

    return json({ ok: true, sent: true });
  } catch (e) {
    console.error('approval-email unexpected error', (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});
