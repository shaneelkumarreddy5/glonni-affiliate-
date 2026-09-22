drop policy "customers read own in app notifications" on public.customer_notifications;
drop policy "active aal2 staff review notification delivery" on public.customer_notifications;

create policy "customers and verified staff read notifications" on public.customer_notifications
for select to authenticated
using (
  profile_id = (select auth.uid())
  or (
    (select auth.jwt()->>'aal') = 'aal2'
    and exists (
      select 1 from public.profiles p
      join public.employees e on e.profile_id = p.id
      where p.id = (select auth.uid())
        and p.role in ('owner','admin','editor')
        and e.status = 'active'
    )
  )
);

create index if not exists customer_notifications_template_idx
  on public.customer_notifications(template_id);
