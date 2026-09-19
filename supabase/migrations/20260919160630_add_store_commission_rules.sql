create table public.store_commission_rules (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  provider_id uuid references public.affiliate_providers(id) on delete restrict,
  provider_commission_percent numeric(7,3) not null check (provider_commission_percent >= 0 and provider_commission_percent <= 100),
  customer_cashback_percent numeric(7,3) not null check (customer_cashback_percent >= 0 and customer_cashback_percent <= provider_commission_percent),
  cashback_cap numeric(12,2) check (cashback_cap is null or cashback_cap >= 0),
  applies_to_descendants boolean not null default false,
  exclusions text,
  effective_from date not null,
  effective_to date,
  status text not null default 'draft' check (status in ('draft','scheduled','active','paused','expired')),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);

create unique index store_commission_rules_scope_provider_start_unique
  on public.store_commission_rules(merchant_id, category_id, coalesce(provider_id, '00000000-0000-0000-0000-000000000000'::uuid), effective_from);
create index store_commission_rules_merchant_status_idx on public.store_commission_rules(merchant_id,status,effective_from desc);
create index store_commission_rules_category_idx on public.store_commission_rules(category_id);

create table public.store_provider_preferences (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,
  selection_mode text not null default 'automatic' check (selection_mode in ('automatic','prefer_provider','manual_only')),
  preferred_provider_id uuid references public.affiliate_providers(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  check ((selection_mode='prefer_provider' and preferred_provider_id is not null) or selection_mode<>'prefer_provider')
);

create unique index store_provider_preferences_scope_unique
  on public.store_provider_preferences(merchant_id, coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid));

alter table public.store_commission_rules enable row level security;
alter table public.store_provider_preferences enable row level security;
revoke all on public.store_commission_rules, public.store_provider_preferences from public, anon;
grant select,insert,update,delete on public.store_commission_rules, public.store_provider_preferences to authenticated;

create policy "aal2 active admins manage store commission rules" on public.store_commission_rules
for all to authenticated
using ((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin') and e.status='active'))
with check ((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin') and e.status='active'));

create policy "aal2 active admins manage store provider preferences" on public.store_provider_preferences
for all to authenticated
using ((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin') and e.status='active'))
with check ((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin') and e.status='active'));

comment on table public.store_commission_rules is 'Provider commission and Glonni customer cashback rules scoped to any catalogue depth for one store.';
comment on table public.store_provider_preferences is 'Internal provider-routing preference for a store globally or for a specific catalogue branch.';
