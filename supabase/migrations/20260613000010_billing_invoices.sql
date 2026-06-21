-- ============================================================================
-- Module 2 — Billing / Invoices
-- ----------------------------------------------------------------------------
-- Persisted, immutable invoice snapshots + sequential numbering + ZATCA
-- (Saudi e-invoice Phase 1, simplified) friendly fields. The DB is the source
-- of truth; the PDF is regenerated on demand from this data (see
-- services/invoicePdf.ts). Invoice branding lives in platform_settings so it
-- is edited from admin without an app release.
--
-- Additive + idempotent. No existing table is altered destructively.
-- ============================================================================

-- ── 1. Invoice branding / settings (reuse platform_settings) ───────────────
insert into public.platform_settings (key, value, description) values
  ('invoice_enabled',     'true',                          'Master switch for invoice generation and customer downloads.'),
  ('invoice_prefix',      '"INV"',                         'Prefix for generated invoice numbers, e.g. INV-2026-000123.'),
  ('invoice_company_name','"Fixate"',                      'Legal/business name shown on invoices (seller name).'),
  ('invoice_logo_url',    '""',                            'Public URL of the logo shown on the invoice header.'),
  ('invoice_vat_number',  '""',                            'Seller 15-digit VAT registration number (ZATCA).'),
  ('invoice_cr_number',   '""',                            'Commercial Registration (CR) number.'),
  ('invoice_address',     '"Al Qatif, Eastern Province, Saudi Arabia"', 'Seller business address.'),
  ('invoice_email',       '"fixate01@gmail.com"',          'Seller contact email.'),
  ('invoice_phone',       '""',                            'Seller contact phone.'),
  ('invoice_vat_rate',    '0.15',                          'VAT rate applied/extracted on invoices (KSA standard = 0.15).'),
  ('invoice_prices_include_vat', 'true',                   'When true the order total is treated as VAT-inclusive and VAT is extracted.'),
  ('invoice_footer',      '"شكراً لاستخدامك فيكسات / Thank you for choosing Fixate"', 'Footer line on invoices.'),
  ('invoice_legal_text',  '"هذه فاتورة ضريبية مبسطة. This is a simplified tax invoice."', 'Legal / tax note printed on invoices.')
on conflict (key) do nothing;

-- ── 2. Invoice number sequence ─────────────────────────────────────────────
create sequence if not exists public.invoice_number_seq;

