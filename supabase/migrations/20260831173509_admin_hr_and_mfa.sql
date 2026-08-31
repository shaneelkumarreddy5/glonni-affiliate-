create extension if not exists citext;

create type public.employment_status as enum ('invited', 'active', 'suspended', 'departed');
create type public.invitation_status as enum ('pending', 'sent', 'accepted', 'expired', 'revoked', 'failed');
create type public.employment_type as enum ('full_time', 'part_time', 'contractor', 'intern');
create type public.review_status as enum ('scheduled', 'in_progress', 'approved', 'changes_required', 'completed');

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  role_key public.app_role not null unique,
  name text not null,
  description text not null,
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  permission_key text not null unique,
  module text not null,
  action text not null,
  description text not null
);

create table public.role_permissions (
  role_id uuid not null references public.admin_roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.employees (
  profile_id uuid primary key references public.profiles(id) on delete restrict,
  employee_code text not null unique,
  work_email citext not null unique,
  phone text,
  job_title text not null,
  department_id uuid references public.departments(id) on delete set null,
  manager_id uuid references public.employees(profile_id) on delete set null,
  employment_type public.employment_type not null default 'full_time',
  status public.employment_status not null default 'invited',
  joining_date date,
  termination_date date,
  approval_limit numeric(14,2) not null default 0 check (approval_limit >= 0),
  requires_mfa boolean not null default true,
  last_access_review_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'departed' or termination_date is not null)
);

create table public.admin_invitations (
  id uuid primary key default gen_random_uuid(),
  email citext not null,
  display_name text not null,
  role public.app_role not null check (role in ('editor', 'admin', 'owner')),
  department_id uuid references public.departments(id) on delete set null,
  job_title text not null,
  phone text,
  manager_id uuid references public.employees(profile_id) on delete set null,
  joining_date date,
  employment_type public.employment_type not null default 'full_time',
  approval_limit numeric(14,2) not null default 0 check (approval_limit >= 0),
  status public.invitation_status not null default 'pending',
  invited_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  sent_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index admin_invitations_one_open_email_idx on public.admin_invitations(email)
where status in ('pending', 'sent');

create table public.access_reviews (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(profile_id) on delete restrict,
  reviewer_id uuid not null references public.employees(profile_id) on delete restrict,
  scheduled_for date not null,
  status public.review_status not null default 'scheduled',
  decision text,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.approval_authorities (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(profile_id) on delete cascade,
  area text not null,
  can_review boolean not null default true,
  can_approve boolean not null default false,
  amount_limit numeric(14,2) not null default 0 check (amount_limit >= 0),
  created_at timestamptz not null default now(),
  unique(employee_id, area)
);

create table private.owner_bootstrap (
  email citext primary key,
  display_name text not null,
  job_title text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'claimed')),
  sent_at timestamptz,
  claimed_at timestamptz
);
insert into private.owner_bootstrap(email, display_name, job_title)
values ('admin@glonni.com', 'Glonni Owner', 'Founder & Owner')
on conflict (email) do nothing;

create index employees_department_idx on public.employees(department_id);
create index employees_manager_idx on public.employees(manager_id);
create index employees_status_idx on public.employees(status);
create index admin_invitations_status_idx on public.admin_invitations(status, created_at desc);
create index access_reviews_employee_idx on public.access_reviews(employee_id, scheduled_for);

insert into public.departments(name, code, description) values
('Owner''s Office', 'OWNER', 'Strategy, governance and final approvals'),
('Catalogue & Partnerships', 'CATALOGUE', 'Stores, providers, products, offers and merchandising'),
('Marketing & Content', 'MARKETING', 'Campaigns, content, social publishing and growth'),
('Finance & Risk', 'FINANCE', 'Cashback, reconciliation, payouts and financial controls'),
('Customer Operations', 'CUSTOMER_OPS', 'Customer support, reported orders and trust'),
('Compliance & Security', 'COMPLIANCE', 'Provider rules, legal controls, fraud and security'),
('Technology & Data', 'TECH', 'Integrations, postbacks, data quality and platform health')
on conflict (name) do nothing;

insert into public.admin_roles(role_key, name, description) values
('owner', 'Owner', 'Full platform control and final approval authority'),
('admin', 'Administrator', 'Operational management within assigned authority'),
('editor', 'Team Member', 'Create, edit and submit work without critical approval authority')
on conflict (role_key) do update set name = excluded.name, description = excluded.description;

