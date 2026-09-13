alter table public.ai_jobs
  add column review_status text not null default 'pending' check (review_status in ('pending','in_review','approved','rejected','changes_requested','on_hold')),
  add column reviewed_by uuid references public.profiles(id) on delete set null,
  add column reviewed_at timestamptz,
  add column review_note text,
  add column product_draft_id uuid references public.products(id) on delete set null,
  add column retry_of_job_id uuid references public.ai_jobs(id) on delete set null;

update public.ai_jobs set review_status = 'pending' where review_only = true;
create index ai_jobs_review_status_idx on public.ai_jobs(review_status, completed_at desc);

create table public.ai_job_field_reviews (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.ai_jobs(id) on delete cascade,
  field_key text not null check (char_length(field_key) between 1 and 120),
  decision text not null check (decision in ('accepted','rejected','edited')),
  original_value jsonb,
  approved_value jsonb,
  note text,
  reviewed_by uuid not null references public.profiles(id) on delete restrict,
  reviewed_at timestamptz not null default now(),
  unique(job_id, field_key)
);
create index ai_job_field_reviews_job_idx on public.ai_job_field_reviews(job_id, reviewed_at desc);

alter table public.ai_job_field_reviews enable row level security;
revoke all on public.ai_job_field_reviews from public, anon;
grant select, insert, update on public.ai_job_field_reviews to authenticated;
create policy "aal2 staff read ai field reviews" on public.ai_job_field_reviews for select to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin','editor'));
create policy "aal2 admins create ai field reviews" on public.ai_job_field_reviews for insert to authenticated
with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin') and (select auth.uid()) = reviewed_by);
create policy "aal2 admins update ai field reviews" on public.ai_job_field_reviews for update to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin'))
with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin') and (select auth.uid()) = reviewed_by);
