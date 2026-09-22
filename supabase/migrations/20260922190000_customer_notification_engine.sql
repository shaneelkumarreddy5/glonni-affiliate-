create table public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('cashback','shopping_orders','deals_offers','price_product_alerts','account_security','support','rewards_referrals','system_announcements')),
  template_key text not null unique check (template_key ~ '^[a-z][a-z0-9_]{2,79}$'),
  name text not null check (char_length(name) between 2 and 120),
  trigger_description text not null default '',
  subject text not null check (char_length(subject) between 2 and 180),
  body text not null check (char_length(body) between 5 and 2000),
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default false check (email_enabled = false),
  push_enabled boolean not null default false check (push_enabled = false),
  is_promotional boolean not null default false,
  status text not null default 'active' check (status in ('draft','active','paused')),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customer_notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  template_id uuid references public.notification_templates(id) on delete set null,
  category text not null check (category in ('cashback','shopping_orders','deals_offers','price_product_alerts','account_security','support','rewards_referrals','system_announcements')),
  title text not null check (char_length(title) between 2 and 180),
  body text not null check (char_length(body) between 2 and 2000),
  source_table text not null check (source_table ~ '^[a-z][a-z0-9_]{1,80}$'),
  source_id text not null check (char_length(source_id) between 1 and 120),
  event_key text not null check (event_key ~ '^[a-z][a-z0-9_]{1,80}$'),
  destination text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (profile_id, source_table, source_id, event_key)
);

create index customer_notifications_profile_created_idx on public.customer_notifications(profile_id, created_at desc);
create index customer_notifications_category_created_idx on public.customer_notifications(category, created_at desc);
create index notification_templates_category_status_idx on public.notification_templates(category, status, name);

alter table public.notification_templates enable row level security;
alter table public.customer_notifications enable row level security;
revoke all on public.notification_templates, public.customer_notifications from public, anon;
grant select, update on public.notification_templates to authenticated;
grant select on public.customer_notifications to authenticated;
grant insert on public.customer_notifications to authenticated;
grant update (read_at) on public.customer_notifications to authenticated;

