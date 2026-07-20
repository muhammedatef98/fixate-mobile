-- Applied to remote as consolidate_permissive_policies_2026_07_20.
--
-- Merge permissive policies that share (table, cmd, roles) into one policy
-- (advisor: multiple_permissive_policies, 232 -> 147; 50 policies -> 20 merged).
-- PostgreSQL ORs permissive policies: USING exprs OR together and WITH CHECK
-- exprs OR together, independently (not paired per policy). For UPDATE, a
-- policy without WITH CHECK uses its USING as the check, so the merged check
-- ORs coalesce(with_check, qual). Result is semantically identical.
--
-- Remaining 147 warnings are cross-shape overlaps (FOR ALL admin policies
-- overlapping cmd-specific ones, and {public} vs {authenticated} role sets) —
-- deferred deliberately: merging those changes policy shape and needs
-- per-table review.
do $$
declare
  g record;
  p record;
  q_parts text[];
  wc_parts text[];
  has_explicit_wc boolean;
  merged_name text;
  ddl text;
begin
  for g in
    select tablename, cmd, roles
    from pg_policies
    where schemaname = 'public' and permissive = 'PERMISSIVE'
    group by tablename, cmd, roles
    having count(*) > 1
  loop
    q_parts := '{}';
    wc_parts := '{}';
    has_explicit_wc := false;

    for p in
      select policyname, qual, with_check
      from pg_policies
      where schemaname = 'public' and permissive = 'PERMISSIVE'
        and tablename = g.tablename and cmd = g.cmd and roles = g.roles
      order by policyname
    loop
      if p.qual is not null then
        q_parts := q_parts || format('(%s)', p.qual);
      end if;
      if p.with_check is not null then
        has_explicit_wc := true;
      end if;
      if g.cmd in ('INSERT','UPDATE','ALL') then
        wc_parts := wc_parts || format('(%s)', coalesce(p.with_check, p.qual));
      end if;
      execute format('drop policy %I on public.%I', p.policyname, g.tablename);
    end loop;

    merged_name := format('%s_%s_merged', g.tablename, lower(g.cmd));
    ddl := format('create policy %I on public.%I as permissive for %s to %s',
      merged_name, g.tablename, g.cmd, array_to_string(g.roles, ', '));

    if g.cmd in ('SELECT','DELETE') then
      ddl := ddl || format(' using (%s)', array_to_string(q_parts, ' OR '));
    elsif g.cmd = 'INSERT' then
      ddl := ddl || format(' with check (%s)', array_to_string(wc_parts, ' OR '));
    elsif g.cmd = 'UPDATE' then
      ddl := ddl || format(' using (%s)', array_to_string(q_parts, ' OR '));
      if has_explicit_wc then
        ddl := ddl || format(' with check (%s)', array_to_string(wc_parts, ' OR '));
      end if;
    else
      raise exception 'unhandled cmd % on %', g.cmd, g.tablename;
    end if;

    execute ddl;
  end loop;
end $$;
