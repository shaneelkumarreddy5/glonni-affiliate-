-- Customers can submit and read their own claims, but cannot alter a submitted
-- claim, its review status, or another shopper's record.
drop policy if exists "customers manage own cashback claims" on public.cashback_claims;

create policy "customers create own cashback claims"
on public.cashback_claims
for insert
to authenticated
with check (
  (select auth.uid()) = profile_id
  and status = 'submitted'
  and reviewed_by is null
  and reviewed_at is null
);

create policy "customers read own cashback claims"
on public.cashback_claims
for select
to authenticated
using ((select auth.uid()) = profile_id);
