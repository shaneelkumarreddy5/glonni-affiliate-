alter table public.merchants
  add column if not exists approval_status text not null default 'draft'
    check (approval_status in ('draft','pending','approved','paused','rejected')),
  add column if not exists review_notes text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

update public.merchants
set approval_status = case when is_active then 'approved' else 'paused' end
where approval_status = 'draft';

create index if not exists merchants_approval_status_idx on public.merchants(approval_status);
