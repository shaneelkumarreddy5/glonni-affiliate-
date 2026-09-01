-- Protect all privileged catalogue, provider, campaign and financial writes at
-- the database layer. This cannot be bypassed by calling the Data API directly.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'categories', 'merchants', 'products', 'offers', 'affiliate_providers',
    'import_batches', 'homepage_campaigns', 'wallet_entries', 'referral_conversions'
  ] loop
    execute format('drop policy if exists "aal2 required for protected inserts" on public.%I', table_name);
    execute format('drop policy if exists "aal2 required for protected updates" on public.%I', table_name);
    execute format('drop policy if exists "aal2 required for protected deletes" on public.%I', table_name);
    execute format('create policy "aal2 required for protected inserts" on public.%I as restrictive for insert to authenticated with check ((select auth.jwt() ->> ''aal'') = ''aal2'')', table_name);
    execute format('create policy "aal2 required for protected updates" on public.%I as restrictive for update to authenticated using ((select auth.jwt() ->> ''aal'') = ''aal2'') with check ((select auth.jwt() ->> ''aal'') = ''aal2'')', table_name);
    execute format('create policy "aal2 required for protected deletes" on public.%I as restrictive for delete to authenticated using ((select auth.jwt() ->> ''aal'') = ''aal2'')', table_name);
  end loop;
end $$;

-- Customers may still create their own claims and withdrawal requests at AAL1.
-- Staff members, however, must have completed 2FA for any finance mutation.
do $$
declare table_name text;
begin
  foreach table_name in array array['cashback_claims', 'withdrawal_requests'] loop
    execute format('drop policy if exists "aal2 required for staff finance inserts" on public.%I', table_name);
    execute format('drop policy if exists "aal2 required for staff finance updates" on public.%I', table_name);
    execute format('drop policy if exists "aal2 required for staff finance deletes" on public.%I', table_name);
    execute format($sql$create policy "aal2 required for staff finance inserts" on public.%I as restrictive for insert to authenticated with check (coalesce((select role::text from public.profiles where id = (select auth.uid())), 'customer') not in ('owner', 'admin', 'editor') or (select auth.jwt() ->> 'aal') = 'aal2')$sql$, table_name);
    execute format($sql$create policy "aal2 required for staff finance updates" on public.%I as restrictive for update to authenticated using (coalesce((select role::text from public.profiles where id = (select auth.uid())), 'customer') not in ('owner', 'admin', 'editor') or (select auth.jwt() ->> 'aal') = 'aal2') with check (coalesce((select role::text from public.profiles where id = (select auth.uid())), 'customer') not in ('owner', 'admin', 'editor') or (select auth.jwt() ->> 'aal') = 'aal2')$sql$, table_name);
    execute format($sql$create policy "aal2 required for staff finance deletes" on public.%I as restrictive for delete to authenticated using (coalesce((select role::text from public.profiles where id = (select auth.uid())), 'customer') not in ('owner', 'admin', 'editor') or (select auth.jwt() ->> 'aal') = 'aal2')$sql$, table_name);
  end loop;
end $$;