create or replace function public.next_invoice_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_n bigint;
begin
  select coalesce((value #>> '{}'), 'INV') into v_prefix
    from public.platform_settings where key = 'invoice_prefix';
  if v_prefix is null then v_prefix := 'INV'; end if;
  v_n := nextval('public.invoice_number_seq');
  return v_prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(v_n::text, 6, '0');
end $$;
revoke execute on function public.next_invoice_number() from public, anon, authenticated;

-- ── 3. Invoices table (immutable snapshot) ─────────────────────────────────
create table if not exists public.invoices (
  id              uuid primary key default gen_random_uuid(),
  invoice_number  text unique not null,
  order_id        uuid unique references public.orders(id) on delete set null,
  status          text not null default 'issued' check (status in ('issued','paid','void','refunded')),
  issued_at       timestamptz not null default now(),
  currency        text not null default 'SAR',

  -- Customer snapshot
  customer_id      uuid,
  customer_name    text,
  customer_phone   text,
  customer_email   text,
  customer_address text,

  -- Technician snapshot
  technician_id    uuid,
  technician_name  text,
  technician_phone text,

  -- Service / line items
  device_label   text,
  line_items     jsonb not null default '[]'::jsonb,

  -- Money (totals are VAT-inclusive per KSA B2C convention; vat extracted)
  subtotal        numeric not null default 0,   -- net (ex-VAT)
  discount_total  numeric not null default 0,
  vat_rate        numeric not null default 0.15,
  vat_amount      numeric not null default 0,
  total           numeric not null default 0,   -- gross (customer pays)
  platform_commission numeric,

  -- Payment
  payment_method    text,
  payment_status    text,
  payment_reference text,

  -- Seller snapshot (ZATCA)
  seller_name       text,
  seller_vat_number text,
  seller_cr_number  text,
  seller_address    text,

  -- ZATCA QR (base64 TLV) + free text
  zatca_tlv  text,
  notes      text,
  footer     text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_invoices_customer on public.invoices(customer_id);
create index if not exists idx_invoices_issued on public.invoices(issued_at desc);
create index if not exists idx_invoices_status on public.invoices(status);

alter table public.invoices enable row level security;

-- Customer reads their own invoices; billing staff (or full admins) read all.
drop policy if exists "Customers read own invoices" on public.invoices;
create policy "Customers read own invoices" on public.invoices
  for select using (
    customer_id = auth.uid()
    or public.has_admin_permission(auth.uid(), 'billing_management')
  );

-- Status changes (void/refund/mark-paid) only by billing staff. Inserts go
-- through the SECURITY DEFINER generator only (no direct client insert).
drop policy if exists "Billing staff update invoices" on public.invoices;
create policy "Billing staff update invoices" on public.invoices
  for update using (public.has_admin_permission(auth.uid(), 'billing_management'))
  with check (public.has_admin_permission(auth.uid(), 'billing_management'));

-- ── 4. ZATCA TLV builder (tag-length-value, base64) ────────────────────────
-- Phase-1 simplified e-invoice QR payload: seller name, VAT number, ISO
-- timestamp, invoice total (gross), VAT total.
create or replace function public._zatca_tlv(
  p_seller text, p_vat text, p_ts timestamptz, p_total numeric, p_vat_total numeric
) returns text
language plpgsql
immutable
as $$
declare
  out bytea := '\x'::bytea;
  function_add bytea;
  function_field bytea;
  fields text[][] := array[
    array['1', coalesce(p_seller,'')],
    array['2', coalesce(p_vat,'')],
    array['3', to_char(p_ts at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')],
    array['4', trim(to_char(coalesce(p_total,0), 'FM999999990.00'))],
    array['5', trim(to_char(coalesce(p_vat_total,0), 'FM999999990.00'))]
  ];
  i int;
  v_val bytea;
begin
  for i in 1 .. array_length(fields,1) loop
    v_val := convert_to(fields[i][2], 'UTF8');
    out := out
        || set_byte('\x00'::bytea, 0, fields[i][1]::int)            -- tag
        || set_byte('\x00'::bytea, 0, length(v_val))                -- length
        || v_val;                                                   -- value
  end loop;
  return encode(out, 'base64');
end $$;

-- ── 5. Internal builder (no auth check) — used by trigger + public RPC ──────
create or replace function public._build_invoice_for_order(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  o            public.orders%rowtype;
  v_existing   uuid;
  v_id         uuid;
  v_cust       record;
  v_tech       record;
  v_gross      numeric;
  v_net        numeric;
  v_vat_amt    numeric;
  v_vat_rate   numeric;
  v_incl       boolean;
  v_lines      jsonb := '[]'::jsonb;
  v_company    text;
  v_vatnum     text;
  v_crnum      text;
  v_addr       text;
  v_footer     text;
  v_devlabel   text;
  v_repair     numeric;
  v_delivery   numeric;
  v_tlv        text;
begin
  select * into o from public.orders where id = p_order_id;
  if not found then return null; end if;

  -- Idempotent: one invoice per order.
  select id into v_existing from public.invoices where order_id = p_order_id;
  if v_existing is not null then return v_existing; end if;

  -- Settings
  select (value #>> '{}') into v_company  from public.platform_settings where key = 'invoice_company_name';
  select (value #>> '{}') into v_vatnum   from public.platform_settings where key = 'invoice_vat_number';
  select (value #>> '{}') into v_crnum    from public.platform_settings where key = 'invoice_cr_number';
  select (value #>> '{}') into v_addr     from public.platform_settings where key = 'invoice_address';
  select (value #>> '{}') into v_footer   from public.platform_settings where key = 'invoice_footer';
  select coalesce((value #>> '{}')::numeric, 0.15) into v_vat_rate from public.platform_settings where key = 'invoice_vat_rate';
  select coalesce((value #>> '{}')::boolean, true) into v_incl from public.platform_settings where key = 'invoice_prices_include_vat';

  -- Parties
  select name, phone, email into v_cust from public.users where id = o.user_id;
  if o.technician_id is not null then
    select name, phone into v_tech from public.users where id = o.technician_id;
  end if;

  -- Amounts: repair price is the agreed final price (fallback to estimate),
  -- plus delivery fee. Treated as the gross the customer pays.
  v_repair   := coalesce(o.final_price, o.estimated_price, 0);
  v_delivery := coalesce(o.delivery_fee, 0);
  v_gross    := v_repair + v_delivery;
  v_devlabel := trim(coalesce(o.device_brand,'') || ' ' || coalesce(o.device_model,''));

  v_lines := jsonb_build_array(
    jsonb_build_object(
      'labelEn', coalesce(nullif(v_devlabel,''),'Device repair') || ' — repair service',
      'labelAr', 'إصلاح ' || coalesce(nullif(v_devlabel,''),'الجهاز'),
      'qty', 1,
      'unitPrice', v_repair,
      'amount', v_repair
    )
  );
  if v_delivery > 0 then
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'labelEn','Delivery / logistics','labelAr','رسوم التوصيل',
      'qty',1,'unitPrice',v_delivery,'amount',v_delivery));
  end if;

  -- VAT extraction (KSA B2C prices are VAT-inclusive).
  if v_incl and v_vat_rate > 0 then
    v_net     := round(v_gross / (1 + v_vat_rate), 2);
    v_vat_amt := round(v_gross - v_net, 2);
  elsif v_vat_rate > 0 then
    v_net     := v_gross;
    v_vat_amt := round(v_gross * v_vat_rate, 2);
    v_gross   := v_net + v_vat_amt;
  else
    v_net := v_gross; v_vat_amt := 0;
  end if;

  v_tlv := public._zatca_tlv(v_company, v_vatnum, now(), v_gross, v_vat_amt);

  insert into public.invoices (
    invoice_number, order_id, status, currency,
    customer_id, customer_name, customer_phone, customer_email, customer_address,
    technician_id, technician_name, technician_phone,
    device_label, line_items,
    subtotal, discount_total, vat_rate, vat_amount, total, platform_commission,
    payment_method, payment_status, payment_reference,
    seller_name, seller_vat_number, seller_cr_number, seller_address,
    zatca_tlv, footer
  ) values (
    public.next_invoice_number(), p_order_id,
    case when o.payment_status = 'paid' then 'paid' else 'issued' end,
    'SAR',
    o.user_id, v_cust.name, v_cust.phone, v_cust.email, o.address,
    o.technician_id, v_tech.name, v_tech.phone,
    nullif(v_devlabel,''), v_lines,
    v_net, 0, v_vat_rate, v_vat_amt, v_gross, null,
    o.payment_method, o.payment_status, o.payment_reference,
    v_company, v_vatnum, v_crnum, v_addr,
    v_tlv, v_footer
  )
  returning id into v_id;

  return v_id;
end $$;
revoke execute on function public._build_invoice_for_order(uuid) from public, anon, authenticated;
grant execute on function public._build_invoice_for_order(uuid) to service_role;

-- ── 6. Public generator RPC (auth-checked) ─────────────────────────────────
create or replace function public.generate_invoice_for_order(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders%rowtype;
begin
  select * into o from public.orders where id = p_order_id;
  if not found then raise exception 'Order not found'; end if;

  -- Authorization: the order's customer, the assigned technician, billing
  -- staff, or a full admin may generate/fetch the invoice.
  if not (
    o.user_id = auth.uid()
    or o.technician_id = auth.uid()
    or public.has_admin_permission(auth.uid(), 'billing_management')
  ) then
    raise exception 'Not allowed';
  end if;

  -- Only completed orders get an invoice.
  if o.status <> 'completed' then
    raise exception 'Invoice is available only after the order is completed';
  end if;

  return public._build_invoice_for_order(p_order_id);
end $$;
grant execute on function public.generate_invoice_for_order(uuid) to authenticated;

-- ── 7. Auto-generate on order completion (best-effort, never blocks) ───────
create or replace function public.orders_autoinvoice_after_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' and coalesce(old.status,'') <> 'completed' then
    begin
      perform public._build_invoice_for_order(new.id);
    exception when others then
      -- Never block order completion on invoice generation.
      null;
    end;
  end if;
  return new;
end $$;
revoke execute on function public.orders_autoinvoice_after_update() from public, anon, authenticated;

drop trigger if exists trg_orders_autoinvoice on public.orders;
create trigger trg_orders_autoinvoice
  after update on public.orders
  for each row execute function public.orders_autoinvoice_after_update();

-- ── 8. Backfill invoices for already-completed orders ──────────────────────
do $$
declare r record;
begin
  for r in select id from public.orders where status = 'completed' loop
    begin
      perform public._build_invoice_for_order(r.id);
    exception when others then null;
    end;
  end loop;
end $$;
