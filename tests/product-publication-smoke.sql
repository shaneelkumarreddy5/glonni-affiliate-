-- Rollback-only database integration check. No product, offer or click survives.
begin;
do $$
declare
  v_category_id uuid;
  v_merchant_id uuid;
  approved_domain text;
  v_product_id uuid;
  v_offer_id uuid;
  v_product_slug text := 'rollback-publication-' || replace(gen_random_uuid()::text, '-', '');
  v_destination text;
  blocked boolean := false;
  visible_count integer;
begin
  select id into v_category_id from public.categories
  where is_active and archived_at is null limit 1;
  select m.id, d.domain into v_merchant_id, approved_domain
  from public.merchants m
  join public.merchant_redirect_domains d on d.merchant_id = m.id
  where m.is_active and d.is_active limit 1;
  if v_category_id is null or v_merchant_id is null then
    raise exception 'Publication smoke prerequisites unavailable';
  end if;
  v_destination := 'https://' || approved_domain || '/glonni-publication-smoke';

  insert into public.products(title, slug, brand, category_id, image_url, is_active)
  values('Rollback publication check', v_product_slug, 'Mock', v_category_id,
    'https://example.com/mock-image.jpg', false)
  returning id into v_product_id;

  begin
    update public.products set is_active = true where id = v_product_id;
  exception when others then
    blocked := true;
  end;
  if not blocked then raise exception 'Publishing without a store offer was allowed'; end if;

  insert into public.offers(product_id, merchant_id, destination_url, current_price, status)
  values(v_product_id, v_merchant_id, v_destination, 199, 'draft')
  returning id into v_offer_id;
  blocked := false;
  begin
    update public.products set is_active = true where id = v_product_id;
  exception when others then
    blocked := true;
  end;
  if not blocked then raise exception 'Publishing with a draft offer was allowed'; end if;

  update public.offers set status = 'active' where id = v_offer_id;
  update public.products set is_active = true where id = v_product_id;
  select count(*) into visible_count
  from public.offers o
  join public.products p on p.id = o.product_id
  join public.merchants m on m.id = o.merchant_id
  where o.id = v_offer_id and p.slug = v_product_slug and m.id = v_merchant_id
    and p.is_active and m.is_active and o.status = 'active'
    and o.current_price > 0 and nullif(o.destination_url, '') is not null;
  if visible_count <> 1 then raise exception 'Approved product is missing from global or store catalogue'; end if;
  if not exists (
    select 1 from public.get_safe_offer_redirect(v_offer_id) r
    where r.merchant_id = v_merchant_id and r.destination_url = v_destination
  ) then raise exception 'Approved offer has no safe tracked destination'; end if;

  update public.products set is_active = false where id = v_product_id;
  if exists (
    select 1 from public.offers o join public.products p on p.id = o.product_id
    where o.id = v_offer_id and p.is_active
  ) then raise exception 'Unpublished product remains customer-visible'; end if;

  update public.products set is_active = true where id = v_product_id;
  update public.offers set status = 'inactive' where id = v_offer_id;
  if exists(select 1 from public.products where id = v_product_id and is_active) then
    raise exception 'Product remained published after its last usable offer was disabled';
  end if;
  if exists(select 1 from public.get_safe_offer_redirect(v_offer_id)) then
    raise exception 'Inactive offer still has a redirect destination';
  end if;
end;
$$;
rollback;
