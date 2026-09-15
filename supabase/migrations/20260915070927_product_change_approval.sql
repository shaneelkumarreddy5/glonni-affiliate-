create table public.product_change_sets (
  id uuid primary key default gen_random_uuid(),
  refresh_run_id uuid not null unique references public.product_refresh_runs(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  ai_job_id uuid not null unique references public.ai_jobs(id) on delete restrict,
  status text not null default 'pending_review' check (status in ('pending_review','in_review','approved','rejected','applied','rolled_back')),
  risk_level text not null default 'medium' check (risk_level in ('low','medium','high','critical')),
  sources jsonb not null default '[]'::jsonb check (jsonb_typeof(sources) = 'array'),
  summary text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_change_items (
  id uuid primary key default gen_random_uuid(),
  change_set_id uuid not null references public.product_change_sets(id) on delete cascade,
  field_key text not null check (field_key in ('title','brand','description','category_id','image_url','gallery_images','variants','specifications','product_information','manual_metadata','store_offers')),
  previous_value jsonb,
  proposed_value jsonb,
  decision text not null default 'pending' check (decision in ('pending','accepted','rejected')),
  risk_flags jsonb not null default '[]'::jsonb check (jsonb_typeof(risk_flags) = 'array'),
  source_urls jsonb not null default '[]'::jsonb check (jsonb_typeof(source_urls) = 'array'),
  reviewer_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(change_set_id, field_key)
);

create table public.product_change_snapshots (
  id uuid primary key default gen_random_uuid(),
  change_set_id uuid not null unique references public.product_change_sets(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete cascade,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_by uuid not null references public.profiles(id) on delete restrict,
  restored_by uuid references public.profiles(id) on delete set null,
  restored_at timestamptz,
  created_at timestamptz not null default now()
);

create index product_change_sets_status_created_idx on public.product_change_sets(status, created_at desc);
create index product_change_sets_product_created_idx on public.product_change_sets(product_id, created_at desc);
create index product_change_items_set_decision_idx on public.product_change_items(change_set_id, decision);
create index product_change_snapshots_product_idx on public.product_change_snapshots(product_id, created_at desc);

alter table public.product_change_sets enable row level security;
alter table public.product_change_items enable row level security;
alter table public.product_change_snapshots enable row level security;
revoke all on public.product_change_sets, public.product_change_items, public.product_change_snapshots from public, anon;
grant select, insert, update on public.product_change_sets, public.product_change_items, public.product_change_snapshots to authenticated;

create policy "aal2 staff read product change sets" on public.product_change_sets for select to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin','editor'));
create policy "aal2 admins create product change sets" on public.product_change_sets for insert to authenticated
with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin'));
create policy "aal2 admins update product change sets" on public.product_change_sets for update to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin'))
with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin'));

create policy "aal2 staff read product change items" on public.product_change_items for select to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin','editor'));
create policy "aal2 admins create product change items" on public.product_change_items for insert to authenticated
with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin'));
create policy "aal2 admins update product change items" on public.product_change_items for update to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin'))
with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin'));

create policy "aal2 staff read product snapshots" on public.product_change_snapshots for select to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin','editor'));
create policy "aal2 admins create product snapshots" on public.product_change_snapshots for insert to authenticated
with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin') and (select auth.uid()) = created_by);
create policy "aal2 owners restore product snapshots" on public.product_change_snapshots for update to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') = 'owner')
with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') = 'owner' and (select auth.uid()) = restored_by);
