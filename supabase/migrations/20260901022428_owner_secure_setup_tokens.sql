create table public.admin_setup_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  purpose text not null check (purpose in ('initial_password', 'password_reset')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint admin_setup_tokens_expiry_after_creation check (expires_at > created_at)
);

alter table public.admin_setup_tokens enable row level security;
revoke all on table public.admin_setup_tokens from anon, authenticated;

create index admin_setup_tokens_active_idx
  on public.admin_setup_tokens (profile_id, expires_at)
  where used_at is null;

comment on table public.admin_setup_tokens is
  'Hashed, short-lived, single-use credentials for owner-controlled admin password setup and recovery.';
