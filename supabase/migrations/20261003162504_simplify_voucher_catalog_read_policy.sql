drop policy "public reads active voucher catalogue" on public.voucher_catalog_items;
drop policy "verified admins read voucher catalogue" on public.voucher_catalog_items;

create policy "active vouchers or verified admins read catalogue" on public.voucher_catalog_items
for select to anon, authenticated
using (
  (status = 'active' and (expires_at is null or expires_at > now()))
  or ((select auth.jwt() ->> 'aal') = 'aal2'
    and (select auth.jwt() -> 'app_metadata' ->> 'admin_role') in ('owner', 'admin'))
);
