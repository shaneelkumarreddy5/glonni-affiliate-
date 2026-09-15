create table public.product_refresh_policies (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.products(id) on delete cascade,
  is_enabled boolean not null default true,
  frequency_hours integer not null default 24 check (frequency_hours between 1 and 720),
  stale_after_hours integer not null default 24 check (stale_after_hours between 1 and 2160),
  sections jsonb not null default '["store_offers"]'::jsonb check (jsonb_typeof(sections) = 'array'),
  requires_review boolean not null default true check (requires_review = true),
  next_run_at timestamptz not null default now(),
  last_run_at timestamptz,
  last_success_at timestamptz,
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index product_refresh_policies_due_idx on public.product_refresh_policies(is_enabled, next_run_at);

create table public.product_refresh_runs (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid references public.product_refresh_policies(id) on delete set null,
  product_id uuid not null references public.products(id) on delete cascade,
  ai_job_id uuid unique references public.ai_jobs(id) on delete set null,
  trigger_type text not null check (trigger_type in ('manual','scheduled')),
  status text not null default 'queued' check (status in ('queued','running','review_required','approved','rejected','failed','cancelled')),
  sections jsonb not null default '[]'::jsonb check (jsonb_typeof(sections) = 'array'),
  stale_fields jsonb not null default '[]'::jsonb check (jsonb_typeof(stale_fields) = 'array'),
  summary text,
  error_message text,
  created_by uuid references public.profiles(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index product_refresh_runs_product_created_idx on public.product_refresh_runs(product_id, created_at desc);
create index product_refresh_runs_status_created_idx on public.product_refresh_runs(status, created_at desc);

alter table public.product_refresh_policies enable row level security;
alter table public.product_refresh_runs enable row level security;
revoke all on public.product_refresh_policies, public.product_refresh_runs from public, anon;
grant select, insert, update, delete on public.product_refresh_policies to authenticated;
grant select, insert, update on public.product_refresh_runs to authenticated;

create policy "aal2 staff read refresh policies" on public.product_refresh_policies for select to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin','editor'));
create policy "aal2 admins create refresh policies" on public.product_refresh_policies for insert to authenticated
with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin') and (select auth.uid()) = created_by and (select auth.uid()) = updated_by);
create policy "aal2 admins update refresh policies" on public.product_refresh_policies for update to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin'))
with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin') and (select auth.uid()) = updated_by);
create policy "aal2 owners delete refresh policies" on public.product_refresh_policies for delete to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') = 'owner');

create policy "aal2 staff read refresh runs" on public.product_refresh_runs for select to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin','editor'));
create policy "aal2 admins create refresh runs" on public.product_refresh_runs for insert to authenticated
with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin') and (select auth.uid()) = created_by);
create policy "aal2 admins update refresh runs" on public.product_refresh_runs for update to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin'))
with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin'));