create policy "active aal2 staff manage notification templates" on public.notification_templates
for all to authenticated
using ((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin','editor') and e.status='active'))
with check ((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin','editor') and e.status='active'));

create policy "customers read own in app notifications" on public.customer_notifications
for select to authenticated using (profile_id=(select auth.uid()));
create policy "customers mark own notifications read" on public.customer_notifications
for update to authenticated using (profile_id=(select auth.uid())) with check (profile_id=(select auth.uid()));
create policy "active aal2 staff review notification delivery" on public.customer_notifications
for select to authenticated
using ((select auth.jwt()->>'aal')='aal2' and exists(select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin','editor') and e.status='active'));
create policy "active aal2 staff send customer notification campaigns" on public.customer_notifications
for insert to authenticated
with check (
  source_table='admin_campaign' and
  (select auth.jwt()->>'aal')='aal2' and
  exists(select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin','editor') and e.status='active') and
  exists(select 1 from public.profiles target where target.id=public.customer_notifications.profile_id and target.role='customer') and
  (category<>'deals_offers' or exists(select 1 from public.customer_preferences cp where cp.profile_id=public.customer_notifications.profile_id and cp.marketing_updates))
);

insert into public.notification_templates(category,template_key,name,trigger_description,subject,body,is_promotional,status) values
('cashback','cashback_tracked','Cashback tracked','Provider conversion is received and tied to your account.','Cashback tracked','Your purchase at {{store}} has been received for tracking. Cashback remains pending until the provider confirms eligibility. Amount: {{amount}}.','false','active'),
('cashback','cashback_pending','Cashback pending','A matched provider conversion is waiting for confirmation.','Cashback pending','Your purchase at {{store}} is awaiting merchant confirmation. We will update you when its status changes.','false','active'),
('cashback','cashback_credited','Cashback credited','A confirmed wallet ledger entry is created.','Cashback credited','₹{{amount}} cashback from {{store}} has been credited to your Glonni wallet.','false','active'),
('cashback','cashback_reversed','Cashback reversed','A cashback ledger award is reversed.','Cashback update','₹{{amount}} cashback from {{store}} was reversed after an account review. Open your wallet for the recorded status.','false','active'),
('cashback','cashback_rejected','Cashback not approved','Provider or reviewed claim is rejected with a safe customer reason.','Cashback status updated','Your cashback for {{store}} was not approved. Review the status in your wallet or contact support if you need help.','false','active'),
('cashback','cashback_claim_received','Cashback report received','A customer submitted a missing cashback claim.','We received your cashback report','Your report for order {{order_reference}} has been received. Our team will review it and update you here.','false','active'),
('cashback','cashback_claim_needs_info','More information needed','A cashback claim has been marked needs_info.','More information needed','We need more information to review your cashback report for order {{order_reference}}. Open your claim to see the request.','false','active'),
('cashback','cashback_claim_approved','Cashback claim approved','An administrator approves a missing cashback report.','Cashback report approved','Your cashback report for order {{order_reference}} was approved. The wallet entry will appear separately when it is credited.','false','active'),
('shopping_orders','store_click_recorded','Store click recorded','An authenticated click to an affiliate store was logged.','Store visit recorded','Your visit to {{store}} through Glonni was recorded at {{time}}. A visit does not confirm a purchase.','false','active'),
('shopping_orders','purchase_tracking_update','Purchase tracking update','A provider conversion was received or changed to pending.','Purchase tracking update','The merchant sent a tracking update for your purchase at {{store}}. Current status: {{status}}.','false','active'),
('shopping_orders','purchase_confirmed','Purchase confirmed','The affiliate provider reports the conversion as confirmed.','Purchase confirmed','{{store}} has confirmed your purchase. Cashback eligibility and crediting follow the offer terms and may update separately.','false','active'),
('shopping_orders','purchase_rejected','Purchase tracking update','Provider conversion was rejected or cancelled.','Purchase tracking update','The provider updated your purchase at {{store}} to {{status}}. Open your shopping activity for details.','false','active'),
('deals_offers','new_deal','New deal','A promotion is sent to a consented audience.','A new deal is available','A new deal from {{store}} is available: {{deal}}.','true','active'),
('deals_offers','coupon_updated','Coupon updated','An eligible coupon changed for a followed store.','Coupon update from {{store}}','A coupon offer has been updated: {{deal}}. Check the offer terms before using it.','true','active'),
('deals_offers','bank_offer_update','Bank offer updated','A bank offer changed on a followed offer.','Bank offer update','There is an updated bank offer for {{product}} at {{store}}. Review the merchant terms for eligibility.','true','active'),
('deals_offers','limited_time_offer','Limited-time offer','A consented campaign includes a time-limited offer.','Limited-time offer from {{store}}','{{deal}} is available until {{end_time}}, while the merchant offer remains active.','true','active'),
('price_product_alerts','price_drop','Price drop','Your active price alert reaches its target.','Price drop on {{product}}','{{product}} at {{store}} is now {{price}}, below your alert target.','false','active'),
('price_product_alerts','back_in_stock','Back in stock','A watched offer changes from unavailable to available.','{{product}} is back in stock','{{product}} at {{store}} is marked available again. Availability can change at the merchant.','false','active'),
('price_product_alerts','availability_changed','Product availability changed','Watched product availability changes.','Availability update for {{product}}','Availability for {{product}} at {{store}} changed to {{availability}}.','false','active'),
('account_security','login_alert','New sign-in','A verified security source records a new sign-in.','New sign-in to your account','A sign-in to your Glonni account was detected at {{time}}. If this was not you, secure your account.','false','active'),
('account_security','password_changed','Password changed','A verified account security event confirms a password change.','Your password was changed','Your Glonni password was changed at {{time}}. If you did not make this change, contact support immediately.','false','active'),
('account_security','profile_changed','Profile updated','A protected profile field changed.','Profile details updated','Your Glonni profile was updated at {{time}}. Review your account if you do not recognise this change.','false','active'),
('account_security','payout_verification','Payout verification update','A payout verification status changed.','Payout verification update','Your payout verification status is now {{status}}. Open Wallet & Payouts to review the details.','false','active'),
('account_security','suspicious_activity','Security notice','A trusted security workflow flags suspicious activity.','Please review your account security','We detected activity that needs your attention. Sign in directly to Glonni and review your account security.','false','active'),
('support','support_ticket_created','Support request received','A customer support ticket is created.','Support request received','We received your support request “{{subject}}” ({{ticket}}). You can follow it in Support.','false','active'),
('support','support_admin_reply','Support replied','An agent sends a customer-visible reply.','Support replied to your request','Our support team replied to “{{subject}}” ({{ticket}}). Open your request to read the reply.','false','active'),
('support','support_resolved','Support request resolved','A support ticket is resolved.','Support request resolved','Your request “{{subject}}” ({{ticket}}) was marked resolved. You can reopen support if you still need help.','false','active'),
('support','support_needs_info','Support needs information','Support marks a request waiting on the customer.','We need more information','Please reply to your support request “{{subject}}” ({{ticket}}) so our team can continue.','false','active'),
('rewards_referrals','referral_signup','Referral joined','A new referred customer joins through your code.','A friend joined Glonni','Someone joined Glonni using your referral. Rewards depend on the programme rules and review.','false','active'),
('rewards_referrals','referral_reward_earned','Referral reward confirmed','An eligible referral reward is confirmed.','Referral reward confirmed','Your referral reward of ₹{{amount}} has been confirmed. Check your wallet for its current status.','false','active'),
('rewards_referrals','bonus_eligibility','Bonus eligibility update','A bonus eligibility decision is recorded.','Reward eligibility update','Your reward eligibility has been updated: {{status}}. See the referral programme details for terms.','false','active'),
('system_announcements','scheduled_maintenance','Scheduled maintenance','Admin approved service maintenance announcement.','Scheduled maintenance','Glonni is scheduled for maintenance on {{time}}. Some services may be unavailable during this period.','false','active'),
('system_announcements','terms_privacy_update','Terms or privacy updated','A new user-facing terms or privacy version is published.','Glonni terms updated','We updated {{document}} on {{time}}. Review the latest version in your account.','false','active'),
('system_announcements','service_interruption','Service interruption','Admin approved service interruption notice.','Service update','We are investigating an interruption affecting {{service}}. We will post another update when service is restored.','false','active')
on conflict (template_key) do nothing;

create or replace function private.enqueue_customer_notification(
  p_profile_id uuid, p_template_key text, p_source_table text, p_source_id text, p_event_key text,
  p_vars jsonb default '{}'::jsonb, p_destination text default null, p_is_promotional boolean default false
) returns void language plpgsql security definer set search_path=''
as $$
declare t public.notification_templates%rowtype; v_title text; v_body text; v_key text; v_value text;
begin
  if p_profile_id is null then return; end if;
  select * into t from public.notification_templates where template_key=p_template_key and status='active' and in_app_enabled;
  if t.id is null then return; end if;
  if (p_is_promotional or t.is_promotional) and not exists(select 1 from public.customer_preferences cp where cp.profile_id=p_profile_id and cp.marketing_updates) then return; end if;
  v_title:=t.subject; v_body:=t.body;
  for v_key,v_value in select key,value from jsonb_each_text(coalesce(p_vars,'{}'::jsonb)) loop
    v_title:=replace(v_title,'{{'||v_key||'}}',left(v_value,240));
    v_body:=replace(v_body,'{{'||v_key||'}}',left(v_value,800));
  end loop;
  insert into public.customer_notifications(profile_id,template_id,category,title,body,source_table,source_id,event_key,destination,metadata)
  values(p_profile_id,t.id,t.category,v_title,v_body,p_source_table,p_source_id,p_event_key,p_destination,coalesce(p_vars,'{}'::jsonb))
  on conflict(profile_id,source_table,source_id,event_key) do nothing;
end;
$$;
revoke all on function private.enqueue_customer_notification(uuid,text,text,text,text,jsonb,text,boolean) from public,anon,authenticated;

create or replace function private.notify_conversion_change() returns trigger language plpgsql security definer set search_path=''
as $$
declare s text; store_name text; amount_text text;
begin
  if new.profile_id is null then return new; end if;
  if tg_op='UPDATE' and new.status is not distinct from old.status and new.profile_id is not distinct from old.profile_id then return new; end if;
  select name into store_name from public.merchants where id=new.merchant_id;
  s:=case new.status when 'confirmed' then 'purchase_confirmed' when 'rejected' then 'purchase_rejected' when 'cancelled' then 'purchase_rejected' else 'purchase_tracking_update' end;
  amount_text:=coalesce(new.cashback_amount::text,'');
  perform private.enqueue_customer_notification(new.profile_id,s,'referral_conversions',new.id::text,'conversion_'||new.status,jsonb_build_object('store',coalesce(store_name,'the store'),'status',new.status,'amount',amount_text),'/shopping-activity',false);
  return new;
end;
$$;
revoke all on function private.notify_conversion_change() from public,anon,authenticated;
create trigger customer_notification_conversion_change after insert or update of status,profile_id on public.referral_conversions for each row execute function private.notify_conversion_change();

create or replace function private.notify_cashback_award_change() returns trigger language plpgsql security definer set search_path=''
as $$
declare s text; store_name text;
begin
  if tg_op='UPDATE' and new.status is not distinct from old.status then return new; end if;
  select m.name into store_name from public.referral_conversions c left join public.merchants m on m.id=c.merchant_id where c.id=new.conversion_id;
  if new.status='pending' then s:='cashback_pending'; elsif new.status in ('rejected','reversed') then s:='cashback_rejected'; else return new; end if;
  perform private.enqueue_customer_notification(new.profile_id,s,'cashback_awards',new.id::text,'award_'||new.status,jsonb_build_object('store',coalesce(store_name,'the store'),'amount',new.amount::text),'/wallet',false);
  return new;
end;
$$;
revoke all on function private.notify_cashback_award_change() from public,anon,authenticated;
create trigger customer_notification_cashback_award after insert or update of status on public.cashback_awards for each row execute function private.notify_cashback_award_change();

create or replace function private.notify_cashback_claim_change() returns trigger language plpgsql security definer set search_path=''
as $$
declare s text; store_name text;
begin
  if tg_op='UPDATE' and new.status is not distinct from old.status then return new; end if;
  select m.name into store_name from public.offers o join public.merchants m on m.id=o.merchant_id where o.id=new.offer_id;
  s:=case new.status when 'submitted' then 'cashback_claim_received' when 'needs_info' then 'cashback_claim_needs_info' when 'confirmed' then 'cashback_claim_approved' when 'rejected' then 'cashback_rejected' else '' end;
  if s<>'' then perform private.enqueue_customer_notification(new.profile_id,s,'cashback_claims',new.id::text,'claim_'||new.status,jsonb_build_object('store',coalesce(store_name,'the store'),'order_reference',new.order_reference,'amount',coalesce(new.claimed_amount::text,'')),'/cashback-claim',false); end if;
  return new;
end;
$$;
revoke all on function private.notify_cashback_claim_change() from public,anon,authenticated;
create trigger customer_notification_cashback_claim after insert or update of status on public.cashback_claims for each row execute function private.notify_cashback_claim_change();

create or replace function private.notify_wallet_cashback() returns trigger language plpgsql security definer set search_path=''
as $$
declare store_name text; template_key text;
begin
  if new.entry_type not in ('cashback_confirmed','cashback_reversed') then return new; end if;
  if new.entry_type='cashback_reversed' then template_key:='cashback_reversed'; else template_key:='cashback_credited'; end if;
  select m.name into store_name from public.cashback_awards a join public.referral_conversions c on c.id=a.conversion_id left join public.merchants m on m.id=c.merchant_id where a.id=new.award_id;
  if store_name is null then select m.name into store_name from public.cashback_claims c left join public.offers o on o.id=c.offer_id left join public.merchants m on m.id=o.merchant_id where c.id=new.claim_id; end if;
  perform private.enqueue_customer_notification(new.profile_id,template_key,'wallet_entries',new.id::text,'wallet_'||new.entry_type,jsonb_build_object('store',coalesce(store_name,'the store'),'amount',abs(new.amount)::text),'/wallet',false);
  return new;
end;
$$;
revoke all on function private.notify_wallet_cashback() from public,anon,authenticated;
create trigger customer_notification_wallet_cashback after insert on public.wallet_entries for each row execute function private.notify_wallet_cashback();

create or replace function private.notify_support_ticket_change() returns trigger language plpgsql security definer set search_path=''
as $$
declare s text;
begin
  if tg_op='INSERT' then s:='support_ticket_created'; elsif new.status is distinct from old.status and new.status='resolved' then s:='support_resolved'; elsif new.status is distinct from old.status and new.status='waiting_on_customer' then s:='support_needs_info'; else return new; end if;
  perform private.enqueue_customer_notification(new.profile_id,s,'support_tickets',new.id::text,'ticket_'||s||'_'||coalesce(new.updated_at::text,new.created_at::text),jsonb_build_object('subject',new.subject,'ticket',new.ticket_number::text),'/support/requests/'||new.id::text,false);
  return new;
end;
$$;
revoke all on function private.notify_support_ticket_change() from public,anon,authenticated;
create trigger customer_notification_support_ticket after insert or update of status on public.support_tickets for each row execute function private.notify_support_ticket_change();

create or replace function private.notify_support_reply() returns trigger language plpgsql security definer set search_path=''
as $$
declare t public.support_tickets%rowtype;
begin
  if new.author_type<>'agent' or new.visibility<>'customer' then return new; end if;
  select * into t from public.support_tickets where id=new.ticket_id;
  if t.id is not null then perform private.enqueue_customer_notification(t.profile_id,'support_admin_reply','support_messages',new.id::text,'support_reply',jsonb_build_object('subject',t.subject,'ticket',t.ticket_number::text),'/support/requests/'||t.id::text,false); end if;
  return new;
end;
$$;
revoke all on function private.notify_support_reply() from public,anon,authenticated;
create trigger customer_notification_support_reply after insert on public.support_messages for each row execute function private.notify_support_reply();

create or replace function private.notify_referral_change() returns trigger language plpgsql security definer set search_path=''
as $$
declare s text;
begin
  if tg_op='INSERT' then s:='referral_signup'; elsif new.status is distinct from old.status and new.status='reward_confirmed' then s:='referral_reward_earned'; elsif new.status is distinct from old.status and new.status in ('qualified','reward_pending') then s:='bonus_eligibility'; else return new; end if;
  perform private.enqueue_customer_notification(new.referrer_profile_id,s,'customer_referrals',new.id::text,'referral_'||s||'_'||new.status,jsonb_build_object('amount',coalesce(new.reward_amount::text,''),'status',new.status),'/account?section=referral',false);
  return new;
end;
$$;
revoke all on function private.notify_referral_change() from public,anon,authenticated;
create trigger customer_notification_referral after insert or update of status on public.customer_referrals for each row execute function private.notify_referral_change();

create or replace function private.notify_store_click() returns trigger language plpgsql security definer set search_path=''
as $$
declare store_name text;
begin
  if new.profile_id is null then return new; end if;
  select name into store_name from public.merchants where id=new.merchant_id;
  perform private.enqueue_customer_notification(new.profile_id,'store_click_recorded','redirect_events',new.id::text,'store_click',jsonb_build_object('store',coalesce(store_name,'the store'),'time',to_char(new.created_at at time zone 'UTC','DD Mon YYYY HH24:MI UTC')),'/shopping-activity',false);
  return new;
end;
$$;
revoke all on function private.notify_store_click() from public,anon,authenticated;
create trigger customer_notification_store_click after insert on public.redirect_events for each row execute function private.notify_store_click();

create or replace function private.notify_price_and_stock_alerts() returns trigger language plpgsql security definer set search_path=''
as $$
declare a record; p public.products%rowtype; m public.merchants%rowtype; event_type text; event_key text; price_text text;
begin
  if (new.current_price is not distinct from old.current_price) and (new.stock_status is not distinct from old.stock_status) then return new; end if;
  select * into p from public.products where id=new.product_id; select * into m from public.merchants where id=new.merchant_id;
  for a in select pa.* from public.price_alerts pa join public.customer_preferences cp on cp.profile_id=pa.profile_id and cp.price_drop_alerts where pa.offer_id=new.id and pa.is_active loop
    if new.current_price is not null and old.current_price is not null and new.current_price<old.current_price and (a.target_price is null or new.current_price<=a.target_price) then
      event_type:='price_drop'; event_key:='price_'||new.current_price::text;
      perform private.enqueue_customer_notification(a.profile_id,event_type,'offers',new.id::text,event_key,jsonb_build_object('product',p.title,'store',m.name,'price',new.currency||' '||new.current_price::text),'/product/'||p.slug,false);
    end if;
    if old.stock_status in ('out_of_stock','unknown') and new.stock_status in ('in_stock','low_stock') then
      perform private.enqueue_customer_notification(a.profile_id,'back_in_stock','offers',new.id::text,'stock_'||new.stock_status||'_'||new.updated_at::text,jsonb_build_object('product',p.title,'store',m.name,'availability',new.stock_status),'/product/'||p.slug,false);
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function private.notify_price_and_stock_alerts() from public,anon,authenticated;
create trigger customer_notification_price_stock after update of current_price,stock_status on public.offers for each row execute function private.notify_price_and_stock_alerts();
