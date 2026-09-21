-- Rollback-only test of the protected canonical merge.
begin;
do $$
declare
  admin_id uuid;
  merchant_id uuid;
  canonical_id uuid;
  duplicate_id uuid;
  duplicate_offer_id uuid;
begin
  select p.id into admin_id from public.profiles p join public.employees e on e.profile_id=p.id
    where p.role in ('owner','admin') and e.status='active' limit 1;
  select id into merchant_id from public.merchants where is_active limit 1;
  if admin_id is null or merchant_id is null then raise exception 'Smoke test prerequisites unavailable'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'aal','aal2')::text,true);
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  insert into public.products(title,slug,brand,is_active)
    values('Rollback canonical','rollback-canonical-'||substr(gen_random_uuid()::text,1,8),'Mock',false)
    returning id into canonical_id;
  insert into public.products(title,slug,brand,is_active)
    values('Rollback duplicate','rollback-duplicate-'||substr(gen_random_uuid()::text,1,8),'Mock',false)
    returning id into duplicate_id;
  insert into public.offers(product_id,merchant_id,destination_url,current_price,status)
    values(canonical_id,merchant_id,'https://example.com/canonical',120,'draft');
  insert into public.offers(product_id,merchant_id,destination_url,current_price,status)
    values(duplicate_id,merchant_id,'https://example.com/duplicate',100,'draft')
    returning id into duplicate_offer_id;
  insert into public.product_price_history(product_id,offer_id,price,source)
    values(duplicate_id,duplicate_offer_id,100,'smoke');
  perform public.merge_duplicate_products(canonical_id,duplicate_id);
  if exists(select 1 from public.products where id=duplicate_id)
    or (select count(*) from public.offers where product_id=canonical_id)<>2
    or (select count(*) from public.product_price_history where product_id=canonical_id and offer_id=duplicate_offer_id)<>1 then
    raise exception 'Merge lost a store offer or its price history';
  end if;
end;
$$;
rollback;
