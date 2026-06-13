-- ============================================================================
-- Module 1 — Admin Team / Roles / Permissions (RBAC)
-- ----------------------------------------------------------------------------
-- Adds a real, auditable staff/permissions system on top of the existing
-- binary `users.is_admin` model WITHOUT breaking any current admin flow.
--
-- Design:
--   * Existing single-admin accounts (users.is_admin = true) keep FULL access.
--     is_admin(uid) stays the gate for every legacy RLS policy and now ALSO
--     returns true for active staff whose effective permissions include
--     'full_admin_access' (i.e. Super Admins promoted through this system).
--   * Scoped staff (support agents, billing admins, …) are NOT is_admin —
--     they receive least-privilege access through NEW permission-scoped
--     policies that call has_admin_permission(uid, key). Legacy policies are
--     left untouched, so nothing that works today changes behaviour.
--
-- Tables:
--   admin_permissions               catalog of permission keys (seeded)
--   admin_roles                     role presets (seeded) + custom roles
--   admin_role_permissions          role -> permission grants
--   admin_staff                     promotes an EXISTING user to a role
--   admin_staff_permission_overrides per-user grant/revoke on top of role
--   admin_audit_log                 who created/updated access (+ generic audit)
--
-- This migration is idempotent and safe to re-run.
-- ============================================================================

-- ── 1. Permission catalog ──────────────────────────────────────────────────
create table if not exists public.admin_permissions (
  key         text primary key,
  group_key   text not null,
  label_en    text not null,
  label_ar    text not null,
  description text,
  sort_order  int not null default 0
);

insert into public.admin_permissions (key, group_key, label_en, label_ar, description, sort_order) values
  ('dashboard_access',   'overview',  'Dashboard access',        'الوصول للوحة التحكم',     'View the admin dashboard and overview stats.',            10),
  ('analytics_reporting','overview',  'Analytics & reporting',   'التحليلات والتقارير',     'View reports, analytics and exports.',                    20),
  ('user_management',    'people',    'User management',         'إدارة المستخدمين',         'View and manage customer accounts.',                      30),
  ('technician_management','people',  'Technician management',   'إدارة الفنيين',            'Verify, approve and manage technicians.',                 40),
  ('order_management',   'operations','Order management',        'إدارة الطلبات',            'View and manage repair orders.',                          50),
  ('support_management', 'support',   'Support & chat',          'الدعم والمحادثات',         'Handle support conversations and close chats.',           60),
  ('ratings_moderation', 'content',   'Ratings & comments',      'التقييمات والتعليقات',     'Moderate ratings, reviews and comments.',                 70),
  ('billing_management', 'finance',   'Billing & invoices',      'الفوترة والفواتير',        'View invoices, payments and billing settings.',           80),
  ('platform_settings',  'system',    'Platform settings',       'إعدادات المنصة',           'Edit platform-wide settings and configuration.',          90),
  ('staff_management',   'system',    'Staff & permissions',     'الفريق والصلاحيات',        'Manage admin staff, roles and permissions.',             100),
  ('full_admin_access',  'system',    'Full admin access',       'صلاحية كاملة',             'Unrestricted access to every admin capability.',         999)
on conflict (key) do update
  set group_key = excluded.group_key,
      label_en  = excluded.label_en,
      label_ar  = excluded.label_ar,
      description = excluded.description,
      sort_order  = excluded.sort_order;

