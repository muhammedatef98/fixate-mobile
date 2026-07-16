-- Courier ratings: the customer rates the courier once per completed
-- delivery leg. Read by the courier (own average) and the customer (own rows).
-- Applied to the hosted project on 2026-07-16 via MCP apply_migration.
create table if not exists public.courier_ratings (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.delivery_tasks(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  courier_id uuid not null,
  customer_id uuid not null,
  stars int not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  unique (task_id, customer_id)
);

alter table public.courier_ratings enable row level security;

create policy "customer rates own completed delivery" on public.courier_ratings
  for insert with check (
    auth.uid() = customer_id
    and exists (
      select 1
      from public.delivery_tasks t
      join public.orders o on o.id = t.order_id
      where t.id = courier_ratings.task_id
        and t.order_id = courier_ratings.order_id
        and t.courier_id = courier_ratings.courier_id
        and t.status = 'completed'
        and o.user_id = auth.uid()
    )
  );

create policy "customer reads own courier ratings" on public.courier_ratings
  for select using (auth.uid() = customer_id);

create policy "courier reads own ratings" on public.courier_ratings
  for select using (auth.uid() = courier_id);

create policy "admins read courier ratings" on public.courier_ratings
  for select using (public.is_admin(auth.uid()));
