create table public.content_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 180),
  source_offer_id uuid references public.offers(id) on delete set null,
  offer_snapshot jsonb not null default '{}'::jsonb,
  recommendation_score integer check (recommendation_score between 0 and 100),
  recommendation_reason text,
  admin_brief text not null default '',
  status text not null default 'draft' check (status in ('draft','pending_review','changes_requested','approved','admin_approved','rejected','on_hold','scheduled','published','failed')),
  created_by uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz,
  decided_by uuid references public.profiles(id) on delete set null,
  decision_note text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.content_campaign_assets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.content_campaigns(id) on delete cascade,
  channel_type text not null check (channel_type in ('social','paid_ads')),
  platform_key text not null check (platform_key in ('instagram','facebook','google_ads','meta_ads')),
  creative_format text not null default 'square' check (creative_format in ('square','portrait','story','landscape')),
  headline text not null default '',
  caption text not null default '',
  description text not null default '',
  cta_label text not null default '',
  media_path text,
  destination_url text not null,
  status text not null default 'draft' check (status in ('draft','pending_review','changes_requested','approved','admin_approved','rejected','on_hold','scheduled','published','failed')),
  version integer not null default 1 check (version > 0),
  content_agent_key text check (content_agent_key is null or content_agent_key = 'content_experience'),
  ai_work_item_id uuid unique references public.ai_work_items(id) on delete set null,
  scheduled_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(campaign_id, platform_key)
);

create table public.content_campaign_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.content_campaigns(id) on delete cascade,
  asset_id uuid references public.content_campaign_assets(id) on delete set null,
  event_type text not null check (char_length(event_type) between 3 and 80),
  actor_id uuid references public.profiles(id) on delete set null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index content_campaigns_status_created_idx on public.content_campaigns(status, created_at desc);
create index content_campaigns_offer_idx on public.content_campaigns(source_offer_id, created_at desc);
create index content_campaign_assets_campaign_status_idx on public.content_campaign_assets(campaign_id, status, channel_type);
create index content_campaign_events_campaign_created_idx on public.content_campaign_events(campaign_id, created_at desc);

alter table public.content_campaigns enable row level security;
alter table public.content_campaign_assets enable row level security;
alter table public.content_campaign_events enable row level security;
revoke all on public.content_campaigns, public.content_campaign_assets, public.content_campaign_events from public, anon;
grant select, insert, update, delete on public.content_campaigns, public.content_campaign_assets to authenticated;
grant select, insert on public.content_campaign_events to authenticated;

create policy "aal2 active content staff read campaigns"
on public.content_campaigns for select to authenticated
using (
  ((select auth.jwt()) ->> 'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid()) and p.role in ('owner','admin','editor') and e.status = 'active'
  )
);

create policy "aal2 active content staff create draft campaigns"
on public.content_campaigns for insert to authenticated
with check (
  status = 'draft'
  and created_by = (select auth.uid())
  and ((select auth.jwt()) ->> 'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid()) and p.role in ('owner','admin','editor') and e.status = 'active'
  )
);

create policy "aal2 active content staff update campaigns"
on public.content_campaigns for update to authenticated
using (
  ((select auth.jwt()) ->> 'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid()) and p.role in ('owner','admin','editor') and e.status = 'active'
  )
  and (status not in ('approved','admin_approved','published') or (select role from public.profiles where id = (select auth.uid())) in ('owner','admin'))
)
with check (
  ((select auth.jwt()) ->> 'aal') = 'aal2'
  and status not in ('scheduled','published','failed')
  and exists (
    select 1 from public.profiles p join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid()) and p.role in ('owner','admin','editor') and e.status = 'active'
  )
  and (status not in ('approved','admin_approved') or (select role from public.profiles where id = (select auth.uid())) in ('owner','admin'))
);

create policy "aal2 active content staff delete campaigns"
on public.content_campaigns for delete to authenticated
using (
  ((select auth.jwt()) ->> 'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid()) and p.role in ('owner','admin','editor') and e.status = 'active'
  )
  and ((select role from public.profiles where id = (select auth.uid())) in ('owner','admin') or (created_by = (select auth.uid()) and status in ('draft','on_hold','changes_requested')))
);