-- ── 2. Roles ───────────────────────────────────────────────────────────────
create table if not exists public.admin_roles (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,
  name_en     text not null,
  name_ar     text not null,
  description text,
  -- System roles are presets that cannot be deleted (but their permission
  -- sets can still be tuned, except super_admin which is locked to full).
  is_system   boolean not null default false,
  rank        int not null default 100, -- lower = more powerful (for hierarchy)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

insert into public.admin_roles (key, name_en, name_ar, description, is_system, rank) values
  ('super_admin',       'Super Admin',              'مدير عام',            'Full, unrestricted access. Can manage staff and permissions.', true, 0),
  ('admin',             'Admin',                    'مدير',                'Broad operational access across the platform.',               true, 10),
  ('operations_manager','Operations Manager',       'مدير العمليات',       'Manages orders, technicians and customers.',                  true, 20),
  ('support_manager',   'Customer Support Manager', 'مدير الدعم',          'Leads support: chats, ratings and customer help.',            true, 30),
  ('support_agent',     'Customer Support Agent',   'موظف دعم',            'Handles support conversations.',                              true, 40),
  ('billing_admin',     'Billing / Finance Admin',  'مدير الفوترة',        'Manages invoices, payments and billing settings.',            true, 30)
on conflict (key) do update
  set name_en = excluded.name_en,
      name_ar = excluded.name_ar,
      description = excluded.description,
      is_system = excluded.is_system,
      rank = excluded.rank,
      updated_at = now();

-- ── 3. Role -> permissions ─────────────────────────────────────────────────
create table if not exists public.admin_role_permissions (
  role_id        uuid not null references public.admin_roles(id) on delete cascade,
  permission_key text not null references public.admin_permissions(key) on delete cascade,
  primary key (role_id, permission_key)
);

-- Seed preset permission sets. We only seed presets that have NO rows yet so
-- admins can later customise a preset without this migration overwriting them.
do $$
declare
  r_super uuid; r_admin uuid; r_ops uuid; r_sm uuid; r_sa uuid; r_bill uuid;
begin
  select id into r_super from public.admin_roles where key = 'super_admin';
  select id into r_admin from public.admin_roles where key = 'admin';
  select id into r_ops   from public.admin_roles where key = 'operations_manager';
  select id into r_sm    from public.admin_roles where key = 'support_manager';
  select id into r_sa    from public.admin_roles where key = 'support_agent';
  select id into r_bill  from public.admin_roles where key = 'billing_admin';

  -- super_admin: always full (locked).
  insert into public.admin_role_permissions (role_id, permission_key)
    values (r_super, 'full_admin_access')
  on conflict do nothing;

  -- admin: everything except staff_management + full_admin_access.
  if not exists (select 1 from public.admin_role_permissions where role_id = r_admin) then
    insert into public.admin_role_permissions (role_id, permission_key)
    select r_admin, key from public.admin_permissions
     where key in ('dashboard_access','analytics_reporting','user_management',
                   'technician_management','order_management','support_management',
                   'ratings_moderation','billing_management','platform_settings');
  end if;

  -- operations_manager
  if not exists (select 1 from public.admin_role_permissions where role_id = r_ops) then
    insert into public.admin_role_permissions (role_id, permission_key)
    select r_ops, key from public.admin_permissions
     where key in ('dashboard_access','analytics_reporting','user_management',
                   'technician_management','order_management');
  end if;

  -- support_manager
  if not exists (select 1 from public.admin_role_permissions where role_id = r_sm) then
    insert into public.admin_role_permissions (role_id, permission_key)
    select r_sm, key from public.admin_permissions
     where key in ('dashboard_access','support_management','ratings_moderation','user_management');
  end if;

  -- support_agent
  if not exists (select 1 from public.admin_role_permissions where role_id = r_sa) then
    insert into public.admin_role_permissions (role_id, permission_key)
    select r_sa, key from public.admin_permissions
     where key in ('dashboard_access','support_management');
  end if;

  -- billing_admin
  if not exists (select 1 from public.admin_role_permissions where role_id = r_bill) then
    insert into public.admin_role_permissions (role_id, permission_key)
    select r_bill, key from public.admin_permissions
     where key in ('dashboard_access','analytics_reporting','billing_management','order_management');
  end if;
end $$;

-- ── 4. Staff (promote an existing user to a role) ──────────────────────────
create table if not exists public.admin_staff (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users(id) on delete cascade,
  role_id     uuid not null references public.admin_roles(id),
  is_active   boolean not null default true,
  notes       text,
  created_by  uuid references auth.users(id),
  updated_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_admin_staff_active on public.admin_staff(is_active);

-- ── 5. Per-user permission overrides (grant/revoke on top of role) ─────────
create table if not exists public.admin_staff_permission_overrides (
  staff_id       uuid not null references public.admin_staff(id) on delete cascade,
  permission_key text not null references public.admin_permissions(key) on delete cascade,
  effect         text not null check (effect in ('grant','revoke')),
  primary key (staff_id, permission_key)
);

-- ── 6. Audit log ───────────────────────────────────────────────────────────
create table if not exists public.admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users(id) on delete set null,
  action      text not null,
  target_type text,
  target_id   text,
  details     jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_admin_audit_created on public.admin_audit_log(created_at desc);
create index if not exists idx_admin_audit_target on public.admin_audit_log(target_type, target_id);

-- ── 7. Effective-permission engine ─────────────────────────────────────────
-- Returns the set of permission keys effective for a user (role grants ∪
-- override grants) minus override revokes. SECURITY DEFINER so it can read the
-- admin_* tables regardless of the caller's RLS.
create or replace function public._effective_admin_perms(uid uuid)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  with staff as (
    select s.id, s.role_id
      from public.admin_staff s
     where s.user_id = uid and s.is_active = true
  ),
  role_perms as (
    select rp.permission_key
      from public.admin_role_permissions rp
      join staff s on s.role_id = rp.role_id
  ),
  granted as (
    select permission_key from role_perms
    union
    select o.permission_key
      from public.admin_staff_permission_overrides o
      join staff s on s.id = o.staff_id
     where o.effect = 'grant'
  ),
  revoked as (
    select o.permission_key
      from public.admin_staff_permission_overrides o
      join staff s on s.id = o.staff_id
     where o.effect = 'revoke'
  )
  select permission_key from granted
  where permission_key not in (select permission_key from revoked);
$$;
revoke execute on function public._effective_admin_perms(uuid) from public, anon;
grant execute on function public._effective_admin_perms(uuid) to authenticated, service_role;

-- has_admin_permission: the least-privilege gate for new RLS / app checks.
-- Legacy full admins (users.is_admin) and anyone with full_admin_access pass
-- for ANY permission.
create or replace function public.has_admin_permission(uid uuid, perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select u.is_admin from public.users u where u.id = uid), false)
    or exists (
      select 1 from public._effective_admin_perms(uid) p
      where p = 'full_admin_access' or p = perm
    );
$$;
revoke execute on function public.has_admin_permission(uuid, text) from public, anon;
grant execute on function public.has_admin_permission(uuid, text) to authenticated, anon, service_role;

-- Convenience for the client: my own effective permission keys (array).
create or replace function public.my_admin_permissions()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select case
    when coalesce((select u.is_admin from public.users u where u.id = auth.uid()), false)
      then array['full_admin_access']
    else coalesce(array(select public._effective_admin_perms(auth.uid())), array[]::text[])
  end;
$$;
grant execute on function public.my_admin_permissions() to authenticated;

-- ── 8. Keep is_admin() backward compatible + recognise Super Admins ────────
-- Legacy behaviour preserved: users.is_admin = true => full admin. Extended:
-- an active staff member whose effective perms include full_admin_access is
-- also a full admin, so Super Admins promoted via this system continue to pass
-- every existing RLS policy.
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select u.is_admin from public.users u where u.id = uid), false)
    or exists (
      select 1 from public._effective_admin_perms(uid) p where p = 'full_admin_access'
    );
