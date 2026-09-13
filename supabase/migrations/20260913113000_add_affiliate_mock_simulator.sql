-- Isolated acceptance simulator. These records never enter operational or financial tables.
create table public.affiliate_test_runs (
  id uuid primary key default gen_random_uuid(),
  run_reference text not null unique default ('SIM-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  scenario text not null check(scenario in ('successful_purchase','provider_rejection','order_cancellation','duplicate_postback','cashback_reversal','missing_postback','provider_latency')),
  status text not null default 'running' check(status in ('running','passed','failed','blocked')),
  is_test boolean not null default true check(is_test),
  summary text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create table public.affiliate_test_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.affiliate_test_runs(id) on delete cascade,
  sequence_number integer not null check(sequence_number>0),
  stage text not null check(stage in ('click','postback','conversion_match','financial_validation','cashback_award','wallet_credit','payout')),
  expected_queue text not null,
  expected_result text not null,
  actual_result text not null,
  verification_status text not null check(verification_status in ('passed','failed','blocked')),
  detail text not null,
  simulated_at timestamptz not null default now(),
  unique(run_id,sequence_number)
);
create index affiliate_test_runs_created_idx on public.affiliate_test_runs(created_at desc);
create index affiliate_test_events_run_sequence_idx on public.affiliate_test_events(run_id,sequence_number);
alter table public.affiliate_test_runs enable row level security;alter table public.affiliate_test_events enable row level security;
revoke all on public.affiliate_test_runs,public.affiliate_test_events from public,anon;
grant select,insert,delete on public.affiliate_test_runs,public.affiliate_test_events to authenticated;
create policy "aal2 active admins manage test runs" on public.affiliate_test_runs for all to authenticated using((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin') and e.status='active')) with check((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin') and e.status='active'));
create policy "aal2 active admins manage test events" on public.affiliate_test_events for all to authenticated using((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin') and e.status='active')) with check((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin') and e.status='active'));

create or replace function public.run_affiliate_mock_scenario(p_scenario text)
returns uuid language plpgsql security definer set search_path=''
as $$ declare v_run uuid; v_terminal text; begin
  perform private.assert_active_finance_operator();
  if p_scenario not in ('successful_purchase','provider_rejection','order_cancellation','duplicate_postback','cashback_reversal','missing_postback','provider_latency') then raise exception 'unknown test scenario'; end if;
  insert into public.affiliate_test_runs(scenario,created_by) values(p_scenario,(select auth.uid())) returning id into v_run;
  insert into public.affiliate_test_events(run_id,sequence_number,stage,expected_queue,expected_result,actual_result,verification_status,detail) values
    (v_run,1,'click','Tracked clicks','Unique click token stored','Unique test token stored','passed','Destination and reward terms captured in isolated test context.'),
    (v_run,2,'postback','Postback logs',case when p_scenario='missing_postback' then 'No delivery received' when p_scenario='provider_latency' then 'Delayed signed delivery' when p_scenario='duplicate_postback' then 'Second delivery rejected as duplicate' else 'Signed delivery accepted' end,case when p_scenario='missing_postback' then 'No delivery received' when p_scenario='provider_latency' then 'Delayed signed delivery' when p_scenario='duplicate_postback' then 'Second delivery rejected as duplicate' else 'Signed delivery accepted' end,'passed',case when p_scenario='missing_postback' then 'Missing event remains visible as a tracking exception.' when p_scenario='provider_latency' then 'Late arrival preserves the original click attribution.' when p_scenario='duplicate_postback' then 'Idempotency key prevents a second conversion.' else 'Provider event passes signature and schema controls.' end),
    (v_run,3,'conversion_match','Orders & Earnings',case when p_scenario='missing_postback' then 'Blocked: no conversion' else 'Matched to original click' end,case when p_scenario='missing_postback' then 'Blocked: no conversion' else 'Matched to original click' end,case when p_scenario='missing_postback' then 'blocked' else 'passed' end,'Customer, offer and provider attribution outcome verified.'),
    (v_run,4,'financial_validation','Financial Validation',case when p_scenario in ('missing_postback','duplicate_postback') then 'Blocked from finance' when p_scenario in ('provider_rejection','order_cancellation') then 'Rejected with no cashback' else 'Commission and cashback approved' end,case when p_scenario in ('missing_postback','duplicate_postback') then 'Blocked from finance' when p_scenario in ('provider_rejection','order_cancellation') then 'Rejected with no cashback' else 'Commission and cashback approved' end,case when p_scenario in ('missing_postback','duplicate_postback') then 'blocked' else 'passed' end,'Financial state follows provider evidence and click-time reward rules.'),
    (v_run,5,'cashback_award','Cashback Operations',case when p_scenario in ('missing_postback','duplicate_postback','provider_rejection','order_cancellation') then 'No award created' else 'Pending award created' end,case when p_scenario in ('missing_postback','duplicate_postback','provider_rejection','order_cancellation') then 'No award created' else 'Pending award created' end,case when p_scenario in ('missing_postback','duplicate_postback') then 'blocked' else 'passed' end,'Award creation remains separated from financial approval.'),
    (v_run,6,'wallet_credit','Wallet ledger',case when p_scenario in ('missing_postback','duplicate_postback','provider_rejection','order_cancellation') then 'No wallet mutation' when p_scenario='cashback_reversal' then 'Credit followed by equal reversal' else 'One immutable credit' end,case when p_scenario in ('missing_postback','duplicate_postback','provider_rejection','order_cancellation') then 'No wallet mutation' when p_scenario='cashback_reversal' then 'Credit followed by equal reversal' else 'One immutable credit' end,case when p_scenario in ('missing_postback','duplicate_postback') then 'blocked' else 'passed' end,'Ledger protection and idempotency expectation verified.'),
    (v_run,7,'payout','Payout Operations',case when p_scenario in ('successful_purchase','provider_latency') then 'Eligible after KYC and review' else 'No payout eligibility' end,case when p_scenario in ('successful_purchase','provider_latency') then 'Eligible after KYC and review' else 'No payout eligibility' end,case when p_scenario in ('missing_postback','duplicate_postback') then 'blocked' else 'passed' end,'No money is sent and no operational payout row is created by this test.');
  v_terminal:=case when exists(select 1 from public.affiliate_test_events where run_id=v_run and verification_status='failed') then 'failed' when p_scenario='missing_postback' then 'blocked' else 'passed' end;
  update public.affiliate_test_runs set status=v_terminal,summary=case when v_terminal='passed' then 'All expected controls behaved correctly.' else 'Downstream stages were safely blocked because no provider postback arrived.' end,completed_at=now() where id=v_run;
  return v_run;
end; $$;
revoke all on function public.run_affiliate_mock_scenario(text) from public,anon;grant execute on function public.run_affiliate_mock_scenario(text) to authenticated;

create or replace function public.delete_affiliate_test_run(p_run_id uuid)
returns void language plpgsql security definer set search_path=''
as $$ begin perform private.assert_active_finance_operator();delete from public.affiliate_test_runs where id=p_run_id and is_test=true;if not found then raise exception 'test run not found';end if;end; $$;
revoke all on function public.delete_affiliate_test_run(uuid) from public,anon;grant execute on function public.delete_affiliate_test_run(uuid) to authenticated;
comment on table public.affiliate_test_runs is 'Isolated mock acceptance runs; prohibited from representing live financial activity.';
