create schema if not exists extensions;
alter extension citext set schema extensions;

drop policy if exists "aal2 staff read departments" on public.departments;
drop policy if exists "aal2 managers manage departments" on public.departments;
create policy "aal2 staff read departments" on public.departments for select to authenticated
using (((select auth.jwt()) ->> 'aal') = 'aal2' and ((select auth.jwt()) -> 'app_metadata' ->> 'admin_role') in ('owner','admin','editor'));
create policy "aal2 managers insert departments" on public.departments for insert to authenticated
with check (((select auth.jwt()) ->> 'aal') = 'aal2' and ((select auth.jwt()) -> 'app_metadata' ->> 'admin_role') in ('owner','admin'));
create policy "aal2 managers update departments" on public.departments for update to authenticated
using (((select auth.jwt()) ->> 'aal') = 'aal2' and ((select auth.jwt()) -> 'app_metadata' ->> 'admin_role') in ('owner','admin'))
with check (((select auth.jwt()) ->> 'aal') = 'aal2' and ((select auth.jwt()) -> 'app_metadata' ->> 'admin_role') in ('owner','admin'));

drop policy if exists "aal2 staff read role system" on public.admin_roles;
create policy "aal2 staff read role system" on public.admin_roles for select to authenticated
using (((select auth.jwt()) ->> 'aal') = 'aal2' and ((select auth.jwt()) -> 'app_metadata' ->> 'admin_role') in ('owner','admin','editor'));
drop policy if exists "aal2 staff read permissions" on public.permissions;
create policy "aal2 staff read permissions" on public.permissions for select to authenticated
using (((select auth.jwt()) ->> 'aal') = 'aal2' and ((select auth.jwt()) -> 'app_metadata' ->> 'admin_role') in ('owner','admin','editor'));
drop policy if exists "aal2 staff read role permissions" on public.role_permissions;
create policy "aal2 staff read role permissions" on public.role_permissions for select to authenticated
using (((select auth.jwt()) ->> 'aal') = 'aal2' and ((select auth.jwt()) -> 'app_metadata' ->> 'admin_role') in ('owner','admin','editor'));

drop policy if exists "employee reads own record" on public.employees;
drop policy if exists "aal2 staff directory" on public.employees;
drop policy if exists "aal2 managers update employees" on public.employees;
create policy "employee own or aal2 staff directory" on public.employees for select to authenticated
using ((select auth.uid()) = profile_id or (((select auth.jwt()) ->> 'aal') = 'aal2' and ((select auth.jwt()) -> 'app_metadata' ->> 'admin_role') in ('owner','admin','editor')));
create policy "aal2 managers update employees" on public.employees for update to authenticated
using (((select auth.jwt()) ->> 'aal') = 'aal2' and ((select auth.jwt()) -> 'app_metadata' ->> 'admin_role') in ('owner','admin'))
with check (((select auth.jwt()) ->> 'aal') = 'aal2' and ((select auth.jwt()) -> 'app_metadata' ->> 'admin_role') in ('owner','admin'));

drop policy if exists "aal2 managers manage invitations" on public.admin_invitations;
create policy "aal2 managers read invitations" on public.admin_invitations for select to authenticated
using (((select auth.jwt()) ->> 'aal') = 'aal2' and ((select auth.jwt()) -> 'app_metadata' ->> 'admin_role') in ('owner','admin'));
create policy "aal2 managers insert invitations" on public.admin_invitations for insert to authenticated
with check (((select auth.jwt()) ->> 'aal') = 'aal2' and ((select auth.jwt()) -> 'app_metadata' ->> 'admin_role') in ('owner','admin'));
create policy "aal2 managers update invitations" on public.admin_invitations for update to authenticated
using (((select auth.jwt()) ->> 'aal') = 'aal2' and ((select auth.jwt()) -> 'app_metadata' ->> 'admin_role') in ('owner','admin'))
with check (((select auth.jwt()) ->> 'aal') = 'aal2' and ((select auth.jwt()) -> 'app_metadata' ->> 'admin_role') in ('owner','admin'));

drop policy if exists "aal2 staff read access reviews" on public.access_reviews;
drop policy if exists "aal2 managers manage access reviews" on public.access_reviews;
create policy "aal2 staff read access reviews" on public.access_reviews for select to authenticated
using (((select auth.jwt()) ->> 'aal') = 'aal2' and ((select auth.jwt()) -> 'app_metadata' ->> 'admin_role') in ('owner','admin','editor'));
create policy "aal2 managers insert access reviews" on public.access_reviews for insert to authenticated
with check (((select auth.jwt()) ->> 'aal') = 'aal2' and ((select auth.jwt()) -> 'app_metadata' ->> 'admin_role') in ('owner','admin'));
create policy "aal2 managers update access reviews" on public.access_reviews for update to authenticated
using (((select auth.jwt()) ->> 'aal') = 'aal2' and ((select auth.jwt()) -> 'app_metadata' ->> 'admin_role') in ('owner','admin'))
with check (((select auth.jwt()) ->> 'aal') = 'aal2' and ((select auth.jwt()) -> 'app_metadata' ->> 'admin_role') in ('owner','admin'));

drop policy if exists "aal2 staff read approval authority" on public.approval_authorities;
drop policy if exists "aal2 managers manage approval authority" on public.approval_authorities;
create policy "aal2 staff read approval authority" on public.approval_authorities for select to authenticated
using (((select auth.jwt()) ->> 'aal') = 'aal2' and ((select auth.jwt()) -> 'app_metadata' ->> 'admin_role') in ('owner','admin','editor'));
create policy "aal2 managers insert approval authority" on public.approval_authorities for insert to authenticated
with check (((select auth.jwt()) ->> 'aal') = 'aal2' and ((select auth.jwt()) -> 'app_metadata' ->> 'admin_role') in ('owner','admin'));
create policy "aal2 managers update approval authority" on public.approval_authorities for update to authenticated
using (((select auth.jwt()) ->> 'aal') = 'aal2' and ((select auth.jwt()) -> 'app_metadata' ->> 'admin_role') in ('owner','admin'))
with check (((select auth.jwt()) ->> 'aal') = 'aal2' and ((select auth.jwt()) -> 'app_metadata' ->> 'admin_role') in ('owner','admin'));

drop policy if exists "aal2 required for audit events" on public.audit_events;
create policy "aal2 required for audit events" on public.audit_events as restrictive for all to authenticated
using (((select auth.jwt()) ->> 'aal') = 'aal2')
with check (((select auth.jwt()) ->> 'aal') = 'aal2');
