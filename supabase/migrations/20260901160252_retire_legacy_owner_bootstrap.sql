-- The active Owner account has been verified. Retire the original one-time
-- bootstrap record and keep only the authenticated employee invitation path.
create or replace function private.apply_admin_invitation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.admin_invitations%rowtype;
  assigned_role public.app_role;
  assigned_name text;
  assigned_title text;
  assigned_department uuid;
  assigned_limit numeric;
  assigned_type public.employment_type;
begin
  if new.invited_at is null then return new; end if;

  select * into invite from public.admin_invitations
  where email = new.email and status in ('pending','sent') order by created_at desc limit 1;
  if invite.id is null then return new; end if;

  assigned_role := invite.role;
  assigned_name := coalesce(invite.display_name, split_part(new.email, '@', 1));
  assigned_title := coalesce(invite.job_title, 'Employee');
  assigned_department := invite.department_id;
  assigned_limit := coalesce(invite.approval_limit, 0);
  assigned_type := coalesce(invite.employment_type, 'full_time'::public.employment_type);

  insert into public.profiles(id, display_name, role)
  values (new.id, assigned_name, assigned_role)
  on conflict (id) do update set display_name = excluded.display_name, role = excluded.role, updated_at = now();

  update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) ||
    jsonb_build_object('admin_role', assigned_role::text, 'employee', true)
  where id = new.id;

  insert into public.employees(profile_id, employee_code, work_email, phone, job_title, department_id, manager_id, employment_type, status, joining_date, approval_limit, requires_mfa, created_by)
  values (new.id, 'GL-' || upper(substr(replace(new.id::text, '-', ''), 1, 8)), new.email, invite.phone, assigned_title,
    assigned_department, invite.manager_id, assigned_type, 'invited', invite.joining_date, assigned_limit, true, invite.invited_by)
  on conflict (profile_id) do nothing;

  update public.admin_invitations set status = 'sent', sent_at = coalesce(sent_at, now()) where id = invite.id;
  return new;
end;
$$;

revoke all on function private.apply_admin_invitation() from public, anon, authenticated;
drop table private.owner_bootstrap;
