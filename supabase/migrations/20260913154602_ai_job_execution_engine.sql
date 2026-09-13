create table public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  agent_key text not null references public.ai_agents(key) on update cascade on delete restrict,
  job_type text not null check (job_type in ('owner_daily_brief','product_enrichment','product_discovery')),
  status text not null default 'queued' check (status in ('scheduled','queued','running','completed','failed','cancelled')),
  priority smallint not null default 5 check (priority between 1 and 10),
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  sources jsonb not null default '[]'::jsonb,
  review_only boolean not null default true,
  dedupe_key text,
  scheduled_for timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  attempt_count smallint not null default 0,
  max_attempts smallint not null default 3 check (max_attempts between 1 and 5),
  next_retry_at timestamptz,
  latest_error text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not (status = 'running' and started_at is null)),
  check (not (status in ('completed','failed','cancelled') and completed_at is null))
);

create unique index ai_jobs_active_dedupe_idx on public.ai_jobs(dedupe_key)
  where dedupe_key is not null and status in ('scheduled','queued','running');
create index ai_jobs_due_idx on public.ai_jobs(status, scheduled_for, priority desc);
create index ai_jobs_agent_created_idx on public.ai_jobs(agent_key, created_at desc);

create table public.ai_job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.ai_jobs(id) on delete cascade,
  event_type text not null,
  detail jsonb not null default '{}'::jsonb,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index ai_job_events_job_created_idx on public.ai_job_events(job_id, created_at desc);

alter table public.ai_jobs enable row level security;
alter table public.ai_job_events enable row level security;
revoke all on public.ai_jobs, public.ai_job_events from public, anon;
grant select, insert, update on public.ai_jobs, public.ai_job_events to authenticated;

create policy "aal2 staff read ai jobs" on public.ai_jobs for select to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin','editor'));
create policy "aal2 admins create ai jobs" on public.ai_jobs for insert to authenticated
with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin') and (select auth.uid()) = created_by);
create policy "aal2 admins update ai jobs" on public.ai_jobs for update to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin'))
with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin'));
create policy "aal2 staff read ai job events" on public.ai_job_events for select to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin','editor'));

alter table public.ai_agents add column if not exists active_job_id uuid references public.ai_jobs(id) on delete set null;
