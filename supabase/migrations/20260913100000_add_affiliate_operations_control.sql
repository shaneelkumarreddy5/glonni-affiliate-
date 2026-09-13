-- Step 6: cross-pipeline monitoring, alerts and operational resolution.
create table public.affiliate_operation_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null unique,
  area text not null check(area in ('tracking','provider','conversion','financial','cashback','payout')),
  severity text not null check(severity in ('info','warning','high','critical')),
  title text not null,
  detail text not null,
  entity_type text,
  entity_id uuid,
  status text not null default 'open' check(status in ('open','acknowledged','resolved')),
  first_detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now(),
  acknowledged_by uuid references public.profiles(id) on delete set null,
  acknowledged_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  resolution_note text,
  metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object')
);
create index affiliate_operation_alerts_queue_idx on public.affiliate_operation_alerts(status,severity,last_detected_at desc);
create index affiliate_operation_alerts_entity_idx on public.affiliate_operation_alerts(entity_type,entity_id);
alter table public.affiliate_operation_alerts enable row level security;
revoke all on public.affiliate_operation_alerts from public,anon;
grant select,insert,update on public.affiliate_operation_alerts to authenticated;
create policy "aal2 active admins manage affiliate operation alerts" on public.affiliate_operation_alerts for all to authenticated
using((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin') and e.status='active'))
with check((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin') and e.status='active'));

create or replace function public.scan_affiliate_operations()
returns integer language plpgsql security definer set search_path=''
as $$
declare detected integer:=0; affected integer:=0;
begin
  perform private.assert_active_finance_operator();

  insert into public.affiliate_operation_alerts(alert_key,area,severity,title,detail,entity_type,entity_id,last_detected_at,metadata)
  select 'provider:'||p.id||':attribution','provider','high','Provider attribution is not ready',p.name||' is active but has no verified click-reference configuration.','affiliate_provider',p.id,now(),jsonb_build_object('provider',p.name)
  from public.affiliate_providers p where p.is_active and (not p.attribution_enabled or p.click_reference_parameter is null)
  on conflict(alert_key) do update set detail=excluded.detail,severity=excluded.severity,last_detected_at=now(),metadata=excluded.metadata,status=case when public.affiliate_operation_alerts.status='resolved' then 'open' else public.affiliate_operation_alerts.status end,resolved_by=null,resolved_at=null,resolution_note=null;
  get diagnostics affected=row_count; detected:=detected+affected;

  insert into public.affiliate_operation_alerts(alert_key,area,severity,title,detail,entity_type,entity_id,last_detected_at,metadata)
  select 'webhook:'||d.id,'tracking',case when d.outcome='failed' then 'critical' else 'high' end,'Provider delivery failed',d.provider_key||' returned '||d.outcome||coalesce(' · '||d.error_code,''),'provider_webhook_delivery',d.id,now(),jsonb_build_object('provider_key',d.provider_key,'response_status',d.response_status,'received_at',d.received_at)
  from public.provider_webhook_deliveries d where d.outcome in ('failed','rejected') and d.received_at>now()-interval '7 days'
  on conflict(alert_key) do update set detail=excluded.detail,severity=excluded.severity,last_detected_at=now(),metadata=excluded.metadata,status=case when public.affiliate_operation_alerts.status='resolved' then 'open' else public.affiliate_operation_alerts.status end,resolved_by=null,resolved_at=null,resolution_note=null;
  get diagnostics affected=row_count; detected:=detected+affected;

  insert into public.affiliate_operation_alerts(alert_key,area,severity,title,detail,entity_type,entity_id,last_detected_at,metadata)
  select 'conversion:'||c.id||':match','conversion',case when c.created_at<now()-interval '48 hours' then 'critical' else 'high' end,'Conversion requires attribution review',coalesce(c.provider_order_reference,'Provider conversion')||' is '||c.match_status||' and cannot enter financial validation.','referral_conversion',c.id,now(),jsonb_build_object('match_status',c.match_status,'issue_code',c.issue_code,'created_at',c.created_at)
  from public.referral_conversions c where c.match_status in ('unmatched','ambiguous') and c.created_at<now()-interval '6 hours'
  on conflict(alert_key) do update set detail=excluded.detail,severity=excluded.severity,last_detected_at=now(),metadata=excluded.metadata,status=case when public.affiliate_operation_alerts.status='resolved' then 'open' else public.affiliate_operation_alerts.status end,resolved_by=null,resolved_at=null,resolution_note=null;
  get diagnostics affected=row_count; detected:=detected+affected;

  insert into public.affiliate_operation_alerts(alert_key,area,severity,title,detail,entity_type,entity_id,last_detected_at,metadata)
  select 'conversion:'||c.id||':financial','financial',case when c.financial_validation_status='held' then 'high' else 'warning' end,'Financial validation needs attention',coalesce(c.provider_order_reference,'Conversion')||' is '||replace(c.financial_validation_status,'_',' ')||'.','referral_conversion',c.id,now(),jsonb_build_object('validation_status',c.financial_validation_status,'issue_codes',c.financial_issue_codes)
  from public.referral_conversions c where c.financial_validation_status in ('needs_review','held')
  on conflict(alert_key) do update set detail=excluded.detail,severity=excluded.severity,last_detected_at=now(),metadata=excluded.metadata,status=case when public.affiliate_operation_alerts.status='resolved' then 'open' else public.affiliate_operation_alerts.status end,resolved_by=null,resolved_at=null,resolution_note=null;
  get diagnostics affected=row_count; detected:=detected+affected;

  insert into public.affiliate_operation_alerts(alert_key,area,severity,title,detail,entity_type,entity_id,last_detected_at,metadata)
  select 'cashback:'||a.id||':clearance','cashback',case when a.status='held' then 'high' else 'warning' end,'Cashback award needs review','Award is '||a.status||case when a.available_at<now() then ' after its clearance date.' else '.' end,'cashback_award',a.id,now(),jsonb_build_object('status',a.status,'amount',a.amount,'available_at',a.available_at)
  from public.cashback_awards a where a.status='held' or (a.status='pending' and a.available_at<now()-interval '24 hours')
  on conflict(alert_key) do update set detail=excluded.detail,severity=excluded.severity,last_detected_at=now(),metadata=excluded.metadata,status=case when public.affiliate_operation_alerts.status='resolved' then 'open' else public.affiliate_operation_alerts.status end,resolved_by=null,resolved_at=null,resolution_note=null;
  get diagnostics affected=row_count; detected:=detected+affected;

  insert into public.affiliate_operation_alerts(alert_key,area,severity,title,detail,entity_type,entity_id,last_detected_at,metadata)
  select 'payout:'||i.id||':result','payout','critical','Payout execution failed',coalesce(i.failure_message,'Provider payout requires investigation.'),'payout_item',i.id,now(),jsonb_build_object('amount',i.amount,'provider_reference',i.provider_payout_reference,'processed_at',i.processed_at)
  from public.payout_items i where i.status='failed'
  on conflict(alert_key) do update set detail=excluded.detail,severity=excluded.severity,last_detected_at=now(),metadata=excluded.metadata,status=case when public.affiliate_operation_alerts.status='resolved' then 'open' else public.affiliate_operation_alerts.status end,resolved_by=null,resolved_at=null,resolution_note=null;
  get diagnostics affected=row_count; detected:=detected+affected;

  return detected;
end; $$;
revoke all on function public.scan_affiliate_operations() from public,anon;
grant execute on function public.scan_affiliate_operations() to authenticated;

create or replace function public.decide_affiliate_operation_alert(p_alert_id uuid,p_decision text,p_note text default null)
returns void language plpgsql security definer set search_path=''
as $$ begin
  perform private.assert_active_finance_operator();
  if p_decision not in ('acknowledged','resolved') then raise exception 'invalid alert decision'; end if;
  if p_decision='resolved' and nullif(trim(coalesce(p_note,'')),'') is null then raise exception 'a resolution note is required'; end if;
  update public.affiliate_operation_alerts set status=p_decision,
    acknowledged_by=case when p_decision='acknowledged' then (select auth.uid()) else acknowledged_by end,
    acknowledged_at=case when p_decision='acknowledged' then now() else acknowledged_at end,
    resolved_by=case when p_decision='resolved' then (select auth.uid()) else null end,
    resolved_at=case when p_decision='resolved' then now() else null end,
    resolution_note=case when p_decision='resolved' then trim(p_note) else resolution_note end
  where id=p_alert_id;
  if not found then raise exception 'alert not found'; end if;
end; $$;
revoke all on function public.decide_affiliate_operation_alert(uuid,text,text) from public,anon;
grant execute on function public.decide_affiliate_operation_alert(uuid,text,text) to authenticated;

comment on table public.affiliate_operation_alerts is 'Step 6 actionable health alerts spanning provider attribution, conversions, finance, cashback and payouts.';

-- Step 5 RPCs call a locked private authorization helper. Run them as their
-- owner so the helper remains unavailable to clients; each RPC asserts the
-- current caller's active role and AAL2 session before doing any work.
alter function public.set_payout_verification(uuid,text,text,text) security definer;
alter function public.decide_withdrawal(uuid,text,text) security definer;
alter function public.create_payout_batch(uuid[],text) security definer;
alter function public.record_payout_result(uuid,text,text,text) security definer;
