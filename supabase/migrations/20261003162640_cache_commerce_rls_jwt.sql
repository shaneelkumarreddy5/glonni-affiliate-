alter policy "verified admins update commerce visibility" on public.commerce_visibility
using (id = 1 and ((select auth.jwt()) ->> 'aal') = 'aal2'
  and ((select auth.jwt()) -> 'app_metadata' ->> 'admin_role') in ('owner', 'admin'))
with check (id = 1 and ((select auth.jwt()) ->> 'aal') = 'aal2'
  and ((select auth.jwt()) -> 'app_metadata' ->> 'admin_role') in ('owner', 'admin'));

alter policy "active vouchers or verified admins read catalogue" on public.voucher_catalog_items
using ((status = 'active' and (expires_at is null or expires_at > now()))
  or (((select auth.jwt()) ->> 'aal') = 'aal2'
    and ((select auth.jwt()) -> 'app_metadata' ->> 'admin_role') in ('owner', 'admin')));

alter policy "verified admins insert voucher catalogue" on public.voucher_catalog_items
with check (((select auth.jwt()) ->> 'aal') = 'aal2'
  and ((select auth.jwt()) -> 'app_metadata' ->> 'admin_role') in ('owner', 'admin'));

alter policy "verified admins update voucher catalogue" on public.voucher_catalog_items
using (((select auth.jwt()) ->> 'aal') = 'aal2'
  and ((select auth.jwt()) -> 'app_metadata' ->> 'admin_role') in ('owner', 'admin'))
with check (((select auth.jwt()) ->> 'aal') = 'aal2'
  and ((select auth.jwt()) -> 'app_metadata' ->> 'admin_role') in ('owner', 'admin'));
