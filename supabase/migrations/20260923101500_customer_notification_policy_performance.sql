drop policy "active aal2 staff manage notification templates" on public.notification_templates;
create policy "active aal2 staff manage notification templates" on public.notification_templates
for all to authenticated
using ((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin','editor') and e.status='active'))
with check ((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin','editor') and e.status='active'));

drop policy "active aal2 staff send customer notification campaigns" on public.customer_notifications;
create policy "active aal2 staff send customer notification campaigns" on public.customer_notifications
for insert to authenticated
with check (
  source_table='admin_campaign' and
  (select auth.jwt()->>'aal')='aal2' and
  exists(select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin','editor') and e.status='active') and
  exists(select 1 from public.profiles target where target.id=public.customer_notifications.profile_id and target.role='customer') and
  (category<>'deals_offers' or exists(select 1 from public.customer_preferences cp where cp.profile_id=public.customer_notifications.profile_id and cp.marketing_updates))
);

create index if not exists notification_templates_updated_by_idx
  on public.notification_templates(updated_by);
