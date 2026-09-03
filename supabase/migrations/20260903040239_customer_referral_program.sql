create table public.customer_referral_codes (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  code text not null unique check (code ~ '^GLONNI-[A-Z0-9]{8}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customer_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_profile_id uuid not null references public.profiles(id) on delete restrict,
  referred_profile_id uuid not null unique references public.profiles(id) on delete restrict,
  referral_code text not null,
  status text not null default 'joined' check (status in ('joined', 'qualified', 'reward_pending', 'reward_confirmed', 'rejected', 'fraud_hold')),
  reward_amount numeric(12,2) check (reward_amount is null or reward_amount >= 0),
  reviewer_note text,
  qualified_at timestamptz,
  rewarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (referrer_profile_id <> referred_profile_id)
);

create index customer_referrals_referrer_status_idx on public.customer_referrals(referrer_profile_id, status, created_at desc);
create index customer_referrals_referred_idx on public.customer_referrals(referred_profile_id);

alter table public.customer_referral_codes enable row level security;
alter table public.customer_referrals enable row level security;
revoke all on public.customer_referral_codes, public.customer_referrals from public, anon;
grant select on public.customer_referral_codes, public.customer_referrals to authenticated;

create policy "customers view own referral code"
on public.customer_referral_codes for select to authenticated
using (profile_id = (select auth.uid()));

create policy "customers view own referrals"
on public.customer_referrals for select to authenticated
using (referrer_profile_id = (select auth.uid()) or referred_profile_id = (select auth.uid()));

create policy "owners and admins manage customer referrals"
on public.customer_referrals for all to authenticated
using ((select role from public.profiles where id = (select auth.uid())) in ('owner', 'admin'))
with check ((select role from public.profiles where id = (select auth.uid())) in ('owner', 'admin'));

create or replace function private.make_customer_referral_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare candidate text;
begin
  loop
    candidate := 'GLONNI-' || upper(substr(encode(extensions.gen_random_bytes(5), 'hex'), 1, 8));
    exit when not exists (select 1 from public.customer_referral_codes where code = candidate);
  end loop;
  return candidate;
end;
$$;

revoke all on function private.make_customer_referral_code() from public, anon, authenticated;

insert into public.customer_referral_codes(profile_id, code)
select id, private.make_customer_referral_code()
from public.profiles
on conflict (profile_id) do nothing;

create or replace function private.handle_new_customer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare inviter_id uuid;
declare supplied_code text;
begin
  insert into public.profiles (id, display_name, role, avatar_url, city, state)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)),
    'customer',
    nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
    nullif(new.raw_user_meta_data ->> 'city', ''),
    nullif(new.raw_user_meta_data ->> 'state', '')
  )
  on conflict (id) do nothing;

  insert into public.customer_referral_codes(profile_id, code)
  values (new.id, private.make_customer_referral_code())
  on conflict (profile_id) do nothing;

  supplied_code := upper(trim(coalesce(new.raw_user_meta_data ->> 'referral_code', '')));
  if supplied_code ~ '^GLONNI-[A-Z0-9]{8}$' then
    select profile_id into inviter_id
    from public.customer_referral_codes
    where code = supplied_code and is_active = true;

    if inviter_id is not null and inviter_id <> new.id then
      insert into public.customer_referrals(referrer_profile_id, referred_profile_id, referral_code)
      values (inviter_id, new.id, supplied_code)
      on conflict (referred_profile_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.handle_new_customer() from public, anon, authenticated;
