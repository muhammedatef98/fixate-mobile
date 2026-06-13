-- ============================================================================
-- ROLLBACK (DOWN) SCRIPT — Admin expansion (Modules 1–3)
-- Reverses: 2026_06_13_admin_rbac.sql
--           2026_06_13_billing_invoices.sql
--           2026_06_13_support_chat_v2.sql
-- ----------------------------------------------------------------------------
-- ⚠️ DO NOT PLACE THIS FILE IN supabase/migrations/. It is an emergency
--    rollback script, NOT a forward migration. Run it manually (psql / SQL
--    editor) only if you must undo the expansion.
--
-- Execution order is the REVERSE of apply order (support → billing → admin),
-- because billing & support policies reference has_admin_permission(), which
-- the admin section removes last.
--
-- Design principles for this script:
--   * Conservative & explicit — no clever tricks. IF EXISTS everywhere.
--   * Only touches objects introduced by the 3 migrations, plus it RESTORES
--     the prior definitions of functions those migrations REDEFINED
--     (is_admin, support_message_after_insert, support_close_thread,
--      support_close_idle_threads).
--   * Avoids touching pre-existing business data except where the UP migration
--     itself wrote to existing tables (clearly flagged below).
--
-- ⚠️ NOT PERFECTLY REVERSIBLE — see the WARNING blocks. Prefer restoring from
--    a pre-push backup / PITR if you need an exact point-in-time state.
-- ============================================================================

begin;

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 1 / 3 — SUPPORT ROLLBACK  (reverses 2026_06_13_support_chat_v2.sql)
-- ════════════════════════════════════════════════════════════════════════════

-- 1.1 Drop the staff RLS policies added by the UP migration.
drop policy if exists "Support staff read threads"   on public.support_threads;
drop policy if exists "Support staff update threads"  on public.support_threads;
drop policy if exists "Support staff read messages"   on public.support_messages;
drop policy if exists "Support staff insert messages" on public.support_messages;

-- 1.2 Drop the new assignment RPC.
drop function if exists public.support_assign_thread(uuid, uuid);

-- 1.3 Restore the PRIOR support_message_after_insert trigger function
--     (version from 2026_05_20_loyalty_admin_support_autoclose.sql).
--     The trigger trg_support_message_insert keeps pointing at it.
create or replace function public.support_message_after_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  update public.support_threads
     set last_message_at = new.created_at,
         unread_for_admin = case when new.is_admin then unread_for_admin else true end,
         unread_for_user  = case when new.is_admin then true else unread_for_user  end,
         status     = 'open',
         closed_at  = null,
         updated_at = new.created_at
   where id = new.thread_id;
  return new;
end;
$$;
revoke execute on function public.support_message_after_insert() from public, anon, authenticated;

-- 1.4 Restore the PRIOR support_close_thread (admin/owner only).
create or replace function public.support_close_thread(p_thread_id uuid, p_reason text default 'manual')
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not (exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin = true)
          or exists (select 1 from public.support_threads t where t.id = p_thread_id and t.user_id = auth.uid())) then
    raise exception 'Not allowed';
  end if;
  update public.support_threads
     set status = 'closed', closed_at = now(), closed_reason = coalesce(p_reason, 'manual')
   where id = p_thread_id and status = 'open';
end;
$$;
grant execute on function public.support_close_thread(uuid, text) to authenticated;

-- 1.5 Restore the PRIOR support_close_idle_threads.
create or replace function public.support_close_idle_threads(idle_minutes integer default 5)
returns integer language plpgsql security definer set search_path = public
as $$
declare affected integer;
begin
  with last_msgs as (
    select distinct on (m.thread_id) m.thread_id, m.is_admin, m.created_at
      from public.support_messages m
      order by m.thread_id, m.created_at desc
  )
  update public.support_threads t
     set status = 'closed', closed_at = now(), closed_reason = 'auto_idle'
    from last_msgs lm
   where t.id = lm.thread_id
     and t.status = 'open'
     and lm.is_admin = false
     and lm.created_at < now() - (idle_minutes || ' minutes')::interval;
  get diagnostics affected = row_count;
  return affected;
end;
$$;
grant execute on function public.support_close_idle_threads(integer) to authenticated;

-- 1.6 ⚠️ DATA MAP (necessary): existing threads now carry status 'waiting' /
--     'assigned' (written by the UP backfill + triggers). The OLD status CHECK
--     only allows 'open' / 'closed', so we MUST collapse the new states back to
--     'open' before re-adding the old constraint. This LOSES the waiting/
--     assigned distinction — it cannot be reconstructed.
update public.support_threads set status = 'open'  where status in ('waiting','assigned');
update public.support_threads set status = 'open'  where status is null;

-- 1.7 Restore the original status CHECK ('open','closed').
alter table public.support_threads drop constraint if exists support_threads_status_check;
alter table public.support_threads
  add constraint support_threads_status_check check (status in ('open','closed'));

-- 1.8 ⚠️ Drop the columns added by the UP migration. Assignment history
--     (who handled / when) is PERMANENTLY LOST here.
alter table public.support_threads
  drop column if exists assigned_admin_id,
  drop column if exists assigned_at,
  drop column if exists last_admin_id,
  drop column if exists auto_reply_sent,
  drop column if exists internal_note;

