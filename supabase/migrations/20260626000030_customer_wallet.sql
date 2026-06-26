-- ============================================================================
-- Customer wallet (محفظة العميل) — §15
-- A balance + transaction ledger per customer. Separate from the technician
-- earnings wallet (technician_wallet_entries). Balance is only ever mutated by
-- the SECURITY DEFINER RPC below so it always matches the ledger.
-- ============================================================================
create table if not exists public.wallets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users(id) on delete cascade,
  balance     numeric(12,2) not null default 0 check (balance >= 0),
  updated_at  timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id          uuid primary key default gen_random_uuid(),
  wallet_id   uuid not null references public.wallets(id) on delete cascade,
  type        text not null check (type in ('credit','debit')),
  amount      numeric(12,2) not null check (amount > 0),
  description text,
  order_id    uuid,
  created_at  timestamptz not null default now()
);

create index if not exists wallet_transactions_wallet_idx
  on public.wallet_transactions (wallet_id, created_at desc);

alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;

-- Users may read only their own wallet + ledger. Mutations go through the RPC
-- (SECURITY DEFINER) so there is no client insert/update policy.
drop policy if exists "read_own_wallet" on public.wallets;
create policy "read_own_wallet" on public.wallets
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "read_own_wallet_txns" on public.wallet_transactions;
create policy "read_own_wallet_txns" on public.wallet_transactions
  for select to authenticated
  using (exists (
    select 1 from public.wallets w
    where w.id = wallet_transactions.wallet_id and w.user_id = auth.uid()
  ));

-- ── RPC: apply a credit/debit to the caller's own wallet atomically. ────────
create or replace function public.wallet_add_transaction(
  p_type        text,
  p_amount      numeric,
  p_description text default null,
  p_order_id    uuid default null
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_wallet  uuid;
  v_balance numeric;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  if p_type not in ('credit','debit') then
    raise exception 'invalid transaction type';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  insert into public.wallets (user_id) values (v_user)
    on conflict (user_id) do nothing;

  select id, balance into v_wallet, v_balance
  from public.wallets where user_id = v_user for update;

  if p_type = 'debit' and v_balance < p_amount then
    raise exception 'insufficient wallet balance';
  end if;

  insert into public.wallet_transactions (wallet_id, type, amount, description, order_id)
  values (v_wallet, p_type, p_amount, p_description, p_order_id);

  update public.wallets
    set balance = balance + (case when p_type = 'credit' then p_amount else -p_amount end),
        updated_at = now()
    where id = v_wallet
    returning balance into v_balance;

  return v_balance;
end;
$$;

grant execute on function public.wallet_add_transaction(text, numeric, text, uuid) to authenticated;
