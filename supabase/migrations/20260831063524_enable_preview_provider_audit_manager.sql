-- Temporary no-login preview access. Replace these with authenticated admin-only
-- policies before connecting live providers or accepting operational data.
create policy "preview manages providers" on public.affiliate_providers
for all to anon, authenticated using (true) with check (true);

create policy "preview manages audit events" on public.audit_events
for all to anon, authenticated using (true) with check (true);