insert into public.permissions(permission_key, module, action, description) values
('dashboard.view','Dashboard','view','View operational dashboard'),
('catalogue.manage','Catalogue','manage','Create and update catalogue records'),
('marketing.manage','Marketing','manage','Create campaigns and content'),
('finance.view','Finance','view','View cashback and reconciliation records'),
('finance.approve','Finance','approve','Approve permitted financial actions'),
('customers.manage','Customers','manage','Manage customer support operations'),
('providers.manage','Providers','manage','Manage provider configurations'),
('team.view','Team','view','View employee directory'),
('team.invite','Team','invite','Invite employees'),
('team.manage','Team','manage','Change roles, status and access'),
('audit.view','Audit','view','View security and activity audit logs'),
('settings.manage','Settings','manage','Change protected platform settings')
on conflict (permission_key) do nothing;

insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.admin_roles r cross join public.permissions p
where r.role_key = 'owner'
on conflict do nothing;
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.admin_roles r join public.permissions p
on p.permission_key not in ('team.manage', 'settings.manage')
where r.role_key = 'admin'
on conflict do nothing;
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.admin_roles r join public.permissions p
on p.permission_key in ('dashboard.view','catalogue.manage','marketing.manage','customers.manage','team.view')
where r.role_key = 'editor'
on conflict do nothing;

create or replace function private.apply_admin_invitation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.admin_invitations%rowtype;
  bootstrap private.owner_bootstrap%rowtype;
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
  select * into bootstrap from private.owner_bootstrap where email = new.email and status in ('pending','sent');

  if invite.id is null and bootstrap.email is null then return new; end if;

  assigned_role := coalesce(invite.role, 'owner'::public.app_role);
  assigned_name := coalesce(invite.display_name, bootstrap.display_name, split_part(new.email, '@', 1));
  assigned_title := coalesce(invite.job_title, bootstrap.job_title, 'Employee');
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

  if invite.id is not null then
    update public.admin_invitations set status = 'sent', sent_at = coalesce(sent_at, now()) where id = invite.id;
  else
    update private.owner_bootstrap set status = 'sent', sent_at = coalesce(sent_at, now()) where email = new.email;
  end if;
  return new;
end;
$$;
revoke all on function private.apply_admin_invitation() from public, anon, authenticated;
drop trigger if exists on_auth_admin_invited on auth.users;
create trigger on_auth_admin_invited after insert on auth.users
for each row execute function private.apply_admin_invitation();

alter table public.departments enable row level security;
alter table public.admin_roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.employees enable row level security;
alter table public.admin_invitations enable row level security;
alter table public.access_reviews enable row level security;
alter table public.approval_authorities enable row level security;

revoke all on public.departments, public.admin_roles, public.permissions, public.role_permissions,
  public.employees, public.admin_invitations, public.access_reviews, public.approval_authorities from public, anon;
grant select, insert, update on public.departments, public.admin_roles, public.permissions, public.role_permissions,
  public.employees, public.admin_invitations, public.access_reviews, public.approval_authorities to authenticated;

create policy "employee reads own record" on public.employees for select to authenticated
using ((select auth.uid()) = profile_id);

create policy "aal2 staff read departments" on public.departments for select to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin','editor'));
create policy "aal2 managers manage departments" on public.departments for all to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin'))
with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin'));

create policy "aal2 staff read role system" on public.admin_roles for select to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin','editor'));
create policy "aal2 staff read permissions" on public.permissions for select to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin','editor'));
create policy "aal2 staff read role permissions" on public.role_permissions for select to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin','editor'));

create policy "aal2 staff directory" on public.employees for select to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin','editor'));
create policy "aal2 managers update employees" on public.employees for update to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin'))
with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin'));

create policy "aal2 managers manage invitations" on public.admin_invitations for all to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin'))
with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin'));

create policy "aal2 staff read access reviews" on public.access_reviews for select to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin','editor'));
create policy "aal2 managers manage access reviews" on public.access_reviews for all to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin'))
with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin'));

create policy "aal2 staff read approval authority" on public.approval_authorities for select to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin','editor'));
create policy "aal2 managers manage approval authority" on public.approval_authorities for all to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin'))
with check ((select auth.jwt() ->> 'aal') = 'aal2' and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner','admin'));

create policy "aal2 required for audit events" on public.audit_events as restrictive for all to authenticated
using ((select auth.jwt() ->> 'aal') = 'aal2')
with check ((select auth.jwt() ->> 'aal') = 'aal2');
