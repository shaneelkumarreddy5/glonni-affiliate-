alter table public.redirect_events add column if not exists cashback_confirmation_days_snapshot integer;
alter table public.referral_conversions add column if not exists cashback_confirmation_days_snapshot integer;

create table public.cashback_awards (
  id uuid primary key default gen_random_uuid(),
  conversion_id uuid not null unique references public.referral_conversions(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending' check (status in ('pending','held','confirmed','reversed','rejected')),
  available_at timestamptz not null,
  hold_reason text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cashback_awards_profile_status_idx on public.cashback_awards(profile_id,status,created_at desc);
create index cashback_awards_available_idx on public.cashback_awards(status,available_at) where status='pending';
alter table public.cashback_awards enable row level security;
revoke all on public.cashback_awards from public,anon;
grant select,insert,update on public.cashback_awards to authenticated;
create policy "customers view own cashback awards" on public.cashback_awards for select to authenticated
using (profile_id=(select auth.uid()));
create policy "aal2 active finance admins manage cashback awards" on public.cashback_awards for all to authenticated
using ((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin') and e.status='active'))
with check ((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin') and e.status='active'));

alter table public.wallet_entries add column if not exists award_id uuid references public.cashback_awards(id) on delete restrict;
create unique index wallet_entries_award_type_unique on public.wallet_entries(award_id,entry_type) where award_id is not null;

create or replace function private.guard_wallet_entry()
returns trigger language plpgsql security definer set search_path=''
as $$
declare claim_record public.cashback_claims%rowtype; conversion_record public.referral_conversions%rowtype; award_record public.cashback_awards%rowtype;
begin
  if tg_op in ('UPDATE','DELETE') then raise exception 'wallet ledger entries are immutable; add a reversal entry instead'; end if;
  if new.entry_type not in ('cashback_confirmed','cashback_reversed') then return new; end if;
  if new.award_id is not null then
    select * into award_record from public.cashback_awards where id=new.award_id;
    if award_record.id is null or award_record.profile_id<>new.profile_id then raise exception 'cashback award is not valid for this wallet'; end if;
    if new.entry_type='cashback_confirmed' and (award_record.status<>'confirmed' or new.amount<>award_record.amount) then raise exception 'confirmed ledger amount must match the confirmed cashback award'; end if;
    if new.entry_type='cashback_reversed' and (award_record.status<>'reversed' or new.amount<>-award_record.amount) then raise exception 'reversal must negate the cashback award exactly'; end if;
    return new;
  end if;
  if new.entry_type<>'cashback_confirmed' then raise exception 'claim-based cashback reversals require an award record'; end if;
  select * into claim_record from public.cashback_claims where id=new.claim_id;
  if claim_record.id is null or claim_record.status<>'confirmed' or claim_record.conversion_id is null or claim_record.risk_score>=60 then raise exception 'cashback ledger credit is not authorized'; end if;
  select * into conversion_record from public.referral_conversions where id=claim_record.conversion_id;
  if conversion_record.id is null or conversion_record.status<>'confirmed' or conversion_record.cashback_eligible is not true or conversion_record.profile_id<>new.profile_id or new.amount<>conversion_record.cashback_amount then raise exception 'cashback ledger amount must match the confirmed provider conversion'; end if;
  return new;
end;$$;
revoke all on function private.guard_wallet_entry() from public,anon,authenticated;

create or replace function public.issue_cashback_award(p_conversion_id uuid)
returns uuid language plpgsql security invoker set search_path=''
as $$
declare c public.referral_conversions%rowtype; award_id uuid;
begin
  select * into c from public.referral_conversions where id=p_conversion_id;
  if c.id is null or c.financial_validation_status<>'approved' or c.status<>'confirmed' or c.match_status<>'matched' or c.profile_id is null or c.cashback_eligible is not true or coalesce(c.cashback_amount,0)<=0 then raise exception 'conversion is not eligible for cashback issuance'; end if;
  insert into public.cashback_awards(conversion_id,profile_id,amount,currency,available_at,created_by)
  values(c.id,c.profile_id,c.cashback_amount,c.currency,coalesce(c.occurred_at,c.created_at)+make_interval(days=>coalesce(c.cashback_confirmation_days_snapshot,45)),(select auth.uid()))
  returning id into award_id;
  return award_id;
end;$$;
revoke all on function public.issue_cashback_award(uuid) from public,anon;
grant execute on function public.issue_cashback_award(uuid) to authenticated;

create or replace function public.decide_cashback_award(p_award_id uuid,p_decision text,p_note text default null)
returns void language plpgsql security invoker set search_path=''
as $$
declare a public.cashback_awards%rowtype;
begin
  if p_decision not in ('confirm','hold','reject','reverse') then raise exception 'invalid cashback award decision'; end if;
  select * into a from public.cashback_awards where id=p_award_id for update;
  if a.id is null then raise exception 'cashback award not found'; end if;
  if p_decision='confirm' then
    if a.status not in ('pending','held') or a.available_at>now() then raise exception 'cashback award is not ready for confirmation'; end if;
    update public.cashback_awards set status='confirmed',hold_reason=null,reviewed_by=(select auth.uid()),reviewed_at=now(),updated_at=now() where id=a.id;
    insert into public.wallet_entries(profile_id,award_id,entry_type,amount,note,created_by) values(a.profile_id,a.id,'cashback_confirmed',a.amount,'Provider-confirmed cashback',(select auth.uid()));
  elsif p_decision='reverse' then
    if a.status<>'confirmed' then raise exception 'only confirmed cashback can be reversed'; end if;
    update public.cashback_awards set status='reversed',hold_reason=p_note,reviewed_by=(select auth.uid()),reviewed_at=now(),updated_at=now() where id=a.id;
    insert into public.wallet_entries(profile_id,award_id,entry_type,amount,note,created_by) values(a.profile_id,a.id,'cashback_reversed',-a.amount,coalesce(p_note,'Cashback reversed'),(select auth.uid()));
  else
    if a.status not in ('pending','held') then raise exception 'this cashback award can no longer be changed'; end if;
    if nullif(trim(coalesce(p_note,'')),'') is null then raise exception 'a review note is required'; end if;
    update public.cashback_awards set status=case p_decision when 'hold' then 'held' else 'rejected' end,hold_reason=p_note,reviewed_by=(select auth.uid()),reviewed_at=now(),updated_at=now() where id=a.id;
  end if;
end;$$;
revoke all on function public.decide_cashback_award(uuid,text,text) from public,anon;
grant execute on function public.decide_cashback_award(uuid,text,text) to authenticated;

comment on table public.cashback_awards is 'Controlled lifecycle between an approved conversion and immutable wallet ledger entries.';

drop function if exists public.get_safe_offer_redirect(uuid);
create function public.get_safe_offer_redirect(p_offer_id uuid)
returns table(destination_url text,merchant_id uuid,provider_id uuid,click_reference_parameter text,reward_type text,cashback_amount numeric,cashback_percent numeric,cashback_cap numeric,reward_funding_source text,cashback_tracking_supported boolean,commission_rate numeric,commission_amount numeric,reward_terms text,cashback_confirmation_days integer)
language sql stable security invoker set search_path=''
as $$ select o.destination_url,o.merchant_id,o.provider_id,case when ap.is_active and ap.attribution_enabled then ap.click_reference_parameter else null end,o.reward_type,o.cashback_amount,o.cashback_percent,o.cashback_cap,o.reward_funding_source,o.cashback_tracking_supported,o.commission_rate,o.commission_amount,o.reward_terms,o.cashback_confirmation_days from public.offers o join public.merchants m on m.id=o.merchant_id left join public.affiliate_providers ap on ap.id=o.provider_id where o.id=p_offer_id and o.status='active' and m.is_active and private.is_approved_merchant_destination(o.merchant_id,o.destination_url) limit 1;$$;
revoke all on function public.get_safe_offer_redirect(uuid) from public;
grant execute on function public.get_safe_offer_redirect(uuid) to anon,authenticated;
