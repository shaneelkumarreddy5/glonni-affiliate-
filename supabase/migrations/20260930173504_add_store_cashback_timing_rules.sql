alter table public.merchants
  add column if not exists purchase_tracking_hours integer,
  add column if not exists cashback_confirmation_days integer,
  add column if not exists wallet_credit_days integer;

alter table public.merchants
  drop constraint if exists merchants_purchase_tracking_hours_range,
  add constraint merchants_purchase_tracking_hours_range
    check (purchase_tracking_hours is null or purchase_tracking_hours between 0 and 8760),
  drop constraint if exists merchants_cashback_confirmation_days_range,
  add constraint merchants_cashback_confirmation_days_range
    check (cashback_confirmation_days is null or cashback_confirmation_days between 0 and 365),
  drop constraint if exists merchants_wallet_credit_days_range,
  add constraint merchants_wallet_credit_days_range
    check (wallet_credit_days is null or wallet_credit_days between 0 and 365);
