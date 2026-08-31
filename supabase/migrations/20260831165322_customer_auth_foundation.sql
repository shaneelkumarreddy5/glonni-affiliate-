create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists state text;

create or replace function private.handle_new_customer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
  return new;
end;
$$;

revoke all on function private.handle_new_customer() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_customer_created on auth.users;
create trigger on_auth_customer_created
  after insert on auth.users
  for each row execute function private.handle_new_customer();

insert into public.profiles (id, display_name, role)
select id, coalesce(nullif(raw_user_meta_data ->> 'display_name', ''), split_part(email, '@', 1)), 'customer'
from auth.users
on conflict (id) do nothing;

alter table public.profiles enable row level security;
drop policy if exists "users can view their own profile" on public.profiles;
drop policy if exists "admins manage profiles" on public.profiles;
drop policy if exists "customers view own profile" on public.profiles;
drop policy if exists "customers update own profile" on public.profiles;

revoke all on table public.profiles from public, anon;
revoke insert, delete on table public.profiles from authenticated;
grant select, update on table public.profiles to authenticated;

create policy "customers view own profile"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

create policy "customers update own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id and role = 'customer')
with check ((select auth.uid()) = id and role = 'customer');
