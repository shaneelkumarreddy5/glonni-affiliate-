alter table public.referral_conversions
  alter column offer_id drop not null,
  alter column merchant_id drop not null,
  add column if not exists webhook_event_id uuid references public.provider_webhook_events(id) on delete set null,
  add column if not exists provider_click_reference text,
  add column if not exists currency text not null default 'INR',
  add column if not exists occurred_at timestamptz,
  add column if not exists match_status text not null default 'unmatched',
  add column if not exists match_method text,
  add column if not exists issue_code text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;

alter table public.referral_conversions
  drop constraint if exists referral_conversions_match_status_check,
  add constraint referral_conversions_match_status_check
    check (match_status in ('matched', 'unmatched', 'ambiguous', 'rejected')),
  drop constraint if exists referral_conversions_currency_check,
  add constraint referral_conversions_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  drop constraint if exists referral_conversions_nonnegative_amounts,
  add constraint referral_conversions_nonnegative_amounts check (
    (order_value is null or order_value >= 0)
    and (commission_amount is null or commission_amount >= 0)
    and (cashback_amount is null or cashback_amount >= 0)
  ),
  drop constraint if exists referral_conversions_match_consistency,
  add constraint referral_conversions_match_consistency check (
    (match_status = 'matched' and redirect_event_id is not null and offer_id is not null and merchant_id is not null)
    or match_status <> 'matched'
  );

create unique index if not exists referral_conversions_webhook_event_idx
  on public.referral_conversions(webhook_event_id)
  where webhook_event_id is not null;
create index if not exists referral_conversions_match_queue_idx
  on public.referral_conversions(match_status, created_at desc);
create index if not exists referral_conversions_click_reference_idx
  on public.referral_conversions(provider_id, provider_click_reference)
  where provider_click_reference is not null;

alter table public.provider_webhook_events
  add column if not exists conversion_id uuid references public.referral_conversions(id) on delete set null;

drop policy if exists "admins manage referral lifecycle" on public.referral_conversions;
create policy "aal2 active admins manage referral lifecycle"
on public.referral_conversions for all to authenticated
using (
  (select auth.jwt() ->> 'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p
    join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid())
      and p.role in ('owner', 'admin', 'editor')
      and e.status = 'active'
  )
)
with check (
  (select auth.jwt() ->> 'aal') = 'aal2'
  and exists (
    select 1 from public.profiles p
    join public.employees e on e.profile_id = p.id
    where p.id = (select auth.uid())
      and p.role in ('owner', 'admin', 'editor')
      and e.status = 'active'
  )
);

comment on column public.referral_conversions.provider_payload is
  'Sanitized normalized provider fields only. The signed raw payload remains isolated in private.provider_webhook_payloads.';
comment on column public.referral_conversions.match_status is
  'Operational attribution result; separate from the provider order lifecycle status.';

create or replace function public.store_private_provider_payload(p_event_id uuid, p_payload jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.provider_webhook_payloads(event_id, payload)
  values (p_event_id, p_payload);
$$;
revoke all on function public.store_private_provider_payload(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.store_private_provider_payload(uuid, jsonb) to service_role;

comment on function public.store_private_provider_payload(uuid, jsonb) is
  'Service-role-only gateway for isolating verified raw provider payloads outside the exposed public schema.';
