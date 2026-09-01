create or replace function private.is_active_admin()
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

revoke all on function private.is_active_admin() from public, anon;
grant execute on function private.is_active_admin() to authenticated;

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
      'create policy "active admin account required" on public.%I as restrictive for all to authenticated using ((select private.is_active_admin())) with check ((select private.is_active_admin()))',
      table_name
    );
  end loop;
end;
$$;

drop function if exists public.is_active_admin();

create index if not exists access_reviews_reviewer_idx on public.access_reviews(reviewer_id);
create index if not exists admin_invitations_department_idx on public.admin_invitations(department_id);
create index if not exists admin_invitations_invited_by_idx on public.admin_invitations(invited_by);
create index if not exists admin_invitations_manager_idx on public.admin_invitations(manager_id);
create index if not exists admin_setup_tokens_created_by_idx on public.admin_setup_tokens(created_by);
create index if not exists employees_created_by_idx on public.employees(created_by);
create index if not exists employees_last_access_changed_by_idx on public.employees(last_access_changed_by);
create index if not exists role_permissions_permission_idx on public.role_permissions(permission_id);