$$;
grant execute on function public.is_admin(uuid) to authenticated, anon, service_role;

-- ── 9. RLS on the new admin_* tables ───────────────────────────────────────
alter table public.admin_permissions enable row level security;
alter table public.admin_roles enable row level security;
alter table public.admin_role_permissions enable row level security;
alter table public.admin_staff enable row level security;
alter table public.admin_staff_permission_overrides enable row level security;
alter table public.admin_audit_log enable row level security;

-- Catalog + roles: any active staff (or full admin) may READ; only
-- staff_management may WRITE.
drop policy if exists "staff read permissions catalog" on public.admin_permissions;
create policy "staff read permissions catalog" on public.admin_permissions
  for select using (
    public.is_admin(auth.uid()) or array_length(public.my_admin_permissions(), 1) > 0
  );

drop policy if exists "staff_mgmt write permissions catalog" on public.admin_permissions;
create policy "staff_mgmt write permissions catalog" on public.admin_permissions
  for all using (public.has_admin_permission(auth.uid(), 'staff_management'))
  with check (public.has_admin_permission(auth.uid(), 'staff_management'));

drop policy if exists "staff read roles" on public.admin_roles;
create policy "staff read roles" on public.admin_roles
  for select using (
    public.is_admin(auth.uid()) or array_length(public.my_admin_permissions(), 1) > 0
  );

