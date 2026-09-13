-- Step 5: controlled customer payout execution and reconciliation.
alter table public.withdrawal_requests drop constraint if exists withdrawal_requests_status_check;
alter table public.withdrawal_requests add constraint withdrawal_requests_status_check
  check(status in ('requested','on_hold','approved','batched','processing','paid','failed','reversed','rejected'));

drop index if exists public.withdrawal_requests_one_open_per_profile;
create unique index withdrawal_requests_one_open_per_profile on public.withdrawal_requests(profile_id)
  where status in ('requested','on_hold','approved','batched','processing');

create table public.payout_verifications (
  profile_id uuid primary key references public.profiles(id) on delete restrict,
  status text not null default 'not_started' check(status in ('not_started','pending','verified','rejected','expired')),
  method text check(method is null or method in ('provider_kyc','manual_review')),
  reference text,
  note text,
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.payout_batches (
  id uuid primary key default gen_random_uuid(),
  batch_reference text not null unique default ('PAY-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  status text not null default 'draft' check(status in ('draft','approved','processing','completed','partially_failed','cancelled')),
  provider_key text,
  payout_count integer not null check(payout_count > 0),
  total_amount numeric(12,2) not null check(total_amount > 0),
  currency text not null default 'INR' check(currency ~ '^[A-Z]{3}$'),
  created_by uuid not null references public.profiles(id) on delete restrict,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payout_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.payout_batches(id) on delete restrict,
  withdrawal_id uuid not null unique references public.withdrawal_requests(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  amount numeric(12,2) not null check(amount > 0),
  currency text not null default 'INR' check(currency ~ '^[A-Z]{3}$'),
  destination_mask text not null,
  destination_fingerprint text not null,
  status text not null default 'queued' check(status in ('queued','processing','paid','failed','reversed')),
  provider_payout_reference text unique,
  failure_code text,
  failure_message text,
  processed_by uuid references public.profiles(id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payout_events (
  id uuid primary key default gen_random_uuid(),
  payout_item_id uuid not null references public.payout_items(id) on delete restrict,
  event_type text not null check(event_type in ('queued','processing','paid','failed','reversed')),
  provider_reference text,
  note text,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.wallet_entries add column if not exists payout_item_id uuid references public.payout_items(id) on delete restrict;
create unique index wallet_entries_payout_type_unique on public.wallet_entries(payout_item_id,entry_type) where payout_item_id is not null;
create index payout_batches_status_created_idx on public.payout_batches(status,created_at desc);
create index payout_items_batch_status_idx on public.payout_items(batch_id,status);
create index payout_items_profile_created_idx on public.payout_items(profile_id,created_at desc);
create index payout_events_item_created_idx on public.payout_events(payout_item_id,created_at desc);

alter table public.payout_verifications enable row level security;
alter table public.payout_batches enable row level security;
alter table public.payout_items enable row level security;
alter table public.payout_events enable row level security;
revoke all on public.payout_verifications,public.payout_batches,public.payout_items,public.payout_events from public,anon;
grant select,insert,update on public.payout_verifications,public.payout_batches,public.payout_items to authenticated;
grant select,insert on public.payout_events to authenticated;

create policy "customers view own payout verification" on public.payout_verifications for select to authenticated using(profile_id=(select auth.uid()));
create policy "customers view own payout items" on public.payout_items for select to authenticated using(profile_id=(select auth.uid()));
create policy "customers view own payout events" on public.payout_events for select to authenticated using(exists(select 1 from public.payout_items i where i.id=payout_item_id and i.profile_id=(select auth.uid())));

create policy "aal2 active finance admins manage payout verification" on public.payout_verifications for all to authenticated
using((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin') and e.status='active'))
with check((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin') and e.status='active'));
create policy "aal2 active finance admins manage payout batches" on public.payout_batches for all to authenticated
using((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin') and e.status='active'))
with check((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin') and e.status='active'));
create policy "aal2 active finance admins manage payout items" on public.payout_items for all to authenticated
using((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin') and e.status='active'))
with check((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin') and e.status='active'));
create policy "aal2 active finance admins add payout events" on public.payout_events for insert to authenticated
with check((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin') and e.status='active'));
create policy "aal2 active finance admins view payout events" on public.payout_events for select to authenticated
using((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin') and e.status='active'));

create or replace function private.assert_active_finance_operator()
returns void language plpgsql security definer set search_path=''
as $$ begin
  if (select auth.jwt()->>'aal')<>'aal2' or not exists(select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin') and e.status='active') then
    raise exception 'an active Owner or Admin with 2FA is required';
  end if;
end; $$;
revoke all on function private.assert_active_finance_operator() from public,anon,authenticated;

create or replace function public.set_payout_verification(p_profile_id uuid,p_status text,p_note text default null,p_reference text default null)
returns void language plpgsql security invoker set search_path=''
as $$ begin
  perform private.assert_active_finance_operator();
  if p_status not in ('pending','verified','rejected','expired') then raise exception 'invalid verification status'; end if;
  insert into public.payout_verifications(profile_id,status,method,reference,note,verified_by,verified_at,updated_at)
  values(p_profile_id,p_status,'manual_review',nullif(trim(p_reference),''),nullif(trim(p_note),''),(select auth.uid()),case when p_status='verified' then now() else null end,now())
  on conflict(profile_id) do update set status=excluded.status,method=excluded.method,reference=excluded.reference,note=excluded.note,verified_by=excluded.verified_by,verified_at=excluded.verified_at,updated_at=now();
end; $$;
revoke all on function public.set_payout_verification(uuid,text,text,text) from public,anon;
grant execute on function public.set_payout_verification(uuid,text,text,text) to authenticated;

create or replace function public.decide_withdrawal(p_withdrawal_id uuid,p_decision text,p_note text default null)
returns void language plpgsql security invoker set search_path=''
as $$
declare w public.withdrawal_requests%rowtype; ledger numeric; reserved numeric;
begin
  perform private.assert_active_finance_operator();
  if p_decision not in ('approve','hold','reject') then raise exception 'invalid withdrawal decision'; end if;
  select * into w from public.withdrawal_requests where id=p_withdrawal_id for update;
  if w.id is null or w.status not in ('requested','on_hold','approved') then raise exception 'withdrawal cannot be reviewed in its current state'; end if;
  if p_decision='approve' then
    if not exists(select 1 from public.payout_verifications where profile_id=w.profile_id and status='verified') then raise exception 'customer payout verification must be completed first'; end if;
    select coalesce(sum(amount),0) into ledger from public.wallet_entries where profile_id=w.profile_id;
    select coalesce(sum(amount),0) into reserved from public.withdrawal_requests where profile_id=w.profile_id and status in ('requested','on_hold','approved','batched','processing');
    if reserved>ledger then raise exception 'confirmed wallet balance no longer covers open withdrawals'; end if;
    update public.withdrawal_requests set status='approved',reviewer_note=nullif(trim(p_note),''),reviewed_by=(select auth.uid()),reviewed_at=now(),updated_at=now() where id=w.id;
  else
    if nullif(trim(coalesce(p_note,'')),'') is null then raise exception 'a review note is required'; end if;
    update public.withdrawal_requests set status=case when p_decision='hold' then 'on_hold' else 'rejected' end,reviewer_note=p_note,reviewed_by=(select auth.uid()),reviewed_at=now(),updated_at=now() where id=w.id;
  end if;
end; $$;
revoke all on function public.decide_withdrawal(uuid,text,text) from public,anon;
grant execute on function public.decide_withdrawal(uuid,text,text) to authenticated;

create or replace function public.create_payout_batch(p_withdrawal_ids uuid[],p_provider_key text default null)
returns uuid language plpgsql security invoker set search_path=''
as $$
declare v_batch_id uuid; selected_count integer; selected_total numeric;
begin
  perform private.assert_active_finance_operator();
  if coalesce(array_length(p_withdrawal_ids,1),0)=0 then raise exception 'select at least one approved withdrawal'; end if;
  perform 1 from public.withdrawal_requests where id=any(p_withdrawal_ids) order by id for update;
  select count(*),coalesce(sum(amount),0) into selected_count,selected_total from public.withdrawal_requests where id=any(p_withdrawal_ids) and status='approved';
  if selected_count<>array_length(p_withdrawal_ids,1) then raise exception 'every selected withdrawal must be approved'; end if;
  insert into public.payout_batches(status,provider_key,payout_count,total_amount,created_by,approved_by,approved_at)
  values('approved',nullif(trim(p_provider_key),''),selected_count,selected_total,(select auth.uid()),(select auth.uid()),now()) returning id into v_batch_id;
  insert into public.payout_items(batch_id,withdrawal_id,profile_id,amount,destination_mask,destination_fingerprint)
  select v_batch_id,w.id,w.profile_id,w.amount,'UPI ••••'||right(w.upi_id,4),encode(public.digest(lower(trim(w.upi_id)),'sha256'),'hex') from public.withdrawal_requests w where w.id=any(p_withdrawal_ids);
  insert into public.payout_events(payout_item_id,event_type,note,actor_id)
  select i.id,'queued','Added to approved payout batch',(select auth.uid()) from public.payout_items i where i.batch_id=v_batch_id;
  update public.withdrawal_requests set status='batched',updated_at=now() where id=any(p_withdrawal_ids);
  return v_batch_id;
end; $$;
revoke all on function public.create_payout_batch(uuid[],text) from public,anon;
grant execute on function public.create_payout_batch(uuid[],text) to authenticated;

create or replace function public.record_payout_result(p_payout_item_id uuid,p_result text,p_provider_reference text default null,p_note text default null)
returns void language plpgsql security invoker set search_path=''
as $$
declare i public.payout_items%rowtype; next_batch_status text;
begin
  perform private.assert_active_finance_operator();
  if p_result not in ('processing','paid','failed','reversed') then raise exception 'invalid payout result'; end if;
  select * into i from public.payout_items where id=p_payout_item_id for update;
  if i.id is null then raise exception 'payout item not found'; end if;
  if p_result='processing' and i.status<>'queued' then raise exception 'only queued payouts can start processing'; end if;
  if p_result in ('paid','failed') and i.status not in ('queued','processing') then raise exception 'payout is not awaiting a result'; end if;
  if p_result='paid' and nullif(trim(coalesce(p_provider_reference,'')),'') is null then raise exception 'provider payout reference is required'; end if;
  if p_result='failed' and nullif(trim(coalesce(p_note,'')),'') is null then raise exception 'failure reason is required'; end if;
  if p_result='reversed' and (i.status<>'paid' or nullif(trim(coalesce(p_note,'')),'') is null) then raise exception 'only a paid payout can be reversed with a reason'; end if;

  update public.payout_items set status=p_result,provider_payout_reference=coalesce(nullif(trim(p_provider_reference),''),provider_payout_reference),failure_message=case when p_result='failed' then p_note else failure_message end,processed_by=(select auth.uid()),processed_at=now(),updated_at=now() where id=i.id;
  update public.withdrawal_requests set status=p_result,reviewer_note=coalesce(nullif(trim(p_note),''),reviewer_note),updated_at=now() where id=i.withdrawal_id;
  insert into public.payout_events(payout_item_id,event_type,provider_reference,note,actor_id) values(i.id,p_result,nullif(trim(p_provider_reference),''),nullif(trim(p_note),''),(select auth.uid()));
  if p_result='paid' then
    insert into public.wallet_entries(profile_id,payout_item_id,entry_type,amount,note,created_by) values(i.profile_id,i.id,'withdrawal_paid',-i.amount,'Payout '||trim(p_provider_reference),(select auth.uid()));
  elsif p_result='reversed' then
    insert into public.wallet_entries(profile_id,payout_item_id,entry_type,amount,note,created_by) values(i.profile_id,i.id,'withdrawal_reversed',i.amount,'Payout reversal: '||trim(p_note),(select auth.uid()));
  end if;
  select case when bool_and(status='paid') then 'completed' when bool_or(status='processing') then 'processing' when bool_or(status in ('failed','reversed')) then 'partially_failed' else 'approved' end into next_batch_status from public.payout_items where batch_id=i.batch_id;
  update public.payout_batches set status=next_batch_status,updated_at=now() where id=i.batch_id;
end; $$;
revoke all on function public.record_payout_result(uuid,text,text,text) from public,anon;
grant execute on function public.record_payout_result(uuid,text,text,text) to authenticated;

create or replace function private.guard_wallet_entry()
returns trigger language plpgsql security definer set search_path=''
as $$
declare claim_record public.cashback_claims%rowtype; conversion_record public.referral_conversions%rowtype; award_record public.cashback_awards%rowtype; payout_record public.payout_items%rowtype;
begin
  if tg_op in ('UPDATE','DELETE') then raise exception 'wallet ledger entries are immutable; add a reversal entry instead'; end if;
  if new.entry_type in ('withdrawal_paid','withdrawal_reversed') then
    select * into payout_record from public.payout_items where id=new.payout_item_id;
    if payout_record.id is null or payout_record.profile_id<>new.profile_id then raise exception 'payout item is not valid for this wallet'; end if;
    if new.entry_type='withdrawal_paid' and (payout_record.status<>'paid' or new.amount<>-payout_record.amount) then raise exception 'payout debit must match the paid payout item exactly'; end if;
    if new.entry_type='withdrawal_reversed' and (payout_record.status<>'reversed' or new.amount<>payout_record.amount) then raise exception 'payout reversal must restore the paid amount exactly'; end if;
    return new;
  end if;
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
end; $$;
revoke all on function private.guard_wallet_entry() from public,anon,authenticated;

comment on table public.payout_batches is 'Step 5 payout batches approved by a 2FA-authenticated finance operator.';
comment on table public.payout_events is 'Append-only payout execution and reconciliation history.';
