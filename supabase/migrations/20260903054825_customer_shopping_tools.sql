create table public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  offer_id uuid not null references public.offers(id) on delete cascade,
  alert_type text not null check (alert_type in ('target_price', 'deal_expiry')),
  target_price numeric(12,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, offer_id, alert_type),
  check ((alert_type = 'target_price' and target_price is not null and target_price >= 0) or (alert_type = 'deal_expiry' and target_price is null))
);

create index price_alerts_profile_active_idx on public.price_alerts(profile_id, is_active, created_at desc);

alter table public.price_alerts enable row level security;
revoke all on public.price_alerts from public, anon;
grant select, insert, update, delete on public.price_alerts to authenticated;

create policy "customers manage own price alerts"
on public.price_alerts for all to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

create policy "customers view own redirect events"
on public.redirect_events for select to authenticated
using (profile_id = (select auth.uid()));