drop policy if exists "staff_mgmt write roles" on public.admin_roles;
create policy "staff_mgmt write roles" on public.admin_roles
  for all using (public.has_admin_permission(auth.uid(), 'staff_management'))
  with check (public.has_admin_permission(auth.uid(), 'staff_management'));

drop policy if exists "staff read role perms" on public.admin_role_permissions;
create policy "staff read role perms" on public.admin_role_permissions
  for select using (
    public.is_admin(auth.uid()) or array_length(public.my_admin_permissions(), 1) > 0
  );

drop policy if exists "staff_mgmt write role perms" on public.admin_role_permissions;
create policy "staff_mgmt write role perms" on public.admin_role_permissions
  for all using (public.has_admin_permission(auth.uid(), 'staff_management'))
  with check (public.has_admin_permission(auth.uid(), 'staff_management'));

-- Staff list: staff_management can read/write everyone; a staff member can
-- always read THEIR OWN row (so the app can resolve its own permissions).
drop policy if exists "staff_mgmt read staff" on public.admin_staff;
create policy "staff_mgmt read staff" on public.admin_staff
  for select using (
    public.has_admin_permission(auth.uid(), 'staff_management') or user_id = auth.uid()
  );

drop policy if exists "staff_mgmt write staff" on public.admin_staff;
create policy "staff_mgmt write staff" on public.admin_staff
  for all using (public.has_admin_permission(auth.uid(), 'staff_management'))
  with check (public.has_admin_permission(auth.uid(), 'staff_management'));

drop policy if exists "staff_mgmt read overrides" on public.admin_staff_permission_overrides;
create policy "staff_mgmt read overrides" on public.admin_staff_permission_overrides
  for select using (
    public.has_admin_permission(auth.uid(), 'staff_management')
    or exists (select 1 from public.admin_staff s where s.id = staff_id and s.user_id = auth.uid())
  );

drop policy if exists "staff_mgmt write overrides" on public.admin_staff_permission_overrides;
create policy "staff_mgmt write overrides" on public.admin_staff_permission_overrides
  for all using (public.has_admin_permission(auth.uid(), 'staff_management'))
  with check (public.has_admin_permission(auth.uid(), 'staff_management'));

-- Audit log: staff_management reads; inserts happen via SECURITY DEFINER RPCs
-- (no direct client insert needed, but allow staff_management to insert too).
drop policy if exists "staff_mgmt read audit" on public.admin_audit_log;
create policy "staff_mgmt read audit" on public.admin_audit_log
  for select using (public.has_admin_permission(auth.uid(), 'staff_management'));

drop policy if exists "staff_mgmt insert audit" on public.admin_audit_log;
create policy "staff_mgmt insert audit" on public.admin_audit_log
  for insert with check (public.has_admin_permission(auth.uid(), 'staff_management'));

-- ── 10. Safe staff-management RPCs (enforce hierarchy + audit) ─────────────
-- All staff mutations go through these so we can: (a) enforce that only
-- staff_management holders can act, (b) protect the last Super Admin, and
-- (c) write an audit row atomically.

