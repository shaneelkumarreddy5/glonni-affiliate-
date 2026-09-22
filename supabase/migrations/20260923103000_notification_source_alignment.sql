create or replace function private.notify_cashback_award_change() returns trigger
language plpgsql security definer set search_path=''
as $$
declare store_name text;
begin
  if tg_op='UPDATE' and new.status is not distinct from old.status then return new; end if;
  select m.name into store_name
  from public.referral_conversions c
  left join public.merchants m on m.id=c.merchant_id
  where c.id=new.conversion_id;
  if new.status='pending' then
    perform private.enqueue_customer_notification(new.profile_id,'cashback_pending','cashback_awards',new.id::text,'award_pending',jsonb_build_object('store',coalesce(store_name,'the store'),'amount',new.amount::text),'/wallet',false);
  elsif new.status='rejected' then
    perform private.enqueue_customer_notification(new.profile_id,'cashback_rejected','cashback_awards',new.id::text,'award_rejected',jsonb_build_object('store',coalesce(store_name,'the store'),'amount',new.amount::text),'/wallet',false);
  end if;
  return new;
end;
$$;

create or replace function private.notify_payout_verification_change() returns trigger
language plpgsql security definer set search_path=''
as $$
begin
  if tg_op='UPDATE' and new.status is not distinct from old.status then return new; end if;
  perform private.enqueue_customer_notification(
    new.profile_id,'payout_verification','payout_verifications',new.profile_id::text,
    'payout_verification_'||new.status||'_'||new.updated_at::text,
    jsonb_build_object('status',replace(new.status,'_',' ')), '/wallet?tab=withdrawals',false
  );
  return new;
end;
$$;
revoke all on function private.notify_payout_verification_change() from public,anon,authenticated;
create trigger customer_notification_payout_verification
after insert or update of status on public.payout_verifications
for each row execute function private.notify_payout_verification_change();

update public.notification_templates
set status='draft',
    trigger_description='Template only: no verified sign-in event is connected for automatic delivery yet.'
where template_key='login_alert';
update public.notification_templates
set status='draft',
    trigger_description='Template only: password-change events are not currently connected for automatic delivery.'
where template_key='password_changed';
update public.notification_templates
set status='draft',
    trigger_description='Template only: profile edits do not yet have a trusted customer notification trigger.'
where template_key='profile_changed';
update public.notification_templates
set status='active',
    trigger_description='Connected to payout_verifications.profile_id; sent only when that customer’s verification status changes.'
where template_key='payout_verification';
update public.notification_templates
set status='draft',
    trigger_description='Template only: no verified fraud/security signal source is connected for automatic delivery yet.'
where template_key='suspicious_activity';
update public.notification_templates
set status='draft',
    trigger_description='Template only: this event is not currently emitted by a connected Glonni source.'
where template_key in ('cashback_tracked','availability_changed');
update public.notification_templates
set trigger_description='Admin campaign only. Promotional recipients are restricted to customers who opted in.'
where category='deals_offers';
update public.notification_templates
set trigger_description='Admin campaign only. Customer announcements are sent to individual Glonni accounts.'
where category='system_announcements';
