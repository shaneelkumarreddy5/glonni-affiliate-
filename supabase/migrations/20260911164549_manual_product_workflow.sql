alter table public.products
  add column if not exists manual_metadata jsonb not null default '{}'::jsonb;

alter table public.products
  drop constraint if exists products_manual_metadata_object,
  add constraint products_manual_metadata_object
    check (jsonb_typeof(manual_metadata) = 'object');

comment on column public.products.manual_metadata is
  'Draft-only manual merchandising fields such as model code, tags, SEO, placement and related products.';

alter table public.offers
  add column if not exists commission_rate numeric(7, 3),
  add column if not exists commission_amount numeric(12, 2);

alter table public.offers
  drop constraint if exists offers_commission_rate_range,
  add constraint offers_commission_rate_range
    check (commission_rate is null or commission_rate between 0 and 100),
  drop constraint if exists offers_commission_amount_nonnegative,
  add constraint offers_commission_amount_nonnegative
    check (commission_amount is null or commission_amount >= 0);
