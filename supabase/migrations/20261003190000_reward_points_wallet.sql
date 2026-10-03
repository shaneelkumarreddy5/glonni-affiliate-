-- Rewards are a separate, non-withdrawable customer benefit.
alter table public.offers add column if not exists reward_points integer;
alter table public.offers drop constraint if exists offers_reward_type_check;
alter table public.offers add constraint offers_reward_type_check check (reward_type in ('none','fixed_cashback','percentage_cashback','points','coupon','merchant_promotion'));
alter table public.offers add constraint offers_reward_points_check check (reward_points is null or reward_points > 0);
alter table public.offers add constraint offers_points_benefit_check check (reward_type <> 'points' or (reward_points is not null and cashback_amount is null and cashback_percent is null));
alter table public.redirect_events add column if not exists reward_points_snapshot integer;
alter table public.referral_conversions add column if not exists reward_points_snapshot integer;

create table public.reward_point_awards (
  id uuid primary key default gen_random_uuid(),
  conversion_id uuid not null unique references public.referral_conversions(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  points integer not null check (points > 0),
  status text not null default 'pending' check (status in ('pending','held','confirmed','rejected','reversed')),
  available_at timestamptz not null,
  review_note text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reward_point_awards_profile_status_idx on public.reward_point_awards(profile_id,status,created_at desc);
alter table public.reward_point_awards enable row level security;
revoke all on public.reward_point_awards from public,anon;
grant select,insert,update on public.reward_point_awards to authenticated;
create policy "customers read own reward point awards" on public.reward_point_awards for select to authenticated using (profile_id=(select auth.uid()));
create policy "aal2 finance admins manage reward point awards" on public.reward_point_awards for all to authenticated
using ((select auth.jwt()->>'aal')='aal2' and exists (select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin') and e.status='active'))
with check ((select auth.jwt()->>'aal')='aal2' and exists (select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin') and e.status='active'));

create function private.guard_reward_point_award()
returns trigger language plpgsql security invoker set search_path=''
as $$
declare c public.referral_conversions%rowtype;
begin
  if tg_op='DELETE' then raise exception 'point awards cannot be deleted'; end if;
  if tg_op='INSERT' then
    select * into c from public.referral_conversions where id=new.conversion_id;
    if c.id is null or c.profile_id is distinct from new.profile_id or c.status<>'confirmed' or c.match_status<>'matched' or c.financial_validation_status<>'approved' or c.reward_type_snapshot<>'points' or c.reward_points_snapshot is distinct from new.points or new.status<>'pending' then raise exception 'point award does not match an approved provider conversion'; end if;
  else
    if row(new.conversion_id,new.profile_id,new.points,new.available_at,new.created_by,new.created_at) is distinct from row(old.conversion_id,old.profile_id,old.points,old.available_at,old.created_by,old.created_at) then raise exception 'point award source and amount are immutable'; end if;
    if old.status in ('rejected','reversed') or (old.status='confirmed' and new.status<>'reversed') or (old.status in ('pending','held') and new.status not in ('pending','held','confirmed','rejected')) then raise exception 'invalid point award transition'; end if;
    if new.status='confirmed' then
      select * into c from public.referral_conversions where id=new.conversion_id;
      if c.status<>'confirmed' or c.match_status<>'matched' or c.financial_validation_status<>'approved' then raise exception 'provider conversion is no longer eligible'; end if;
      if new.available_at>now() then raise exception 'point award confirmation period has not elapsed'; end if;
    end if;
  end if;
  return new;
end;$$;
revoke all on function private.guard_reward_point_award() from public,anon,authenticated;
create trigger guard_reward_point_award before insert or update or delete on public.reward_point_awards for each row execute function private.guard_reward_point_award();

create or replace function public.issue_reward_point_award(p_conversion_id uuid)
returns uuid language plpgsql security invoker set search_path=''
as $$
declare c public.referral_conversions%rowtype; award_id uuid;
begin
  if (select auth.jwt()->>'aal') <> 'aal2' or not exists (select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin') and e.status='active') then raise exception 'finance admin with MFA required'; end if;
  select * into c from public.referral_conversions where id=p_conversion_id;
  if c.id is null or c.profile_id is null or c.status<>'confirmed' or c.match_status<>'matched' or c.financial_validation_status<>'approved' or c.reward_type_snapshot<>'points' or coalesce(c.reward_points_snapshot,0)<=0 then raise exception 'conversion is not eligible for reward points'; end if;
  insert into public.reward_point_awards(conversion_id,profile_id,points,available_at,created_by)
  values(c.id,c.profile_id,c.reward_points_snapshot,coalesce(c.occurred_at,c.created_at)+make_interval(days=>coalesce(c.cashback_confirmation_days_snapshot,45)),(select auth.uid())) returning id into award_id;
  return award_id;
end;$$;
revoke all on function public.issue_reward_point_award(uuid) from public,anon;
grant execute on function public.issue_reward_point_award(uuid) to authenticated;

create or replace function public.decide_reward_point_award(p_award_id uuid,p_decision text,p_note text default null)
returns void language plpgsql security invoker set search_path=''
as $$
declare a public.reward_point_awards%rowtype;
begin
  if (select auth.jwt()->>'aal') <> 'aal2' or not exists (select 1 from public.profiles p join public.employees e on e.profile_id=p.id where p.id=(select auth.uid()) and p.role in ('owner','admin') and e.status='active') then raise exception 'finance admin with MFA required'; end if;
  if p_decision not in ('confirm','hold','reject','reverse') then raise exception 'invalid decision'; end if;
  select * into a from public.reward_point_awards where id=p_award_id for update;
  if a.id is null then raise exception 'reward award not found'; end if;
  if p_decision='confirm' and (a.status not in ('pending','held') or a.available_at>now()) then raise exception 'reward award is not ready'; end if;
  if p_decision='reverse' and a.status<>'confirmed' then raise exception 'only confirmed rewards can be reversed'; end if;
  if p_decision in ('hold','reject') and (a.status not in ('pending','held') or nullif(trim(coalesce(p_note,'')),'') is null) then raise exception 'review note required'; end if;
  update public.reward_point_awards set status=case p_decision when 'confirm' then 'confirmed' when 'reverse' then 'reversed' when 'hold' then 'held' else 'rejected' end,
    review_note=p_note,reviewed_by=(select auth.uid()),reviewed_at=now(),updated_at=now() where id=a.id;
end;$$;
revoke all on function public.decide_reward_point_award(uuid,text,text) from public,anon;
grant execute on function public.decide_reward_point_award(uuid,text,text) to authenticated;

drop function if exists public.get_safe_offer_redirect(uuid);
create function public.get_safe_offer_redirect(p_offer_id uuid)
returns table(destination_url text,merchant_id uuid,provider_id uuid,click_reference_parameter text,reward_type text,cashback_amount numeric,cashback_percent numeric,cashback_cap numeric,reward_funding_source text,cashback_tracking_supported boolean,commission_rate numeric,commission_amount numeric,reward_terms text,cashback_confirmation_days integer,reward_points integer)
language sql stable security invoker set search_path=''
as $$ select o.destination_url,o.merchant_id,o.provider_id,case when ap.is_active and ap.attribution_enabled then ap.click_reference_parameter else null end,o.reward_type,o.cashback_amount,o.cashback_percent,o.cashback_cap,o.reward_funding_source,o.cashback_tracking_supported,o.commission_rate,o.commission_amount,o.reward_terms,o.cashback_confirmation_days,o.reward_points from public.offers o join public.merchants m on m.id=o.merchant_id left join public.affiliate_providers ap on ap.id=o.provider_id where o.id=p_offer_id and o.status='active' and m.is_active and private.is_approved_merchant_destination(o.merchant_id,o.destination_url) limit 1;$$;
revoke all on function public.get_safe_offer_redirect(uuid) from public;
grant execute on function public.get_safe_offer_redirect(uuid) to anon,authenticated;