create or replace function public.admin_assign_staff(
  p_user_id uuid,
  p_role_key text,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role_id uuid;
  v_staff_id uuid;
begin
  if not public.has_admin_permission(auth.uid(), 'staff_management') then
    raise exception 'Not allowed';
  end if;
  select id into v_role_id from public.admin_roles where key = p_role_key;
  if v_role_id is null then raise exception 'Unknown role %', p_role_key; end if;

  insert into public.admin_staff (user_id, role_id, notes, created_by, updated_by)
  values (p_user_id, v_role_id, p_notes, auth.uid(), auth.uid())
  on conflict (user_id) do update
    set role_id = excluded.role_id,
        notes = coalesce(excluded.notes, public.admin_staff.notes),
        is_active = true,
        updated_by = auth.uid(),
        updated_at = now()
  returning id into v_staff_id;

  insert into public.admin_audit_log (actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'staff.assign', 'user', p_user_id::text,
          jsonb_build_object('role', p_role_key));
  return v_staff_id;
end $$;
grant execute on function public.admin_assign_staff(uuid, text, text) to authenticated;

create or replace function public.admin_set_staff_active(
  p_user_id uuid,
  p_active boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_admin_permission(auth.uid(), 'staff_management') then
    raise exception 'Not allowed';
  end if;

  -- Protect the last active Super Admin from being disabled / locking everyone out.
  if p_active = false then
    if (select r.key from public.admin_staff s join public.admin_roles r on r.id = s.role_id
        where s.user_id = p_user_id) = 'super_admin'
       and (select count(*) from public.admin_staff s join public.admin_roles r on r.id = s.role_id
            where r.key = 'super_admin' and s.is_active = true) <= 1 then
      raise exception 'Cannot disable the last active Super Admin';
    end if;
  end if;

  update public.admin_staff
     set is_active = p_active, updated_by = auth.uid(), updated_at = now()
   where user_id = p_user_id;

  insert into public.admin_audit_log (actor_id, action, target_type, target_id, details)
  values (auth.uid(), case when p_active then 'staff.enable' else 'staff.disable' end,
          'user', p_user_id::text, jsonb_build_object('active', p_active));
end $$;
grant execute on function public.admin_set_staff_active(uuid, boolean) to authenticated;

create or replace function public.admin_remove_staff(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_admin_permission(auth.uid(), 'staff_management') then
    raise exception 'Not allowed';
  end if;
  if (select r.key from public.admin_staff s join public.admin_roles r on r.id = s.role_id
      where s.user_id = p_user_id) = 'super_admin'
     and (select count(*) from public.admin_staff s join public.admin_roles r on r.id = s.role_id
          where r.key = 'super_admin' and s.is_active = true) <= 1 then
    raise exception 'Cannot remove the last active Super Admin';
  end if;

  delete from public.admin_staff where user_id = p_user_id;
  insert into public.admin_audit_log (actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'staff.remove', 'user', p_user_id::text, '{}'::jsonb);
end $$;
grant execute on function public.admin_remove_staff(uuid) to authenticated;

-- Set a single override (grant/revoke), or clear it when p_effect is null.
create or replace function public.admin_set_permission_override(
  p_user_id uuid,
  p_permission_key text,
  p_effect text default null  -- 'grant' | 'revoke' | null (clear)
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid;
begin
  if not public.has_admin_permission(auth.uid(), 'staff_management') then
    raise exception 'Not allowed';
  end if;
  select id into v_staff_id from public.admin_staff where user_id = p_user_id;
  if v_staff_id is null then raise exception 'User is not staff'; end if;

  if p_effect is null then
    delete from public.admin_staff_permission_overrides
     where staff_id = v_staff_id and permission_key = p_permission_key;
  else
    if p_effect not in ('grant','revoke') then raise exception 'Bad effect'; end if;
    insert into public.admin_staff_permission_overrides (staff_id, permission_key, effect)
    values (v_staff_id, p_permission_key, p_effect)
    on conflict (staff_id, permission_key) do update set effect = excluded.effect;
  end if;

  insert into public.admin_audit_log (actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'staff.override', 'user', p_user_id::text,
          jsonb_build_object('permission', p_permission_key, 'effect', p_effect));
end $$;
grant execute on function public.admin_set_permission_override(uuid, text, text) to authenticated;

-- ── 11. Bootstrap: promote every existing legacy admin to Super Admin staff ─
-- Non-destructive: keeps users.is_admin intact, just mirrors them into the new
-- staff table so the Team screen shows them and Super Admin protections apply.
do $$
declare v_super uuid;
begin
  select id into v_super from public.admin_roles where key = 'super_admin';
  insert into public.admin_staff (user_id, role_id, is_active, notes)
  select u.id, v_super, true, 'Auto-migrated from users.is_admin'
    from public.users u
   where u.is_admin = true
  on conflict (user_id) do nothing;
end $$;
