alter table public.homepage_campaigns
  add column if not exists headline text,
  add column if not exists body_copy text,
  add column if not exists desktop_image_url text,
  add column if not exists mobile_image_url text,
  add column if not exists social_image_url text,
  add column if not exists destination_path text,
  add column if not exists distribution_config jsonb not null default '{}'::jsonb,
  add column if not exists final_approved_at timestamptz,
  add column if not exists published_at timestamptz;

create table public.promotion_recommendations (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  ai_score integer not null default 0 check (ai_score between 0 and 100),
  recommended_placement text not null default 'top_deals',
  rationale text,
  evidence jsonb not null default '{}'::jsonb,
  risk_flags text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending','approved','held','rejected','draft_created')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  campaign_id uuid references public.homepage_campaigns(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(offer_id, status)
);

create table public.campaign_channels (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.homepage_campaigns(id) on delete cascade,
  channel_type text not null check (channel_type in ('website','paid_ads','social')),
  channel_key text not null,
  is_enabled boolean not null default false,
  connection_status text not null default 'not_connected' check (connection_status in ('connected','not_connected','paused')),
  configuration jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','ready','scheduled','published','paused','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(campaign_id, channel_type, channel_key)
);

create index promotion_recommendations_status_score_idx on public.promotion_recommendations(status, ai_score desc);
create index campaign_channels_campaign_idx on public.campaign_channels(campaign_id, channel_type);
alter table public.promotion_recommendations enable row level security;
alter table public.campaign_channels enable row level security;
revoke all on public.promotion_recommendations, public.campaign_channels from public, anon;
grant select, insert, update, delete on public.promotion_recommendations, public.campaign_channels to authenticated;
create policy "admins manage promotion recommendations" on public.promotion_recommendations for all to authenticated
using ((select role from public.profiles where id=(select auth.uid())) in ('owner','admin','editor'))
with check ((select role from public.profiles where id=(select auth.uid())) in ('owner','admin','editor'));
create policy "admins manage campaign channels" on public.campaign_channels for all to authenticated
using ((select role from public.profiles where id=(select auth.uid())) in ('owner','admin','editor'))
with check ((select role from public.profiles where id=(select auth.uid())) in ('owner','admin','editor'));
create policy "aal2 required for promotion recommendation writes" on public.promotion_recommendations as restrictive for all to authenticated
using ((select auth.jwt()->>'aal')='aal2') with check ((select auth.jwt()->>'aal')='aal2');
create policy "aal2 required for campaign channel writes" on public.campaign_channels as restrictive for all to authenticated
using ((select auth.jwt()->>'aal')='aal2') with check ((select auth.jwt()->>'aal')='aal2');
