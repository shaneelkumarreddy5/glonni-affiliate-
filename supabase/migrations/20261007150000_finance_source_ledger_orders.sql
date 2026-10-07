-- Step 3: source-linked finance ledger and voucher/bill payment order records.
-- The union view preserves each lifecycle record separately; it must not be
-- blindly summed across source types.

create table public.commerce_finance_orders (
  id uuid primary key default gen_random_uuid(),
  order_reference text not null unique default ('GLN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  order_kind text not null check (order_kind in ('voucher_purchase','bill_payment')),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  catalog_item_id uuid references public.voucher_catalog_items(id) on delete set null,
  fulfilment_provider_key text,
  payment_provider_key text references public.payment_provider_configs(provider_key) on update cascade on delete restrict,
  provider_order_reference text,
  payment_reference text,
  provider_invoice_number text,
  provider_invoice_date date,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  payment_status text not null default 'pending'
    check (payment_status in ('pending','authorized','paid','failed','partially_refunded','refunded')),
  fulfilment_status text not null default 'pending'
    check (fulfilment_status in ('pending','processing','fulfilled','failed','reversed')),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','provider_verified','reconciled','rejected')),
  tax_code_version_id uuid references public.tax_code_versions(id) on delete restrict,
  record_source text not null default 'admin_manual'
    check (record_source in ('admin_manual','checkout_callback','provider_import')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (provider_invoice_date is null or provider_invoice_number is not null)
);

create unique index commerce_finance_provider_order_ref_idx
  on public.commerce_finance_orders (fulfilment_provider_key, provider_order_reference)
  where provider_order_reference is not null;

create index commerce_finance_orders_customer_idx
  on public.commerce_finance_orders (profile_id, created_at desc);
create index commerce_finance_orders_status_idx
  on public.commerce_finance_orders (payment_status, fulfilment_status, created_at desc);

create table public.commerce_finance_order_audit (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.commerce_finance_orders(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in ('insert','update')),
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create index commerce_finance_order_audit_order_idx
  on public.commerce_finance_order_audit (order_id, created_at desc);

alter table public.commerce_finance_orders enable row level security;
alter table public.commerce_finance_order_audit enable row level security;
revoke all on public.commerce_finance_orders from public, anon, authenticated;
revoke all on public.commerce_finance_order_audit from public, anon, authenticated;
grant select, insert, update on public.commerce_finance_orders to authenticated;
grant select on public.commerce_finance_order_audit to authenticated;

create policy "customers read own commerce finance orders"
on public.commerce_finance_orders for select to authenticated
using (profile_id = (select auth.uid()));

create policy "active aal2 admins read all commerce finance orders"
on public.commerce_finance_orders for select to authenticated
using (
  (select auth.jwt() ->> 'aal') = 'aal2'
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role::text in ('owner','admin'))
  and exists (select 1 from public.employees e where e.profile_id = (select auth.uid()) and e.status = 'active')
);
create policy "active aal2 admins insert commerce finance orders"
on public.commerce_finance_orders for insert to authenticated
with check (
  (select auth.jwt() ->> 'aal') = 'aal2'
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role::text in ('owner','admin'))
  and exists (select 1 from public.employees e where e.profile_id = (select auth.uid()) and e.status = 'active')
);
create policy "active aal2 admins update commerce finance orders"
on public.commerce_finance_orders for update to authenticated
using (
  (select auth.jwt() ->> 'aal') = 'aal2'
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role::text in ('owner','admin'))
  and exists (select 1 from public.employees e where e.profile_id = (select auth.uid()) and e.status = 'active')
)
with check (
  (select auth.jwt() ->> 'aal') = 'aal2'
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role::text in ('owner','admin'))
  and exists (select 1 from public.employees e where e.profile_id = (select auth.uid()) and e.status = 'active')
);

create policy "customers read own commerce finance order audit"
on public.commerce_finance_order_audit for select to authenticated
using (
  exists (select 1 from public.commerce_finance_orders o where o.id = order_id and o.profile_id = (select auth.uid()))
);
create policy "active aal2 admins read commerce finance order audit"
on public.commerce_finance_order_audit for select to authenticated
using (
  (select auth.jwt() ->> 'aal') = 'aal2'
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role::text in ('owner','admin'))
  and exists (select 1 from public.employees e where e.profile_id = (select auth.uid()) and e.status = 'active')
);

