-- Registry for payment gateways used by paid voucher and bill-payment checkout.
-- Provider credentials are never stored in this exposed table; adapters use server-side secrets.
create table public.payment_provider_configs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 100),
  provider_key text not null unique check (provider_key ~ '^[a-z0-9][a-z0-9_-]{1,79}$'),
  services text[] not null check (
    cardinality(services) > 0
    and services <@ array['voucher_purchase','bill_payment']::text[]
  ),
  priority integer not null default 100 check (priority between 1 and 9999),
  enabled boolean not null default false,
  adapter_status text not null default 'not_implemented'
    check (adapter_status in ('not_implemented','sandbox','live_ready','error')),
  credential_status text not null default 'missing'
    check (credential_status in ('missing','sandbox_configured','live_verified')),
  last_health_check_at timestamptz,
  last_health_check_status text not null default 'not_checked'
    check (last_health_check_status in ('not_checked','healthy','unhealthy')),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint enabled_provider_is_live_ready check (
    not enabled or (adapter_status = 'live_ready'
      and credential_status = 'live_verified'
      and last_health_check_status = 'healthy')
  )
);

create index payment_provider_enabled_priority_idx
  on public.payment_provider_configs (priority, created_at)
  where enabled = true;

alter table public.payment_provider_configs enable row level security;
revoke all on public.payment_provider_configs from public, anon, authenticated;
grant select, insert, update on public.payment_provider_configs to authenticated;

create policy "verified admins read payment provider configs"
on public.payment_provider_configs for select to authenticated
using (
  (select auth.jwt() ->> 'aal') = 'aal2'
  and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin')
);

create policy "verified admins insert payment provider configs"
on public.payment_provider_configs for insert to authenticated
with check (
  (select auth.jwt() ->> 'aal') = 'aal2'
  and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin')
);

create policy "verified admins update payment provider configs"
on public.payment_provider_configs for update to authenticated
using (
  (select auth.jwt() ->> 'aal') = 'aal2'
  and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin')
)
with check (
  (select auth.jwt() ->> 'aal') = 'aal2'
  and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin')
);

comment on table public.payment_provider_configs is
  'Non-secret registry for payment gateway providers. Provider adapter credentials belong in server-side secrets. Only live-ready, credential-verified, healthy adapters can be enabled.';
