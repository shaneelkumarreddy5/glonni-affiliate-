create table public.product_feed_mock_items (
  id uuid primary key default gen_random_uuid(),
  feed_id uuid not null references public.product_feeds(id) on delete cascade,
  external_key text not null,
  title text not null,
  brand text,
  category_id uuid not null references public.categories(id) on delete restrict,
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  destination_url text not null check (destination_url ~ '^https://'),
  price numeric(12,2) not null check (price > 0),
  image_url text check (image_url is null or image_url ~ '^https://'),
  match_product_id uuid references public.products(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(feed_id, external_key)
);
create index product_feed_mock_items_feed_idx on public.product_feed_mock_items(feed_id);
alter table public.product_feed_mock_items enable row level security;
revoke all on public.product_feed_mock_items from public, anon;
grant select, insert, update, delete on public.product_feed_mock_items to authenticated;
create policy "aal2 admins manage mock feed items" on public.product_feed_mock_items for all to authenticated
using ((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin') and e.status='active'))
with check ((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin') and e.status='active'));

create schema if not exists private;
create or replace function private.stage_due_mock_product_feeds() returns integer
language plpgsql set search_path=public,private as $$
declare feed_record record; item_record record; batch_id uuid; run_id uuid; item_count integer; item_number integer; next_at timestamptz; staged integer:=0;
begin
  for feed_record in
    select * from public.product_feeds
    where status='active' and feed_url like 'mock://%' and frequency<>'manual'
      and next_run_at is not null and next_run_at<=now()
    for update skip locked
  loop
    select count(*) into item_count from public.product_feed_mock_items where feed_id=feed_record.id;
    insert into public.import_batches(provider_id,source_type,status,source_label,total_rows,valid_rows,invalid_rows,notes)
    values(feed_record.provider_id,'api','approval_required',feed_record.name || ' scheduled mock run',item_count,item_count,0,'Mock feed snapshot; changes require approval')
    returning id into batch_id;
    insert into public.product_feed_runs(feed_id,import_batch_id,status,total_rows,valid_rows,invalid_rows,completed_at)
    values(feed_record.id,batch_id,'pending_review',item_count,item_count,0,now()) returning id into run_id;
    item_number:=0;
    for item_record in select * from public.product_feed_mock_items where feed_id=feed_record.id order by created_at loop
      item_number:=item_number+1;
      insert into public.import_batch_rows(batch_id,row_number,status,raw_data,normalized_data,validation_errors,product_id)
      values(batch_id,item_number,'valid',
        jsonb_build_object('source','mock_feed','external_key',item_record.external_key),
        jsonb_build_object('title',item_record.title,'brand',item_record.brand,'category_id',item_record.category_id,'merchant_id',item_record.merchant_id,'provider_id',feed_record.provider_id,'product_url',item_record.destination_url,'current_price',item_record.price,'image_url',item_record.image_url,'match_product_id',item_record.match_product_id),
        '{}',item_record.match_product_id);
    end loop;
    next_at:=case feed_record.frequency when '6_hours' then now()+interval '6 hours' when '12_hours' then now()+interval '12 hours' when 'daily' then now()+interval '1 day' when 'weekly' then now()+interval '7 days' else null end;
    update public.product_feeds set last_run_at=now(),next_run_at=next_at,updated_at=now() where id=feed_record.id;
    staged:=staged+1;
  end loop;
  return staged;
end;
$$;
revoke all on function private.stage_due_mock_product_feeds() from public,anon,authenticated;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('glonni-mock-product-feeds-hourly','0 * * * *','select private.stage_due_mock_product_feeds()');

create or replace function public.review_mock_product_feed_run(p_run_id uuid,p_approve boolean,p_note text default null)
returns integer language plpgsql security invoker set search_path=public as $$
declare run_record record; row_record record; payload jsonb; target_product_id uuid; target_offer_id uuid; result_count integer:=0; new_slug text;
begin
  if (select auth.jwt()->>'aal')<>'aal2' or not exists(
    select 1 from public.profiles p join public.employees e on e.profile_id=p.id
    where p.id=(select auth.uid()) and p.role in ('owner','admin') and e.status='active'
  ) then raise exception 'Verified administrator required'; end if;
  if not p_approve and nullif(trim(coalesce(p_note,'')),'') is null then raise exception 'A rejection reason is required'; end if;
  select r.*, f.provider_id, f.feed_url into run_record
  from public.product_feed_runs r join public.product_feeds f on f.id=r.feed_id
  where r.id=p_run_id for update of r;
  if not found or run_record.status<>'pending_review' then raise exception 'Feed run is not awaiting review'; end if;
  if run_record.feed_url not like 'mock://%' then raise exception 'Only mock feed runs are handled here'; end if;
  if p_approve then
    for row_record in select * from public.import_batch_rows where batch_id=run_record.import_batch_id and status='valid' order by row_number loop
      payload:=row_record.normalized_data;
      target_product_id:=nullif(payload->>'match_product_id','')::uuid;
      if target_product_id is not null then
        perform 1 from public.products where id=target_product_id for update;
        if not found then raise exception 'Matched product no longer exists'; end if;
      else
        new_slug:=trim(both '-' from regexp_replace(lower(payload->>'title'),'[^a-z0-9]+','-','g')) || '-' || substr(gen_random_uuid()::text,1,8);
        insert into public.products(title,slug,brand,description,category_id,image_url,is_active,manual_metadata)
        values(payload->>'title',new_slug,nullif(payload->>'brand',''),null,nullif(payload->>'category_id','')::uuid,nullif(payload->>'image_url',''),false,
          jsonb_build_object('source','scheduled_mock_feed','review_status','pending_review','import_batch_id',run_record.import_batch_id))
        returning id into target_product_id;
      end if;
      select id into target_offer_id from public.offers
      where product_id=target_product_id and merchant_id=(payload->>'merchant_id')::uuid
        and provider_id is not distinct from run_record.provider_id
      order by created_at limit 1 for update;
      if target_offer_id is null then
        insert into public.offers(product_id,merchant_id,provider_id,destination_url,current_price,status)
        values(target_product_id,(payload->>'merchant_id')::uuid,run_record.provider_id,payload->>'product_url',(payload->>'current_price')::numeric,'draft')
        returning id into target_offer_id;
      else
        update public.offers set destination_url=payload->>'product_url',current_price=(payload->>'current_price')::numeric,updated_at=now()
        where id=target_offer_id;
      end if;
      insert into public.product_price_history(product_id,offer_id,price,source)
      values(target_product_id,target_offer_id,(payload->>'current_price')::numeric,'approved_mock_feed');
      update public.import_batch_rows set product_id=target_product_id where id=row_record.id;
      result_count:=result_count+1;
      target_offer_id:=null;
    end loop;
  end if;
  update public.product_feed_runs set status=case when p_approve then 'approved' else 'rejected' end,
    review_note=nullif(trim(coalesce(p_note,'')),''),reviewed_by=(select auth.uid()),reviewed_at=now()
  where id=p_run_id;
  update public.import_batches set status=case when p_approve then 'approved'::public.import_status else 'rejected'::public.import_status end,
    approved_by=case when p_approve then (select auth.uid()) else null end,
    notes=coalesce(nullif(trim(coalesce(p_note,'')),''),notes),updated_at=now()
  where id=run_record.import_batch_id;
  return result_count;
end;
$$;
revoke all on function public.review_mock_product_feed_run(uuid,boolean,text) from public,anon;
grant execute on function public.review_mock_product_feed_run(uuid,boolean,text) to authenticated;