create or replace function private.audit_commerce_finance_order_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.commerce_finance_order_audit (
    order_id, actor_id, event_type, before_data, after_data
  ) values (
    coalesce(NEW.id, OLD.id),
    auth.uid(),
    lower(TG_OP),
    case when TG_OP = 'INSERT' then null else to_jsonb(OLD) end,
    case when TG_OP = 'DELETE' then null else to_jsonb(NEW) end
  );
  return NEW;
end;
$$;
revoke all on function private.audit_commerce_finance_order_change() from public, anon, authenticated;

create trigger commerce_finance_order_audit_trigger
after insert or update on public.commerce_finance_orders
for each row execute function private.audit_commerce_finance_order_change();

create view public.finance_tax_source_ledger
with (security_invoker = true)
as
  select
    'affiliate_conversion'::text as source_type,
    c.id as source_id,
    c.redirect_event_id as related_source_id,
    c.occurred_at as occurred_at,
    c.profile_id,
    c.merchant_id,
    c.provider_id as affiliate_provider_id,
    c.provider_order_reference as source_reference,
    c.status::text as source_status,
    c.currency,
    c.order_value::numeric as order_value,
    c.commission_amount::numeric as commission_amount,
    c.cashback_amount::numeric as cashback_amount,
    c.commission_amount::numeric as source_amount
  from public.referral_conversions c

  union all

  select
    'cashback_award'::text, a.id, a.conversion_id, a.created_at, a.profile_id,
    null::uuid, null::uuid, null::text, a.status::text, a.currency,
    null::numeric, null::numeric, a.amount::numeric, a.amount::numeric
  from public.cashback_awards a

  union all

  select
    'wallet_entry'::text, w.id, coalesce(w.award_id, w.payout_item_id), w.created_at, w.profile_id,
    null::uuid, null::uuid, null::text, w.entry_type::text, 'INR'::text,
    null::numeric, null::numeric, null::numeric, w.amount::numeric
  from public.wallet_entries w

  union all

  select
    'withdrawal_request'::text, r.id, null::uuid, r.created_at, r.profile_id,
    null::uuid, null::uuid, null::text, r.status::text, 'INR'::text,
    null::numeric, null::numeric, null::numeric, r.amount::numeric
  from public.withdrawal_requests r

  union all

  select
    'payout_batch'::text, b.id, null::uuid, b.created_at, null::uuid,
    null::uuid, null::uuid, b.batch_reference::text, b.status::text, b.currency,
    null::numeric, null::numeric, null::numeric, b.total_amount::numeric
  from public.payout_batches b

  union all

  select
    'payout_item'::text, i.id, i.withdrawal_id, i.created_at, i.profile_id,
    null::uuid, null::uuid, i.provider_payout_reference::text, i.status::text, i.currency,
    null::numeric, null::numeric, null::numeric, i.amount::numeric
  from public.payout_items i

  union all

  select
    'payout_event'::text, e.id, e.payout_item_id, e.created_at, null::uuid,
    null::uuid, null::uuid, e.provider_reference::text, e.event_type::text, null::text,
    null::numeric, null::numeric, null::numeric, null::numeric
  from public.payout_events e

  union all

  select
    'voucher_bill_order'::text, o.id, o.catalog_item_id, o.created_at, o.profile_id,
    null::uuid, null::uuid, coalesce(o.provider_order_reference, o.payment_reference, o.order_reference),
    (o.payment_status || '/' || o.fulfilment_status || '/' || o.verification_status)::text,
    o.currency, o.amount::numeric, null::numeric, null::numeric, o.amount::numeric
  from public.commerce_finance_orders o;

revoke all on public.finance_tax_source_ledger from public, anon, authenticated;
grant select on public.finance_tax_source_ledger to authenticated;

comment on view public.finance_tax_source_ledger is
  'Live, source-linked lifecycle records for Finance & Tax review. Rows represent different stages (conversion, cashback, wallet, withdrawal, payout) and must not be summed across source types.';
comment on table public.commerce_finance_orders is
  'Order-level records for voucher purchases and bill payments. Current checkout/provider integrations do not yet populate this table automatically; verified callbacks or imports will be connected in a later integration step.';
