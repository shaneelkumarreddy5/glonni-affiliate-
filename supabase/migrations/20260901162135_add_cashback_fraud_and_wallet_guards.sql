alter table public.cashback_claims
  add column order_reference_normalized text,
  add column conversion_id uuid references public.referral_conversions(id) on delete set null,
  add column risk_score integer not null default 0 check (risk_score between 0 and 100),
  add column risk_level text not null default 'low' check (risk_level in ('low', 'medium', 'high', 'critical')),
  add column risk_reasons jsonb not null default '[]'::jsonb;

alter table public.withdrawal_requests
  add column risk_score integer not null default 0 check (risk_score between 0 and 100),
  add column risk_level text not null default 'low' check (risk_level in ('low', 'medium', 'high', 'critical')),
  add column risk_reasons jsonb not null default '[]'::jsonb;

create table public.financial_risk_signals (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references public.cashback_claims(id) on delete cascade,
  withdrawal_id uuid references public.withdrawal_requests(id) on delete cascade,
  signal_code text not null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check ((claim_id is null) <> (withdrawal_id is null))
);

create unique index cashback_claims_profile_reference_unique on public.cashback_claims(profile_id, order_reference_normalized);
create unique index wallet_entries_confirmed_claim_unique on public.wallet_entries(claim_id) where entry_type = 'cashback_confirmed';
create unique index withdrawal_requests_one_open_per_profile on public.withdrawal_requests(profile_id) where status in ('requested', 'on_hold', 'approved');
create index financial_risk_signals_claim_time_idx on public.financial_risk_signals(claim_id, created_at desc);
create index financial_risk_signals_withdrawal_time_idx on public.financial_risk_signals(withdrawal_id, created_at desc);

alter table public.financial_risk_signals enable row level security;
revoke all on public.financial_risk_signals from public, anon;
grant select on public.financial_risk_signals to authenticated;
create policy "aal2 owner admin view financial risk signals" on public.financial_risk_signals
for select to authenticated using (
  (select auth.jwt() ->> 'aal') = 'aal2'
  and (select role from public.profiles where id = (select auth.uid())) in ('owner', 'admin')
);

drop policy if exists "admins manage cashback operations" on public.cashback_claims;
create policy "owners admins manage cashback operations" on public.cashback_claims for all to authenticated
using ((select role from public.profiles where id = (select auth.uid())) in ('owner', 'admin'))
with check ((select role from public.profiles where id = (select auth.uid())) in ('owner', 'admin'));

create or replace function private.enrich_cashback_claim()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  score integer := 0;
  reasons text[] := array[]::text[];
  tracked boolean;
begin
  new.order_reference_normalized := regexp_replace(upper(trim(new.order_reference)), '[^A-Z0-9]', '', 'g');
  if char_length(new.order_reference_normalized) < 3 then
    raise exception 'order reference is not valid';
  end if;
  new.conversion_id := null;

  if new.offer_id is null then
    score := score + 25; reasons := array_append(reasons, 'offer_not_selected');
  else
    select cashback_tracking_supported into tracked from public.offers where id = new.offer_id and status = 'active';
    if coalesce(tracked, false) is false then
      score := score + 65; reasons := array_append(reasons, 'offer_not_cashback_eligible');
    end if;
  end if;
  if new.claimed_amount > new.purchase_amount * 0.25 then
    score := score + 30; reasons := array_append(reasons, 'cashback_ratio_unusual');
  end if;
  if new.claimed_amount >= 10000 then
    score := score + 30; reasons := array_append(reasons, 'cashback_amount_high');
  end if;
  if exists (select 1 from public.cashback_claims where order_reference_normalized = new.order_reference_normalized) then
    score := 100; reasons := array_append(reasons, 'order_reference_already_claimed');
  end if;

  new.risk_score := least(score, 100);
  new.risk_level := case when score >= 80 then 'critical' when score >= 60 then 'high' when score >= 30 then 'medium' else 'low' end;
  new.risk_reasons := to_jsonb(reasons);
  return new;
end;
$$;
revoke all on function private.enrich_cashback_claim() from public, anon, authenticated;

create or replace function private.hold_risky_cashback_claim()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.risk_score >= 60 then
    update public.cashback_claims set status = 'needs_info', reviewer_note = 'Automatically held by fraud controls.', updated_at = now() where id = new.id;
  end if;
  insert into public.financial_risk_signals(claim_id, signal_code, risk_level, detail)
  select new.id, item, new.risk_level, jsonb_build_object('score', new.risk_score)
  from jsonb_array_elements_text(new.risk_reasons) as item;
  return new;
end;
$$;
revoke all on function private.hold_risky_cashback_claim() from public, anon, authenticated;

drop trigger if exists enrich_cashback_claim_before_insert on public.cashback_claims;
create trigger enrich_cashback_claim_before_insert before insert on public.cashback_claims for each row execute function private.enrich_cashback_claim();
drop trigger if exists hold_risky_cashback_claim_after_insert on public.cashback_claims;
create trigger hold_risky_cashback_claim_after_insert after insert on public.cashback_claims for each row execute function private.hold_risky_cashback_claim();

