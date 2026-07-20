-- Comprehensive audit pass (2026-07-20). Applied to remote as perf_security_audit_2026_07_20.
--
-- 1) RLS initplan fix: wrap auth.uid()/auth.jwt()/auth.role() in scalar
--    subqueries so they evaluate once per query instead of once per row
--    (Supabase advisor: auth_rls_initplan, ~179 policies). Semantics unchanged.
-- 2) Index all unindexed foreign keys (advisor: unindexed_foreign_keys, 32 FKs).
-- 3) Revoke EXECUTE on trigger-only SECURITY DEFINER functions from client
--    roles (advisor: anon/authenticated_security_definer_function_executable).
--    Trigger firing does not require EXECUTE for the caller.

do $$
declare
  r record;
  q text;
  wc text;
  ddl text;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual,'') ~ 'auth\.(uid|jwt|role)\(\)'
        or coalesce(with_check,'') ~ 'auth\.(uid|jwt|role)\(\)')
  loop
    q := r.qual;
    wc := r.with_check;

    if q is not null then
      q := replace(q, '( SELECT auth.uid() AS uid)', '@@U@@');
      q := replace(q, '( SELECT auth.jwt() AS jwt)', '@@J@@');
      q := replace(q, '( SELECT auth.role() AS role)', '@@R@@');
      q := replace(q, 'auth.uid()', '(select auth.uid())');
      q := replace(q, 'auth.jwt()', '(select auth.jwt())');
      q := replace(q, 'auth.role()', '(select auth.role())');
      q := replace(q, '@@U@@', '( SELECT auth.uid() AS uid)');
      q := replace(q, '@@J@@', '( SELECT auth.jwt() AS jwt)');
      q := replace(q, '@@R@@', '( SELECT auth.role() AS role)');
    end if;

    if wc is not null then
      wc := replace(wc, '( SELECT auth.uid() AS uid)', '@@U@@');
      wc := replace(wc, '( SELECT auth.jwt() AS jwt)', '@@J@@');
      wc := replace(wc, '( SELECT auth.role() AS role)', '@@R@@');
      wc := replace(wc, 'auth.uid()', '(select auth.uid())');
      wc := replace(wc, 'auth.jwt()', '(select auth.jwt())');
      wc := replace(wc, 'auth.role()', '(select auth.role())');
      wc := replace(wc, '@@U@@', '( SELECT auth.uid() AS uid)');
      wc := replace(wc, '@@J@@', '( SELECT auth.jwt() AS jwt)');
      wc := replace(wc, '@@R@@', '( SELECT auth.role() AS role)');
    end if;

    ddl := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if q is not null and q is distinct from r.qual then
      ddl := ddl || format(' using (%s)', q);
    end if;
    if wc is not null and wc is distinct from r.with_check then
      ddl := ddl || format(' with check (%s)', wc);
    end if;
    if ddl like '%using%' or ddl like '%with check%' then
      execute ddl;
    end if;
  end loop;
end $$;

do $$
declare
  r record;
begin
  for r in
    select c.conrelid::regclass::text as tbl,
           (select string_agg(quote_ident(a.attname), ',' order by k.ord)
              from unnest(c.conkey) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as cols,
           c.conname
    from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
    where c.contype = 'f' and n.nspname = 'public'
      and not exists (
        select 1 from pg_index i
        where i.indrelid = c.conrelid
          and (i.indkey::int2[])[0:array_length(c.conkey,1)-1] = c.conkey
      )
  loop
    execute format('create index if not exists %I on %s (%s)',
      'idx_fk_' || md5(r.tbl || r.conname), r.tbl, r.cols);
  end loop;
end $$;

revoke execute on function public.broadcast_order_unavailable() from public, anon, authenticated;
revoke execute on function public.bump_courier_total_deliveries() from public, anon, authenticated;
revoke execute on function public.community_bump_comment_likes() from public, anon, authenticated;
revoke execute on function public.community_bump_comments() from public, anon, authenticated;
revoke execute on function public.community_bump_likes() from public, anon, authenticated;
revoke execute on function public.community_bump_reports() from public, anon, authenticated;
revoke execute on function public.log_delivery_task_change() from public, anon, authenticated;
revoke execute on function public.log_order_status_change() from public, anon, authenticated;
revoke execute on function public.notify_verification_review() from public, anon, authenticated;
revoke execute on function public.on_new_user_automation() from public, anon, authenticated;
revoke execute on function public.sync_user_public_card() from public, anon, authenticated;
revoke execute on function public.tg_user_verifications_propagate() from public, anon, authenticated;