-- 1.9 support_messages.is_system + nullable sender_id.
--     ⚠️ Auto-reply rows were inserted with is_system = true and sender_id =
--     NULL. We do NOT re-add NOT NULL on sender_id by default, because those
--     rows would violate it. Dropping is_system leaves the auto-reply messages
--     in place as ordinary admin messages (is_admin = true). They remain in
--     the conversation unless you delete them with the OPTIONAL block below.
alter table public.support_messages drop column if exists is_system;

-- OPTIONAL (manual, destructive) — exact reversal of the sender_id NOT NULL
-- constraint. Only run if you accept deleting the auto-reply system messages:
--   DELETE FROM public.support_messages WHERE sender_id IS NULL;
--   ALTER TABLE public.support_messages ALTER COLUMN sender_id SET NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 2 / 3 — BILLING ROLLBACK  (reverses 2026_06_13_billing_invoices.sql)
-- ════════════════════════════════════════════════════════════════════════════

-- 2.1 Remove the auto-invoice trigger on orders (restores prior order behaviour
--     exactly — there was no such trigger before).
drop trigger  if exists trg_orders_autoinvoice on public.orders;
drop function if exists public.orders_autoinvoice_after_update();

-- 2.2 ⚠️ Drop the invoices table. This PERMANENTLY DELETES every invoice —
--     both the rows backfilled from completed orders AND any invoices generated
--     after deploy. They are NOT recoverable except from a backup / PITR.
--     (The underlying orders/payment data is untouched and can regenerate
--     invoices if the UP migration is re-applied.)
drop table if exists public.invoices cascade;

-- 2.3 Drop invoice helper functions + sequence.
drop function if exists public.generate_invoice_for_order(uuid);
drop function if exists public._build_invoice_for_order(uuid);
drop function if exists public._zatca_tlv(text, text, timestamptz, numeric, numeric);
drop function if exists public.next_invoice_number();
drop sequence if exists public.invoice_number_seq;

-- 2.4 OPTIONAL — remove the invoice settings rows added to platform_settings.
--     These are harmless config rows; leaving them does not affect anything.
--     Uncomment to fully clean up:
-- delete from public.platform_settings where key in (
--   'invoice_enabled','invoice_prefix','invoice_company_name','invoice_logo_url',
--   'invoice_vat_number','invoice_cr_number','invoice_address','invoice_email',
--   'invoice_phone','invoice_vat_rate','invoice_prices_include_vat',
--   'invoice_footer','invoice_legal_text');

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 3 / 3 — ADMIN RBAC ROLLBACK  (reverses 2026_06_13_admin_rbac.sql)
-- Run LAST: billing/support policies above referenced has_admin_permission().
-- ════════════════════════════════════════════════════════════════════════════

-- 3.1 Restore the PRIOR is_admin(uid) — the simple users.is_admin lookup
--     (version from 2026_05_09_fix_admin_rls_recursion.sql). This is REQUIRED:
--     every pre-existing admin RLS policy depends on this function continuing
--     to exist.
create or replace function public.is_admin(uid uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce((select u.is_admin from public.users u where u.id = uid), false);
$$;
grant execute on function public.is_admin(uuid) to authenticated, anon, service_role;

-- 3.2 Drop the staff-management RPCs.
drop function if exists public.admin_assign_staff(uuid, text, text);
drop function if exists public.admin_set_staff_active(uuid, boolean);
drop function if exists public.admin_remove_staff(uuid);
drop function if exists public.admin_set_permission_override(uuid, text, text);

-- 3.3 Drop the permission engine functions (after is_admin no longer needs them).
drop function if exists public.my_admin_permissions();
drop function if exists public.has_admin_permission(uuid, text);
drop function if exists public._effective_admin_perms(uuid);

-- 3.4 ⚠️ Drop the RBAC tables. This PERMANENTLY DELETES:
--       * admin_audit_log  — all "who created/changed access" history.
--       * admin_staff / overrides / role assignments — the staff you promoted.
--     Pre-existing admins are UNAFFECTED: their access still comes from
--     users.is_admin (never modified by the UP migration), which the restored
--     is_admin() above honours. Drop in dependency order (children first).
drop table if exists public.admin_staff_permission_overrides cascade;
drop table if exists public.admin_role_permissions          cascade;
drop table if exists public.admin_audit_log                 cascade;
drop table if exists public.admin_staff                     cascade;
drop table if exists public.admin_roles                     cascade;
drop table if exists public.admin_permissions               cascade;

commit;

-- ============================================================================
-- POST-ROLLBACK SANITY CHECKS (run manually after COMMIT):
--   select public.is_admin(auth.uid());                    -- legacy admin = true
--   select count(*) from public.support_threads;           -- unchanged count
--   \d+ public.support_threads                             -- new columns gone
--   select to_regclass('public.invoices');                 -- NULL (dropped)
--   select to_regclass('public.admin_staff');              -- NULL (dropped)
-- ============================================================================
