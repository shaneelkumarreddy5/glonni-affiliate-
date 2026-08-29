alter table public.offers
  add column if not exists reward_type text not null default 'none',
  add column if not exists cashback_percent numeric(5,2),
  add column if not exists cashback_cap numeric(12,2),
  add column if not exists coupon_code text,
  add column if not exists reward_terms text,
  add column if not exists cashback_tracking_supported boolean not null default false,
  add column if not exists reward_funding_source text not null default 'none';

alter table public.offers
  drop constraint if exists offers_reward_type_check,
  add constraint offers_reward_type_check check (reward_type in ('none', 'fixed_cashback', 'percentage_cashback', 'coupon', 'merchant_promotion')),
  drop constraint if exists offers_reward_funding_source_check,
  add constraint offers_reward_funding_source_check check (reward_funding_source in ('none', 'glonni', 'merchant', 'provider'));

update public.offers
set reward_type = 'fixed_cashback',
    cashback_tracking_supported = true,
    reward_funding_source = 'provider'
where coalesce(cashback_amount, 0) > 0
  and reward_type = 'none';
