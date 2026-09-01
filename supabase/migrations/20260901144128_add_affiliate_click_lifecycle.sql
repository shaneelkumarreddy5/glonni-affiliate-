-- Preserve the approved Product -> Offer -> Merchant -> Affiliate Provider model
-- through the outbound click and future provider-conversion lifecycle.
alter table public.redirect_events
  add column if not exists profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists provider_id uuid references public.affiliate_providers(id) on delete set null,
  add column if not exists click_token uuid not null default gen_random_uuid();

create unique index if not exists redirect_events_click_token_idx on public.redirect_events(click_token);
create index if not exists redirect_events_profile_created_idx on public.redirect_events(profile_id, created_at desc);
create index if not exists redirect_events_provider_created_idx on public.redirect_events(provider_id, created_at desc);

create table public.referral_conversions (
  id uuid primary key default gen_random_uuid(),
  redirect_event_id uuid references public.redirect_events(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  offer_id uuid not null references public.offers(id) on delete restrict,
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  provider_id uuid references public.affiliate_providers(id) on delete set null,
  provider_order_reference text,
  status text not null default 'clicked' check (status in ('clicked', 'pending', 'confirmed', 'rejected', 'cancelled')),
  order_value numeric(12,2), commission_amount numeric(12,2), cashback_amount numeric(12,2),
  cashback_eligible boolean not null default false,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create unique index referral_conversions_provider_order_idx on public.referral_conversions(provider_id, provider_order_reference) where provider_order_reference is not null;
create index referral_conversions_profile_status_idx on public.referral_conversions(profile_id, status, created_at desc);
create index referral_conversions_offer_status_idx on public.referral_conversions(offer_id, status, created_at desc);

alter table public.referral_conversions enable row level security;
revoke all on public.referral_conversions from public, anon;
grant select on public.referral_conversions to authenticated;

drop policy if exists "active offer redirect events can be recorded" on public.redirect_events;
create policy "safe active offer redirect events can be recorded" on public.redirect_events for insert to anon, authenticated
with check (
  exists (select 1 from public.offers where offers.id = redirect_events.offer_id and offers.merchant_id = redirect_events.merchant_id and offers.status = 'active')
  and (profile_id is null or profile_id = (select auth.uid()))
);

create policy "customers view own referral lifecycle" on public.referral_conversions for select to authenticated using (profile_id = (select auth.uid()));
create policy "admins manage referral lifecycle" on public.referral_conversions for all to authenticated
using ((select role from public.profiles where id = (select auth.uid())) in ('owner', 'admin', 'editor'))
with check ((select role from public.profiles where id = (select auth.uid())) in ('owner', 'admin', 'editor'));
