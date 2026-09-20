create table if not exists public.import_batch_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  row_number integer not null check (row_number > 0),
  status text not null check (status in ('valid','invalid','duplicate')),
  raw_data jsonb not null default '{}'::jsonb,
  normalized_data jsonb not null default '{}'::jsonb,
  validation_errors text[] not null default '{}',
  product_id uuid references public.products(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(batch_id,row_number)
);

create index if not exists import_batch_rows_batch_status_idx
  on public.import_batch_rows(batch_id,status,row_number);

alter table public.import_batch_rows enable row level security;
revoke all on table public.import_batch_rows from public, anon;
grant select, insert, update, delete on table public.import_batch_rows to authenticated;

create policy "aal2 product admins manage import rows"
on public.import_batch_rows for all to authenticated
using (
  (select auth.jwt()->>'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p
    join public.employees e on e.profile_id=p.id
    where p.id=(select auth.uid())
      and p.role in ('owner','admin')
      and e.status='active'
  )
)
with check (
  (select auth.jwt()->>'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p
    join public.employees e on e.profile_id=p.id
    where p.id=(select auth.uid())
      and p.role in ('owner','admin')
      and e.status='active'
  )
);

comment on table public.import_batch_rows is
  'Row-level validation evidence for admin product bulk uploads.';
