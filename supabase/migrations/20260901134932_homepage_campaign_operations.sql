create table public.homepage_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 120),
  placement text not null check (placement in ('hero','top_deals','trending','price_drops','cashback_picks','collection')),
  device text not null default 'all' check (device in ('desktop','mobile','all')),
  offer_id uuid references public.offers(id) on delete set null,
  image_url text,
  cta_label text,
  display_order integer not null default 99,
  status text not null default 'draft' check (status in ('draft','pending','approved','published','paused','expired')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index homepage_campaigns_status_placement_idx on public.homepage_campaigns(status,placement,display_order);
alter table public.homepage_campaigns enable row level security;
revoke all on public.homepage_campaigns from public, anon;
grant select,insert,update,delete on public.homepage_campaigns to authenticated;
create policy "admins manage homepage campaigns" on public.homepage_campaigns for all to authenticated
using ((select role from public.profiles where id=(select auth.uid())) in ('owner','admin','editor'))
with check ((select role from public.profiles where id=(select auth.uid())) in ('owner','admin','editor'));
