alter table public.admin_setup_tokens
  drop constraint if exists admin_setup_tokens_purpose_check;

alter table public.admin_setup_tokens
  add constraint admin_setup_tokens_purpose_check
  check (purpose in ('initial_password', 'password_reset', 'employee_invitation', 'employee_password_reset'));

alter table public.admin_setup_tokens
  add column if not exists invitation_id uuid references public.admin_invitations(id) on delete set null;

create index if not exists admin_setup_tokens_invitation_idx
  on public.admin_setup_tokens(invitation_id)
  where invitation_id is not null;

comment on table public.admin_setup_tokens is
  'Hashed, expiring, single-use credentials for scanner-safe Owner and employee password setup.';
