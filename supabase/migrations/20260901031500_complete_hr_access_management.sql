alter table public.employees
  add column if not exists assigned_role public.app_role not null default 'editor',
  add column if not exists mfa_enrolled_at timestamptz,
  add column if not exists last_access_changed_at timestamptz,
  add column if not exists last_access_changed_by uuid references public.profiles(id) on delete set null;

update public.employees e
set assigned_role = p.role
from public.profiles p
where p.id = e.profile_id
  and p.role in ('owner', 'admin', 'editor');

alter table public.employees
  drop constraint if exists employees_assigned_admin_role_check;
alter table public.employees
  add constraint employees_assigned_admin_role_check
  check (assigned_role in ('owner', 'admin', 'editor'));

create or replace function public.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.employees e on e.profile_id = p.id
    where p.id = auth.uid()
      and p.role in ('owner', 'admin', 'editor')
      and e.status in ('active', 'invited')
      and ((auth.jwt() ->> 'aal') = 'aal2')
  );
$$;

revoke all on function public.is_active_admin() from public, anon;
grant execute on function public.is_active_admin() to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'departments', 'admin_roles', 'permissions', 'role_permissions',
    'employees', 'admin_invitations', 'access_reviews', 'approval_authorities'
  ] loop
    execute format('drop policy if exists "active admin account required" on public.%I', table_name);
    execute format(
      'create policy "active admin account required" on public.%I as restrictive for all to authenticated using ((select public.is_active_admin())) with check ((select public.is_active_admin()))',
      table_name
    );
  end loop;
end;
$$;

create or replace function public.admin_revoke_user_sessions(target_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer := 0;
begin
  delete from auth.sessions where user_id = target_user_id;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.admin_revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.admin_revoke_user_sessions(uuid) to service_role;

comment on function public.admin_revoke_user_sessions(uuid) is
  'Service-role-only session revocation used after HR access changes and MFA resets.';

create index if not exists access_reviews_status_date_idx
  on public.access_reviews(status, scheduled_for);

create index if not exists approval_authorities_employee_area_idx
  on public.approval_authorities(employee_id, area);

update public.employees e
set mfa_enrolled_at = factors.first_verified_at
from (
  select user_id, min(created_at) as first_verified_at
  from auth.mfa_factors
  where status::text = 'verified'
  group by user_id
) factors
where factors.user_id = e.profile_id
  and e.mfa_enrolled_at is null;
