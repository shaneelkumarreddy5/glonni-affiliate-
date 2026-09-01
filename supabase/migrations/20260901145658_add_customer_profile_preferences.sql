create table public.customer_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  favourite_categories text[] not null default '{}', favourite_stores text[] not null default '{}',
  price_drop_alerts boolean not null default true, deal_expiry_alerts boolean not null default true,
  marketing_updates boolean not null default false, updated_at timestamptz not null default now()
);
create table public.saved_offers (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  offer_id uuid not null references public.offers(id) on delete cascade,
  alert_type text not null default 'price_drop' check (alert_type in ('none', 'price_drop', 'deal_expiry')),
  created_at timestamptz not null default now(), primary key (profile_id, offer_id)
);
create index saved_offers_profile_created_idx on public.saved_offers(profile_id, created_at desc);
alter table public.customer_preferences enable row level security;
alter table public.saved_offers enable row level security;
revoke all on public.customer_preferences, public.saved_offers from public, anon;
grant select, insert, update on public.customer_preferences to authenticated;
grant select, insert, delete on public.saved_offers to authenticated;
create policy "customers manage own preferences" on public.customer_preferences for all to authenticated using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
create policy "customers manage own saved offers" on public.saved_offers for all to authenticated using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
