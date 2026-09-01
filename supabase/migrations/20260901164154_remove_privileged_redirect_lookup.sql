grant select on public.merchant_redirect_domains to anon;
grant usage on schema private to anon, authenticated;
grant execute on function private.is_approved_merchant_destination(uuid, text) to anon, authenticated;

create policy "public can view active merchant redirect domains"
on public.merchant_redirect_domains for select to anon, authenticated
using (is_active);

create or replace function public.get_safe_offer_redirect(p_offer_id uuid)
returns table(destination_url text, merchant_id uuid, provider_id uuid)
language sql
stable
security invoker
set search_path = ''
as $$
  select o.destination_url, o.merchant_id, o.provider_id
  from public.offers o
  join public.merchants m on m.id = o.merchant_id
  where o.id = p_offer_id
    and o.status = 'active'
    and m.is_active
    and private.is_approved_merchant_destination(o.merchant_id, o.destination_url)
  limit 1;
$$;

revoke all on function public.get_safe_offer_redirect(uuid) from public;
grant execute on function public.get_safe_offer_redirect(uuid) to anon, authenticated;
