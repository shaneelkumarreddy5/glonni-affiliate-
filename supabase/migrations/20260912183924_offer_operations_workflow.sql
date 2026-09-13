alter table public.offers
  add column if not exists review_status text not null default 'draft',
  add column if not exists bank_offers jsonb not null default '[]'::jsonb,
  add column if not exists quality_score integer not null default 0,
  add column if not exists quality_issues jsonb not null default '[]'::jsonb,
  add column if not exists last_checked_at timestamptz,
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;

alter table public.offers
  drop constraint if exists offers_review_status_check,
  add constraint offers_review_status_check
    check (review_status in ('draft', 'in_review', 'approved', 'rejected')),
  drop constraint if exists offers_bank_offers_array,
  add constraint offers_bank_offers_array check (jsonb_typeof(bank_offers) = 'array'),
  drop constraint if exists offers_quality_score_range,
  add constraint offers_quality_score_range check (quality_score between 0 and 100),
  drop constraint if exists offers_quality_issues_array,
  add constraint offers_quality_issues_array check (jsonb_typeof(quality_issues) = 'array');

create index if not exists offers_review_status_updated_idx
  on public.offers(review_status, updated_at desc);
create index if not exists offers_provider_status_idx
  on public.offers(provider_id, status, updated_at desc);

update public.offers
set review_status = case when status = 'active' then 'approved' else 'draft' end,
    quality_score = case
      when destination_url is not null and current_price is not null then 70
      else 30
    end,
    quality_issues = case
      when destination_url is null then '["Missing destination URL"]'::jsonb
      when current_price is null then '["Missing current price"]'::jsonb
      else '[]'::jsonb
    end
where review_status = 'draft';

comment on column public.offers.review_status is
  'Administrative lifecycle. Public visibility remains controlled by status=active.';
comment on column public.offers.bank_offers is
  'Provider-specific bank and payment promotions attached only to this seller offer.';