create or replace function private.issue_confirmed_cashback()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare conversion_record public.referral_conversions%rowtype;
begin
  if new.status <> 'confirmed' or old.status = 'confirmed' then return new; end if;
  if new.risk_score >= 60 then raise exception 'high-risk claim cannot be confirmed'; end if;
  if new.conversion_id is null then raise exception 'provider-confirmed conversion is required before cashback credit'; end if;
  select * into conversion_record from public.referral_conversions where id = new.conversion_id;
  if conversion_record.id is null or conversion_record.profile_id <> new.profile_id or conversion_record.status <> 'confirmed' or conversion_record.cashback_eligible is not true or coalesce(conversion_record.cashback_amount, 0) <= 0 then
    raise exception 'linked conversion is not eligible for cashback credit';
  end if;
  insert into public.wallet_entries(profile_id, claim_id, entry_type, amount, note, created_by)
  values (new.profile_id, new.id, 'cashback_confirmed', conversion_record.cashback_amount, 'Provider-confirmed cashback', new.reviewed_by);
  return new;
end;
$$;
revoke all on function private.issue_confirmed_cashback() from public, anon, authenticated;
drop trigger if exists issue_confirmed_cashback_after_update on public.cashback_claims;
create trigger issue_confirmed_cashback_after_update after update of status on public.cashback_claims for each row execute function private.issue_confirmed_cashback();

create or replace function private.guard_wallet_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare claim_record public.cashback_claims%rowtype; conversion_record public.referral_conversions%rowtype;
begin
  if tg_op in ('UPDATE', 'DELETE') then raise exception 'wallet ledger entries are immutable; add a reversal entry instead'; end if;
  if new.entry_type <> 'cashback_confirmed' then return new; end if;
  select * into claim_record from public.cashback_claims where id = new.claim_id;
  if claim_record.id is null or claim_record.status <> 'confirmed' or claim_record.conversion_id is null or claim_record.risk_score >= 60 then raise exception 'cashback ledger credit is not authorized'; end if;
  select * into conversion_record from public.referral_conversions where id = claim_record.conversion_id;
  if conversion_record.id is null or conversion_record.status <> 'confirmed' or conversion_record.cashback_eligible is not true or conversion_record.profile_id <> new.profile_id or new.amount <> conversion_record.cashback_amount then raise exception 'cashback ledger amount must match the confirmed provider conversion'; end if;
  return new;
end;
$$;
revoke all on function private.guard_wallet_entry() from public, anon, authenticated;
drop trigger if exists guard_wallet_entry_before_write on public.wallet_entries;
create trigger guard_wallet_entry_before_write before insert or update or delete on public.wallet_entries for each row execute function private.guard_wallet_entry();

create or replace function private.guard_withdrawal_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare ledger numeric := 0; reserved numeric := 0; score integer := 0; reasons text[] := array[]::text[];
begin
  perform 1 from public.profiles where id = new.profile_id for update;
  if new.upi_id !~ '^[A-Za-z0-9._-]{2,100}@[A-Za-z0-9.-]{2,100}$' then raise exception 'UPI ID is not valid'; end if;
  select coalesce(sum(amount), 0) into ledger from public.wallet_entries where profile_id = new.profile_id;
  select coalesce(sum(amount), 0) into reserved from public.withdrawal_requests where profile_id = new.profile_id and status in ('requested', 'on_hold', 'approved');
  if new.amount > greatest(ledger - reserved, 0) then raise exception 'withdrawal amount exceeds confirmed available cashback'; end if;
  if new.amount >= 5000 then score := score + 60; reasons := array_append(reasons, 'high_value_withdrawal'); end if;
  if exists (select 1 from public.withdrawal_requests where profile_id = new.profile_id and upi_id <> new.upi_id and created_at > now() - interval '30 days') then score := score + 30; reasons := array_append(reasons, 'recent_upi_change'); end if;
  new.risk_score := least(score,100);
  new.risk_level := case when score >= 80 then 'critical' when score >= 60 then 'high' when score >= 30 then 'medium' else 'low' end;
  new.risk_reasons := to_jsonb(reasons);
  return new;
end;
$$;
revoke all on function private.guard_withdrawal_request() from public, anon, authenticated;

create or replace function private.hold_risky_withdrawal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.risk_score >= 60 then
    update public.withdrawal_requests set status = 'on_hold', reviewer_note = 'Automatically held by fraud controls.', updated_at = now() where id = new.id;
  end if;
  insert into public.financial_risk_signals(withdrawal_id, signal_code, risk_level, detail)
  select new.id, item, new.risk_level, jsonb_build_object('score', new.risk_score)
  from jsonb_array_elements_text(new.risk_reasons) as item;
  return new;
end;
$$;
revoke all on function private.hold_risky_withdrawal() from public, anon, authenticated;
drop trigger if exists guard_withdrawal_request_before_insert on public.withdrawal_requests;
create trigger guard_withdrawal_request_before_insert before insert on public.withdrawal_requests for each row execute function private.guard_withdrawal_request();
drop trigger if exists hold_risky_withdrawal_after_insert on public.withdrawal_requests;
create trigger hold_risky_withdrawal_after_insert after insert on public.withdrawal_requests for each row execute function private.hold_risky_withdrawal();
