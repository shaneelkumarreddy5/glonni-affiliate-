alter table public.products
  add column if not exists gallery_images jsonb not null default '[]'::jsonb,
  add column if not exists variants jsonb not null default '[]'::jsonb,
  add column if not exists specifications jsonb not null default '[]'::jsonb,
  add column if not exists product_information jsonb not null default '{}'::jsonb;

alter table public.products
  drop constraint if exists products_gallery_images_array,
  add constraint products_gallery_images_array check (jsonb_typeof(gallery_images) = 'array'),
  drop constraint if exists products_variants_array,
  add constraint products_variants_array check (jsonb_typeof(variants) = 'array'),
  drop constraint if exists products_specifications_array,
  add constraint products_specifications_array check (jsonb_typeof(specifications) = 'array'),
  drop constraint if exists products_information_object,
  add constraint products_information_object check (jsonb_typeof(product_information) = 'object');

alter table public.offers
  add column if not exists bank_offer text,
  add column if not exists customer_rating numeric(2,1),
  add column if not exists rating_count integer,
  add column if not exists stock_status text not null default 'unknown',
  add column if not exists cashback_confirmation_days integer,
  add column if not exists variant_label text;

alter table public.offers
  drop constraint if exists offers_customer_rating_range,
  add constraint offers_customer_rating_range check (customer_rating is null or customer_rating between 0 and 5),
  drop constraint if exists offers_rating_count_nonnegative,
  add constraint offers_rating_count_nonnegative check (rating_count is null or rating_count >= 0),
  drop constraint if exists offers_stock_status_check,
  add constraint offers_stock_status_check check (stock_status in ('in_stock','low_stock','out_of_stock','preorder','unknown')),
  drop constraint if exists offers_cashback_days_positive,
  add constraint offers_cashback_days_positive check (cashback_confirmation_days is null or cashback_confirmation_days between 0 and 365);

create table if not exists public.product_price_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  offer_id uuid references public.offers(id) on delete cascade,
  price numeric(12,2) not null check (price >= 0),
  recorded_at timestamptz not null default now(),
  source text not null default 'admin'
);

create index if not exists product_price_history_product_recorded_idx
  on public.product_price_history(product_id, recorded_at desc);
create index if not exists product_price_history_offer_idx
  on public.product_price_history(offer_id);

alter table public.product_price_history enable row level security;
revoke all on table public.product_price_history from anon, authenticated;
grant select on table public.product_price_history to anon, authenticated;
grant select, insert, update, delete on table public.product_price_history to authenticated;

create policy "public reads published product price history"
on public.product_price_history for select
to anon, authenticated
using (exists (
  select 1 from public.products p
  where p.id = product_price_history.product_id and p.is_active
));

create policy "staff reads product price history"
on public.product_price_history for select
to authenticated
using ((select role from public.profiles where id = (select auth.uid())) in ('editor','admin','owner'));

create policy "admins insert product price history"
on public.product_price_history for insert
to authenticated
with check ((select role from public.profiles where id = (select auth.uid())) in ('admin','owner'));

create policy "admins update product price history"
on public.product_price_history for update
to authenticated
using ((select role from public.profiles where id = (select auth.uid())) in ('admin','owner'))
with check ((select role from public.profiles where id = (select auth.uid())) in ('admin','owner'));

create policy "admins delete product price history"
on public.product_price_history for delete
to authenticated
using ((select role from public.profiles where id = (select auth.uid())) in ('admin','owner'));
