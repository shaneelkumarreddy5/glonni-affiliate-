-- A published product must have at least one usable, active merchant offer.
create or replace function private.product_has_publishable_offer(p_product_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.offers o
    where o.product_id = p_product_id
      and o.status = 'active'
      and o.current_price > 0
      and nullif(btrim(o.destination_url), '') is not null
  );
$$;

create or replace function private.require_product_store_offer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_active and not private.product_has_publishable_offer(new.id) then
    raise exception 'Connect an active store offer with a price and destination URL before publishing this product.';
  end if;
  return new;
end;
$$;

create trigger require_product_store_offer
before insert or update of is_active on public.products
for each row execute function private.require_product_store_offer();

create or replace function private.unpublish_product_without_store_offer()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  affected_product_id uuid;
begin
  affected_product_id := case when tg_op = 'DELETE' then old.product_id else new.product_id end;
  if not private.product_has_publishable_offer(affected_product_id) then
    update public.products
    set is_active = false,
        manual_metadata = coalesce(manual_metadata, '{}'::jsonb) || jsonb_build_object(
          'review_status', 'changes_requested',
          'review_note', 'A usable store offer is required before this product can be published.'
        ),
        updated_at = now()
    where id = affected_product_id and is_active;
  end if;
  if tg_op = 'UPDATE' and old.product_id is distinct from new.product_id
     and not private.product_has_publishable_offer(old.product_id) then
    update public.products
    set is_active = false,
        manual_metadata = coalesce(manual_metadata, '{}'::jsonb) || jsonb_build_object(
          'review_status', 'changes_requested',
          'review_note', 'A usable store offer is required before this product can be published.'
        ),
        updated_at = now()
    where id = old.product_id and is_active;
  end if;
  return null;
end;
$$;

create trigger unpublish_product_without_store_offer
after insert or update of product_id, status, current_price, destination_url or delete on public.offers
for each row execute function private.unpublish_product_without_store_offer();

-- Keep the records and mock data, but return previously published incomplete
-- products to the admin review queue instead of showing them to shoppers.
update public.products p
set is_active = false,
    manual_metadata = coalesce(p.manual_metadata, '{}'::jsonb) || jsonb_build_object(
      'review_status', 'changes_requested',
      'review_note', 'Connect an active store offer with a price and destination URL before publishing.'
    ),
    updated_at = now()
where p.is_active and not private.product_has_publishable_offer(p.id);
