-- Rollback-only integration check. No fixture survives this transaction.
begin;
do $$
declare
  admin_id uuid;
  category_id uuid;
  merchant_id uuid;
  v_feed_id uuid;
  first_run_id uuid;
  second_run_id uuid;
  v_batch_id uuid;
  v_product_id uuid;
  result_count integer;
begin
  select p.id into admin_id from public.profiles p join public.employees e on e.profile_id=p.id
    where p.role in ('owner','admin') and e.status='active' limit 1;
  select id into category_id from public.categories where is_active limit 1;
  select id into merchant_id from public.merchants where is_active limit 1;
  if admin_id is null or category_id is null or merchant_id is null then
    raise exception 'Smoke test prerequisites unavailable';
  end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'aal','aal2')::text,true);
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  insert into public.product_feeds(name,feed_url,file_format,frequency,status,next_run_at,created_by)
  values('Rollback-only feed smoke','mock://smoke','csv','daily','active',now()-interval '1 minute',admin_id)
  returning id into v_feed_id;
  insert into public.product_feed_mock_items(feed_id,external_key,title,brand,category_id,merchant_id,destination_url,price,image_url)
  values(v_feed_id,'smoke-1','Rollback-only mock product','Mock',category_id,merchant_id,'https://example.com/mock-product',99,null);
  perform private.stage_due_mock_product_feeds();
  select id,import_batch_id into first_run_id,v_batch_id from public.product_feed_runs where product_feed_runs.feed_id=v_feed_id limit 1;
  if first_run_id is null or (select count(*) from public.import_batch_rows where import_batch_rows.batch_id=v_batch_id)<>1 then
    raise exception 'Scheduled staging did not create a reviewable row';
  end if;
  select public.review_mock_product_feed_run(first_run_id,true,'Smoke approval') into result_count;
  if result_count<>1 then raise exception 'Approval did not apply one row'; end if;
  select product_id into v_product_id from public.import_batch_rows where import_batch_rows.batch_id=v_batch_id limit 1;
  if v_product_id is null
    or (select is_active from public.products where id=v_product_id)
    or (select count(*) from public.offers where offers.product_id=v_product_id)<>1
    or (select count(*) from public.product_price_history where product_price_history.product_id=v_product_id)<>1
    or (select match_product_id from public.product_feed_mock_items where product_feed_mock_items.feed_id=v_feed_id) is distinct from v_product_id then
    raise exception 'Approval did not preserve draft, offer, price history and repeat-run match';
  end if;
  update public.product_feeds set next_run_at=now()-interval '1 minute' where id=v_feed_id;
  perform private.stage_due_mock_product_feeds();
  select id into second_run_id from public.product_feed_runs where product_feed_runs.feed_id=v_feed_id and status='pending_review' limit 1;
  if second_run_id is null then raise exception 'Second run was not staged'; end if;
  perform public.review_mock_product_feed_run(second_run_id,false,'Smoke rejection');
  if (select count(*) from public.product_price_history where product_price_history.product_id=v_product_id)<>1 then
    raise exception 'Rejected run changed price history';
  end if;
end;
$$;
rollback;
