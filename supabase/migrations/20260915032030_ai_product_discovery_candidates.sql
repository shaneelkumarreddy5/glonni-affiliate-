create table public.ai_discovery_candidates (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.ai_jobs(id) on delete cascade,
  position integer not null check (position between 1 and 100),
  title text not null check (char_length(title) between 2 and 300),
  brand text,
  model_code text,
  audience text,
  category_id uuid references public.categories(id) on delete set null,
  image_url text,
  matched_stores jsonb not null default '[]'::jsonb check (jsonb_typeof(matched_stores) = 'array'),
  source_urls jsonb not null default '[]'::jsonb check (jsonb_typeof(source_urls) = 'array'),
  missing_fields jsonb not null default '[]'::jsonb check (jsonb_typeof(missing_fields) = 'array'),
  confidence numeric(5,2) not null default 0 check (confidence between 0 and 100),
  status text not null default 'pending_review' check (status in ('pending_review','approved_to_draft','rejected','needs_research')),
  reviewer_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  product_draft_id uuid references public.products(id) on delete set null,
  raw_candidate jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(job_id, position)
);

create index ai_discovery_candidates_job_status_idx on public.ai_discovery_candidates(job_id, status, position);
create index ai_discovery_candidates_status_created_idx on public.ai_discovery_candidates(status, created_at desc);
alter table public.ai_discovery_candidates enable row level security;
revoke all on public.ai_discovery_candidates from public, anon;
grant select, insert, update on public.ai_discovery_candidates to authenticated;
create policy "aal2 staff read discovery candidates" on public.ai_discovery_candidates for select to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin','editor'));
create policy "aal2 admins review discovery candidates" on public.ai_discovery_candidates for update to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin'))
with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin'));
