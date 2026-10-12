-- Remove isolated demo catalogue/test data from live admin workflows.
-- Retain an inaccessible, recoverable copy before removing the rows.
create schema if not exists private;
create table if not exists private.admin_mock_data_archive (
  table_name text not null,
  row_id uuid not null,
  row_data jsonb not null,
  archived_at timestamptz not null default now(),
  primary key (table_name, row_id)
);
revoke all on table private.admin_mock_data_archive from public, anon, authenticated;

create temporary table _mock_merchants on commit drop as
  select id from public.merchants where storefront_url ilike '%example.com%';
create temporary table _mock_offers on commit drop as
  select id from public.offers
  where destination_url ilike '%example.com%'
     or merchant_id in (select id from _mock_merchants);
create temporary table _mock_products on commit drop as
  select distinct product_id as id from public.offers
  where id in (select id from _mock_offers)
  union
  select id from public.products
  where lower(trim(title)) = 'untitled product'
    and is_active = false
    and manual_metadata->>'auto_created_draft' = 'true';
create temporary table _mock_feeds on commit drop as
  select id from public.product_feeds where feed_url like 'mock://%';
create temporary table _mock_feed_runs on commit drop as
  select id, import_batch_id from public.product_feed_runs
  where feed_id in (select id from _mock_feeds);
create temporary table _mock_batches on commit drop as
  select distinct import_batch_id as id from _mock_feed_runs where import_batch_id is not null;

insert into private.admin_mock_data_archive (table_name, row_id, row_data)
select 'merchants', id, to_jsonb(m) from public.merchants m where id in (select id from _mock_merchants)
on conflict do nothing;
insert into private.admin_mock_data_archive (table_name, row_id, row_data)
select 'offers', id, to_jsonb(o) from public.offers o where id in (select id from _mock_offers)
on conflict do nothing;
insert into private.admin_mock_data_archive (table_name, row_id, row_data)
select 'products', id, to_jsonb(p) from public.products p where id in (select id from _mock_products)
on conflict do nothing;
insert into private.admin_mock_data_archive (table_name, row_id, row_data)
select 'homepage_campaigns', id, to_jsonb(c) from public.homepage_campaigns c where offer_id in (select id from _mock_offers)
on conflict do nothing;
insert into private.admin_mock_data_archive (table_name, row_id, row_data)
select 'merchant_redirect_domains', id, to_jsonb(d) from public.merchant_redirect_domains d where merchant_id in (select id from _mock_merchants)
on conflict do nothing;
insert into private.admin_mock_data_archive (table_name, row_id, row_data)
select 'store_commission_rules', id, to_jsonb(r) from public.store_commission_rules r where merchant_id in (select id from _mock_merchants)
on conflict do nothing;
insert into private.admin_mock_data_archive (table_name, row_id, row_data)
select 'promotion_recommendations', id, to_jsonb(r) from public.promotion_recommendations r where offer_id in (select id from _mock_offers)
on conflict do nothing;
insert into private.admin_mock_data_archive (table_name, row_id, row_data)
select 'redirect_events', id, to_jsonb(e) from public.redirect_events e
where merchant_id in (select id from _mock_merchants) or offer_id in (select id from _mock_offers)
on conflict do nothing;
insert into private.admin_mock_data_archive (table_name, row_id, row_data)
select 'product_feeds', id, to_jsonb(f) from public.product_feeds f where id in (select id from _mock_feeds)
on conflict do nothing;
insert into private.admin_mock_data_archive (table_name, row_id, row_data)
select 'product_feed_runs', id, to_jsonb(r) from public.product_feed_runs r where id in (select id from _mock_feed_runs)
on conflict do nothing;
insert into private.admin_mock_data_archive (table_name, row_id, row_data)
select 'import_batches', id, to_jsonb(b) from public.import_batches b where id in (select id from _mock_batches)
on conflict do nothing;
insert into private.admin_mock_data_archive (table_name, row_id, row_data)
select 'import_batch_rows', id, to_jsonb(r) from public.import_batch_rows r where batch_id in (select id from _mock_batches)
on conflict do nothing;
insert into private.admin_mock_data_archive (table_name, row_id, row_data)
select 'product_feed_mock_items', id, to_jsonb(i) from public.product_feed_mock_items i
on conflict do nothing;
insert into private.admin_mock_data_archive (table_name, row_id, row_data)
select 'affiliate_test_runs', id, to_jsonb(r) from public.affiliate_test_runs r
on conflict do nothing;
insert into private.admin_mock_data_archive (table_name, row_id, row_data)
select 'affiliate_test_events', id, to_jsonb(e) from public.affiliate_test_events e
on conflict do nothing;

delete from public.promotion_recommendations where offer_id in (select id from _mock_offers);
delete from public.store_commission_rules where merchant_id in (select id from _mock_merchants);
delete from public.merchant_redirect_domains where merchant_id in (select id from _mock_merchants);
delete from public.homepage_campaigns where offer_id in (select id from _mock_offers);
delete from public.redirect_events where merchant_id in (select id from _mock_merchants) or offer_id in (select id from _mock_offers);
delete from public.product_feed_mock_items;
delete from public.import_batch_rows where batch_id in (select id from _mock_batches);
delete from public.product_feed_runs where id in (select id from _mock_feed_runs);
delete from public.import_batches where id in (select id from _mock_batches);
delete from public.product_feeds where id in (select id from _mock_feeds);
delete from public.offers where id in (select id from _mock_offers);
delete from public.products where id in (select id from _mock_products);
delete from public.merchants where id in (select id from _mock_merchants);

do $$
declare job_id bigint;
begin
  if to_regclass('cron.job') is not null then
    for job_id in execute 'select jobid from cron.job where jobname = ''glonni-mock-product-feeds-hourly''' loop
      execute 'select cron.unschedule($1)' using job_id;
    end loop;
  end if;
end;
$$;

drop trigger if exists bind_mock_item_to_product on public.import_batch_rows;
drop trigger if exists hold_pending_mock_feed_schedule on public.product_feeds;
drop trigger if exists resume_mock_feed_after_review on public.product_feed_runs;
drop function if exists private.bind_mock_item_to_product();
drop function if exists private.hold_pending_mock_feed_schedule();
drop function if exists private.resume_mock_feed_after_review();
drop function if exists private.stage_due_mock_product_feeds();
drop function if exists public.review_mock_product_feed_run(uuid, boolean, text);
drop table if exists public.product_feed_mock_items;

drop function if exists public.run_affiliate_mock_scenario(text);
drop function if exists public.delete_affiliate_test_run(uuid);
drop table if exists public.affiliate_test_events;
drop table if exists public.affiliate_test_runs;
