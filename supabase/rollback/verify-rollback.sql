-- ============================================================================
-- VERIFY-ROLLBACK — read-only sanity checks for
-- supabase/rollback/2026_06_13_admin_expansion_down.sql
-- ----------------------------------------------------------------------------
-- ⚠️ Lives OUTSIDE supabase/migrations/ on purpose — it is a diagnostic, not a
--    migration. 100% READ-ONLY: only SELECT / catalog lookups. Safe to run any
--    time (before or after rollback) against the linked DB (psql or SQL editor).
--
-- Each block prints a one-row PASS/FAIL with the expected result in a comment.
-- Run the whole file and scan the "result" column for any FAIL / leftover.
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 1 — BILLING objects should be GONE
-- ════════════════════════════════════════════════════════════════════════════

-- Expected: invoices = PASS, sequence = PASS (both dropped → to_regclass NULL).
select 'invoices table dropped' as check,
       case when to_regclass('public.invoices') is null then 'PASS' else 'FAIL' end as result;

select 'invoice_number_seq dropped' as check,
       case when to_regclass('public.invoice_number_seq') is null then 'PASS' else 'FAIL' end as result;

-- Expected: result = PASS (0 of these functions remain).
select 'billing functions dropped' as check,
       case when count(*) = 0 then 'PASS' else 'FAIL ('||count(*)||' left)' end as result
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('generate_invoice_for_order','_build_invoice_for_order',
                     '_zatca_tlv','next_invoice_number','orders_autoinvoice_after_update');

-- Expected: result = PASS (auto-invoice trigger removed from orders).
select 'orders auto-invoice trigger dropped' as check,
       case when count(*) = 0 then 'PASS' else 'FAIL' end as result
  from pg_trigger
 where tgname = 'trg_orders_autoinvoice' and not tgisinternal;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 2 — ADMIN RBAC objects should be GONE
-- ════════════════════════════════════════════════════════════════════════════

-- Expected: every row result = PASS (each table dropped → to_regclass NULL).
select t as check,
       case when to_regclass('public.'||t) is null then 'PASS' else 'FAIL' end as result
  from unnest(array[
    'admin_permissions','admin_roles','admin_role_permissions',
    'admin_staff','admin_staff_permission_overrides','admin_audit_log'
  ]) as t;

-- Expected: result = PASS (0 of these functions/RPCs remain).
select 'admin rbac functions/RPCs dropped' as check,
       case when count(*) = 0 then 'PASS' else 'FAIL ('||count(*)||' left)' end as result
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('has_admin_permission','my_admin_permissions','_effective_admin_perms',
                     'admin_assign_staff','admin_set_staff_active','admin_remove_staff',
                     'admin_set_permission_override');


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 3 — SUPPORT lifecycle additions should be REVERTED
-- ════════════════════════════════════════════════════════════════════════════

-- Expected: result = PASS (0 of the added columns remain on support_threads).
select 'support_threads new columns dropped' as check,
       case when count(*) = 0 then 'PASS' else 'FAIL ('||string_agg(column_name, ', ')||')' end as result
  from information_schema.columns
 where table_schema = 'public' and table_name = 'support_threads'
   and column_name in ('assigned_admin_id','assigned_at','last_admin_id','auto_reply_sent','internal_note');

-- Expected: result = PASS (status CHECK back to open/closed; no waiting/assigned).
select 'support status CHECK restored' as check,
       case when pg_get_constraintdef(c.oid) not like '%waiting%'
             and pg_get_constraintdef(c.oid) not like '%assigned%'
            then 'PASS' else 'FAIL' end as result
  from pg_constraint c
 where c.conname = 'support_threads_status_check';

-- Expected: result = PASS (no thread left in a now-invalid state).
select 'no orphaned thread statuses' as check,
       case when count(*) = 0 then 'PASS' else 'FAIL ('||count(*)||')' end as result
  from public.support_threads
 where status is not null and status not in ('open','closed');

-- Expected: result = PASS (assignment RPC dropped).
select 'support_assign_thread dropped' as check,
       case when count(*) = 0 then 'PASS' else 'FAIL' end as result
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'support_assign_thread';

-- Expected: result = PASS (the 4 "Support staff …" policies removed).
select 'support staff RLS policies removed' as check,
       case when count(*) = 0 then 'PASS' else 'FAIL ('||count(*)||')' end as result
  from pg_policies
 where schemaname = 'public'
   and tablename in ('support_threads','support_messages')
   and policyname like 'Support staff%';

-- Expected: result = PASS (trigger fn restored: sets status='open', no auto-reply logic).
select 'support_message_after_insert restored' as check,
       case when pg_get_functiondef(p.oid) like '%status     = ''open''%'
             and pg_get_functiondef(p.oid) not like '%auto_reply%'
             and pg_get_functiondef(p.oid) not like '%assigned%'
            then 'PASS' else 'FAIL' end as result
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'support_message_after_insert';


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 4 — is_admin() restored + legacy admin access intact (conceptual)
-- ════════════════════════════════════════════════════════════════════════════

-- Expected: result = PASS (legacy body: reads users.is_admin, no RBAC engine refs).
select 'is_admin() restored to legacy body' as check,
       case when pg_get_functiondef(p.oid) like '%u.is_admin%'
             and pg_get_functiondef(p.oid) not like '%_effective_admin_perms%'
             and pg_get_functiondef(p.oid) not like '%full_admin_access%'
            then 'PASS' else 'FAIL' end as result
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'is_admin';

-- Expected: result = PASS (the legacy admin-read policy still exists, proving
-- existing admin RLS continues to depend on the restored is_admin()).
select 'legacy "Admins read all users" policy present' as check,
       case when exists (
         select 1 from pg_policies
          where schemaname='public' and tablename='users' and policyname='Admins read all users'
       ) then 'PASS' else 'CHECK MANUALLY' end as result;

-- Informational: how many full admins remain (should be UNCHANGED from before —
-- the UP/DOWN never modified users.is_admin). Expected: your original count (>0).
select 'full admins (users.is_admin = true)' as check,
       count(*)::text as result
  from public.users where is_admin = true;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 5 — Intentionally NON-reverted / optional leftovers
-- These are EXPECTED unless you ran the optional cleanup blocks in the down
-- script. They are informational, not failures.
-- ════════════════════════════════════════════════════════════════════════════

-- Expected: 'YES' — sender_id is intentionally left nullable (auto-reply rows).
-- Will be 'NO' only if you ran the optional DELETE + SET NOT NULL block.
select 'support_messages.sender_id nullable (expected YES)' as check,
       is_nullable as result
  from information_schema.columns
 where table_schema='public' and table_name='support_messages' and column_name='sender_id';

-- Expected: count > 0 — invoice settings rows remain unless optional DELETE run.
select 'leftover invoice_* platform_settings (expected >0)' as check,
       count(*)::text as result
  from public.platform_settings where key like 'invoice\_%';

-- Expected: count > 0 — support auto-reply settings remain unless deleted.
select 'leftover support_autoreply_* settings (expected >0)' as check,
       count(*)::text as result
  from public.platform_settings where key like 'support\_autoreply\_%';

-- Expected: count >= 0 — leftover auto-reply messages (now sender_id IS NULL,
-- since is_system was dropped). Non-zero unless you ran the optional DELETE.
select 'leftover auto-reply messages (sender_id IS NULL)' as check,
       count(*)::text as result
  from public.support_messages where sender_id is null;

-- ============================================================================
-- DONE. Sections 1–4 should all read PASS (Section 4 last row = your admin
-- count). Section 5 rows are expected leftovers, not failures.
-- ============================================================================
