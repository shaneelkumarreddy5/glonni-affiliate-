alter table public.redirect_events
  add column if not exists reward_type_snapshot text,
  add column if not exists cashback_fixed_snapshot numeric(12,2),
  add column if not exists cashback_percent_snapshot numeric(5,2),
  add column if not exists cashback_cap_snapshot numeric(12,2),
  add column if not exists reward_funding_source_snapshot text,
  add column if not exists cashback_tracking_supported_snapshot boolean,
  add column if not exists commission_rate_snapshot numeric(7,3),
  add column if not exists commission_fixed_snapshot numeric(12,2),
  add column if not exists reward_terms_snapshot text;

alter table public.referral_conversions
  add column if not exists reward_type_snapshot text,
  add column if not exists cashback_fixed_snapshot numeric(12,2),
  add column if not exists cashback_percent_snapshot numeric(5,2),
  add column if not exists cashback_cap_snapshot numeric(12,2),
  add column if not exists reward_funding_source_snapshot text,
  add column if not exists cashback_tracking_supported_snapshot boolean,
  add column if not exists commission_rate_snapshot numeric(7,3),
  add column if not exists commission_fixed_snapshot numeric(12,2),
  add column if not exists financial_validation_status text not null default 'not_ready',
  add column if not exists expected_commission numeric(12,2),
  add column if not exists commission_variance numeric(12,2),
  add column if not exists proposed_cashback numeric(12,2),
  add column if not exists retained_margin numeric(12,2),
  add column if not exists financial_issue_codes jsonb not null default '[]'::jsonb,
  add column if not exists financially_reviewed_at timestamptz,
  add column if not exists financially_reviewed_by uuid references public.profiles(id) on delete set null;

alter table public.referral_conversions
  drop constraint if exists referral_conversions_financial_status_check,
  add constraint referral_conversions_financial_status_check check
    (financial_validation_status in ('not_ready','ready','needs_review','approved','held','rejected')),
  drop constraint if exists referral_conversions_financial_amounts_check,
  add constraint referral_conversions_financial_amounts_check check (
    (expected_commission is null or expected_commission >= 0)
    and (proposed_cashback is null or proposed_cashback >= 0)
  ),
  drop constraint if exists referral_conversions_financial_approval_check,
  add constraint referral_conversions_financial_approval_check check (
    financial_validation_status <> 'approved' or (
      match_status = 'matched' and status = 'confirmed' and cashback_amount = proposed_cashback and (
        (coalesce(proposed_cashback,0) > 0 and cashback_eligible)
        or (coalesce(proposed_cashback,0) = 0 and cashback_eligible is false)
      )
    )
  );

create table public.conversion_financial_reviews (
  id uuid primary key default gen_random_uuid(),
  conversion_id uuid not null references public.referral_conversions(id) on delete restrict,
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  decision text not null check (decision in ('prepared','approved','held','rejected')),
  provider_commission numeric(12,2),
  expected_commission numeric(12,2),
  commission_variance numeric(12,2),
  proposed_cashback numeric(12,2),
  retained_margin numeric(12,2),
  issue_codes jsonb not null default '[]'::jsonb check (jsonb_typeof(issue_codes) = 'array'),
  note text,
  created_at timestamptz not null default now()
);
create index conversion_financial_reviews_conversion_time_idx
  on public.conversion_financial_reviews(conversion_id, created_at desc);
alter table public.conversion_financial_reviews enable row level security;
revoke all on public.conversion_financial_reviews from public, anon;
grant select, insert on public.conversion_financial_reviews to authenticated;
create policy "aal2 active finance admins view reviews" on public.conversion_financial_reviews
for select to authenticated using (
  (select auth.jwt() ->> 'aal') = 'aal2' and exists (
    select 1 from public.profiles p join public.employees e on e.profile_id=p.id
    where p.id=(select auth.uid()) and p.role in ('owner','admin') and e.status='active'
  )
);
create policy "aal2 active finance admins create reviews" on public.conversion_financial_reviews
for insert to authenticated with check (
  reviewer_id=(select auth.uid()) and (select auth.jwt() ->> 'aal')='aal2' and exists (
    select 1 from public.profiles p join public.employees e on e.profile_id=p.id
    where p.id=(select auth.uid()) and p.role in ('owner','admin') and e.status='active'
  )
);

drop function if exists public.get_safe_offer_redirect(uuid);
create function public.get_safe_offer_redirect(p_offer_id uuid)
returns table(
  destination_url text, merchant_id uuid, provider_id uuid, click_reference_parameter text,
  reward_type text, cashback_amount numeric, cashback_percent numeric, cashback_cap numeric,
  reward_funding_source text, cashback_tracking_supported boolean, commission_rate numeric, commission_amount numeric, reward_terms text
)
language sql stable security invoker set search_path=''
as $$
  select o.destination_url,o.merchant_id,o.provider_id,
    case when ap.is_active and ap.attribution_enabled then ap.click_reference_parameter else null end,
    o.reward_type,o.cashback_amount,o.cashback_percent,o.cashback_cap,o.reward_funding_source,o.cashback_tracking_supported,
    o.commission_rate,o.commission_amount,o.reward_terms
  from public.offers o join public.merchants m on m.id=o.merchant_id
  left join public.affiliate_providers ap on ap.id=o.provider_id
  where o.id=p_offer_id and o.status='active' and m.is_active
    and private.is_approved_merchant_destination(o.merchant_id,o.destination_url)
  limit 1;
$$;
revoke all on function public.get_safe_offer_redirect(uuid) from public;
grant execute on function public.get_safe_offer_redirect(uuid) to anon, authenticated;

comment on table public.conversion_financial_reviews is
  'Append-only audit history of commission validation and cashback decisions; no wallet mutation occurs here.';
