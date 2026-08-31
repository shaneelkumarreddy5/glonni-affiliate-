-- Platform stabilization: the public website stays readable while all
-- unauthenticated catalogue and operations writes are removed.

drop policy if exists "preview manages categories" on public.categories;
drop policy if exists "preview manages merchants" on public.merchants;
drop policy if exists "preview manages products" on public.products;
drop policy if exists "preview manages offers" on public.offers;
drop policy if exists "preview manages providers" on public.affiliate_providers;
drop policy if exists "preview manages audit events" on public.audit_events;

-- Public catalogue: signed-out shoppers can read active rows through the
-- existing RLS policies, but cannot create, change, or delete catalogue data.
revoke all on table public.categories, public.merchants, public.products, public.offers from public;
revoke insert, update, delete, truncate, references, trigger on table public.categories, public.merchants, public.products, public.offers from anon;
grant select on table public.categories, public.merchants, public.products, public.offers to anon;
grant select, insert, update, delete on table public.categories, public.merchants, public.products, public.offers to authenticated;

-- Operational tables are never available to an unsigned browser. Existing
-- authenticated owner/admin RLS policies remain in force for future login.
revoke all on table public.profiles, public.affiliate_providers, public.import_batches, public.audit_events, public.ai_agents from public, anon;
grant select, insert, update, delete on table public.profiles, public.affiliate_providers, public.import_batches, public.ai_agents to authenticated;
grant select, insert on table public.audit_events to authenticated;

-- Redirect tracking is the only anonymous write retained. Its INSERT policy
-- already requires an active offer and matching merchant.
revoke all on table public.redirect_events from public, anon;
grant insert on table public.redirect_events to anon;
grant select, insert on table public.redirect_events to authenticated;
