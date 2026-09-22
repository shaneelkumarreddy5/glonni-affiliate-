-- Allow a verified, active administrator to view customer records in the
-- customer-management workspace. Customers continue to see only their own rows.
create policy "active admins read customer profiles"
on public.profiles for select to authenticated
using (role = 'customer' and (select private.is_active_admin()));

create policy "active admins read customer saved offers"
on public.saved_offers for select to authenticated
using ((select private.is_active_admin()));

create policy "active admins read customer price alerts"
on public.price_alerts for select to authenticated
using ((select private.is_active_admin()));
