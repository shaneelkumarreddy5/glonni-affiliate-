-- Customer visibility is independent from provider/payment readiness. Turning a
-- section off hides it without deleting its catalogue or transaction history.
create table public.commerce_visibility (
  id smallint primary key default 1 check (id = 1),
  coupons_enabled boolean not null default true,
  buy_coupons_enabled boolean not null default true,
  bill_payments_enabled boolean not null default true,
  bill_services jsonb not null default '{"mobile_recharge":true,"dth":true,"electricity":true,"gas":true,"water":true,"fastag":true}'::jsonb
    check (jsonb_typeof(bill_services) = 'object'),
  voucher_categories jsonb not null default '{"shopping":true,"food_dining":true,"travel":true,"entertainment":true,"gaming":true}'::jsonb
    check (jsonb_typeof(voucher_categories) = 'object'),
  updated_at timestamptz not null default now()
);

insert into public.commerce_visibility (id) values (1);

alter table public.commerce_visibility enable row level security;
revoke all on public.commerce_visibility from public, anon, authenticated;
grant select on public.commerce_visibility to anon, authenticated;
grant update on public.commerce_visibility to authenticated;

create policy "public reads commerce visibility" on public.commerce_visibility
for select to anon, authenticated using (id = 1);

create policy "verified admins update commerce visibility" on public.commerce_visibility
for update to authenticated
using (id = 1 and (select auth.jwt() ->> 'aal') = 'aal2'
  and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner', 'admin'))
with check (id = 1 and (select auth.jwt() ->> 'aal') = 'aal2'
  and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner', 'admin'));

-- Provider references stay neutral. No credentials or unverified offers are
-- stored here; a future approved adapter can import actual voucher inventory.
create table public.voucher_catalog_items (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null check (length(provider_key) between 1 and 80),
  external_id text not null check (length(external_id) between 1 and 180),
  merchant_name text not null check (length(merchant_name) between 1 and 140),
  title text not null check (length(title) between 1 and 200),
  description text not null default '' check (length(description) <= 1000),
  image_url text check (image_url is null or (length(image_url) <= 1000 and image_url ~ '^https://')),
  category_key text not null check (category_key in ('shopping','food_dining','travel','entertainment','gaming')),
  face_value numeric(12,2) not null check (face_value > 0),
  selling_price numeric(12,2) not null check (selling_price > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  redemption_terms text not null default '' check (length(redemption_terms) <= 4000),
  expires_at timestamptz,
  status text not null default 'draft' check (status in ('draft','active','unavailable')),
  updated_at timestamptz not null default now(),
  unique (provider_key, external_id)
);

create index voucher_catalog_active_category_idx on public.voucher_catalog_items (category_key, merchant_name)
where status = 'active';

alter table public.voucher_catalog_items enable row level security;
revoke all on public.voucher_catalog_items from public, anon, authenticated;
grant select on public.voucher_catalog_items to anon, authenticated;
grant insert, update on public.voucher_catalog_items to authenticated;

create policy "public reads active voucher catalogue" on public.voucher_catalog_items
for select to anon, authenticated using (status = 'active' and (expires_at is null or expires_at > now()));

create policy "verified admins read voucher catalogue" on public.voucher_catalog_items
for select to authenticated using ((select auth.jwt() ->> 'aal') = 'aal2'
  and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner', 'admin'));

create policy "verified admins insert voucher catalogue" on public.voucher_catalog_items
for insert to authenticated with check ((select auth.jwt() ->> 'aal') = 'aal2'
  and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner', 'admin'));

create policy "verified admins update voucher catalogue" on public.voucher_catalog_items
for update to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2'
  and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner', 'admin'))
with check ((select auth.jwt() ->> 'aal') = 'aal2'
  and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner', 'admin'));
