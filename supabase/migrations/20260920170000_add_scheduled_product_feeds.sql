create table public.product_feeds (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.affiliate_providers(id) on delete set null,
  name text not null,
  feed_url text not null,
  file_format text not null check (file_format in ('csv','xlsx','json','xml')),
  frequency text not null check (frequency in ('manual','6_hours','12_hours','daily','weekly')),
  status text not null default 'draft' check (status in ('draft','pending_approval','active','paused','rejected')),
  next_run_at timestamptz,
  last_run_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_feed_runs (
  id uuid primary key default gen_random_uuid(),
  feed_id uuid not null references public.product_feeds(id) on delete cascade,
  import_batch_id uuid references public.import_batches(id) on delete set null,
  status text not null default 'pending_review' check (status in ('pending_review','approved','rejected','failed')),
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  invalid_rows integer not null default 0,
  review_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index product_feeds_status_idx on public.product_feeds(status);
create index product_feeds_provider_idx on public.product_feeds(provider_id);
create index product_feed_runs_feed_idx on public.product_feed_runs(feed_id, started_at desc);
create index product_feed_runs_status_idx on public.product_feed_runs(status);

alter table public.product_feeds enable row level security;
alter table public.product_feed_runs enable row level security;
revoke all on public.product_feeds, public.product_feed_runs from public, anon;
grant select, insert, update, delete on public.product_feeds, public.product_feed_runs to authenticated;

create policy "product admins manage feeds" on public.product_feeds for all to authenticated
using ((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin') and e.status='active'))
with check ((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin') and e.status='active'));

create policy "product admins manage feed runs" on public.product_feed_runs for all to authenticated
using ((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin') and e.status='active'))
with check ((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin') and e.status='active'));

comment on table public.product_feeds is 'Approved schedules for recurring provider product feeds.';
comment on table public.product_feed_runs is 'Reviewable evidence for every scheduled or manually triggered feed run.';