create policy "aal2 active content staff read campaign assets"
on public.content_campaign_assets for select to authenticated
using (
  ((select auth.jwt()) ->> 'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid()) and p.role in ('owner','admin','editor') and e.status = 'active'
  )
);

create policy "aal2 active content staff create campaign assets"
on public.content_campaign_assets for insert to authenticated
with check (
  status = 'draft'
  and ((select auth.jwt()) ->> 'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid()) and p.role in ('owner','admin','editor') and e.status = 'active'
  )
);

create policy "aal2 active content staff update campaign assets"
on public.content_campaign_assets for update to authenticated
using (
  ((select auth.jwt()) ->> 'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid()) and p.role in ('owner','admin','editor') and e.status = 'active'
  )
  and (status not in ('approved','admin_approved','published') or (select role from public.profiles where id = (select auth.uid())) in ('owner','admin'))
)
with check (
  ((select auth.jwt()) ->> 'aal') = 'aal2'
  and status not in ('scheduled','published','failed')
  and exists (
    select 1 from public.profiles p join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid()) and p.role in ('owner','admin','editor') and e.status = 'active'
  )
  and (status not in ('approved','admin_approved') or (select role from public.profiles where id = (select auth.uid())) in ('owner','admin'))
);

create policy "aal2 active content staff delete campaign assets"
on public.content_campaign_assets for delete to authenticated
using (
  ((select auth.jwt()) ->> 'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid()) and p.role in ('owner','admin','editor') and e.status = 'active'
  )
  and (
    (select role from public.profiles where id = (select auth.uid())) in ('owner','admin')
    or exists (select 1 from public.content_campaigns c where c.id = campaign_id and c.created_by = (select auth.uid()) and c.status in ('draft','on_hold','changes_requested'))
  )
);

create policy "aal2 active content staff read campaign events"
on public.content_campaign_events for select to authenticated
using (
  ((select auth.jwt()) ->> 'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid()) and p.role in ('owner','admin','editor') and e.status = 'active'
  )
);

create policy "aal2 active content staff create campaign events"
on public.content_campaign_events for insert to authenticated
with check (
  ((select auth.jwt()) ->> 'aal') = 'aal2'
  and actor_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid()) and p.role in ('owner','admin','editor') and e.status = 'active'
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('content-creatives', 'content-creatives', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "aal2 active content staff read private campaign creatives"
on storage.objects for select to authenticated
using (
  bucket_id = 'content-creatives'
  and ((select auth.jwt()) ->> 'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid()) and p.role in ('owner','admin','editor') and e.status = 'active'
  )
);

create policy "aal2 active content staff upload own campaign creatives"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'content-creatives'
  and ((select auth.jwt()) ->> 'aal') = 'aal2'
  and split_part(name, '/', 1) = (select auth.uid())::text
  and exists (
    select 1 from public.profiles p join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid()) and p.role in ('owner','admin','editor') and e.status = 'active'
  )
);

create policy "aal2 active content staff update own campaign creatives"
on storage.objects for update to authenticated
using (
  bucket_id = 'content-creatives'
  and ((select auth.jwt()) ->> 'aal') = 'aal2'
  and split_part(name, '/', 1) = (select auth.uid())::text
  and exists (
    select 1 from public.profiles p join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid()) and p.role in ('owner','admin','editor') and e.status = 'active'
  )
)
with check (
  bucket_id = 'content-creatives'
  and ((select auth.jwt()) ->> 'aal') = 'aal2'
  and split_part(name, '/', 1) = (select auth.uid())::text
  and exists (
    select 1 from public.profiles p join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid()) and p.role in ('owner','admin','editor') and e.status = 'active'
  )
);

create policy "aal2 active content staff delete own campaign creatives"
on storage.objects for delete to authenticated
using (
  bucket_id = 'content-creatives'
  and ((select auth.jwt()) ->> 'aal') = 'aal2'
  and split_part(name, '/', 1) = (select auth.uid())::text
  and exists (
    select 1 from public.profiles p join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid()) and p.role in ('owner','admin','editor') and e.status = 'active'
  )
);
