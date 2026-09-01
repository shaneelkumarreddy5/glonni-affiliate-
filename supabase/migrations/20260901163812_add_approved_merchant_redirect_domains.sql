create table public.merchant_redirect_domains (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  domain text not null,
  match_subdomains boolean not null default false,
  is_active boolean not null default true,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, domain)
);

create index merchant_redirect_domains_active_idx
  on public.merchant_redirect_domains(merchant_id, domain)
  where is_active;

alter table public.merchant_redirect_domains enable row level security;
revoke all on public.merchant_redirect_domains from public, anon;
grant select, insert, update, delete on public.merchant_redirect_domains to authenticated;

create policy "aal2 owners admins manage merchant redirect domains"
on public.merchant_redirect_domains for all to authenticated
using (
  (select auth.jwt() ->> 'aal') = 'aal2'
  and (select role from public.profiles where id = (select auth.uid())) in ('owner', 'admin')
)
with check (
  (select auth.jwt() ->> 'aal') = 'aal2'
  and (select role from public.profiles where id = (select auth.uid())) in ('owner', 'admin')
);

create or replace function private.redirect_url_host(p_url text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare host text;
begin
  if p_url is null or p_url !~ '^https://[A-Za-z0-9]' then return null; end if;
  host := lower(substring(p_url from '^https://([^/:?#]+)'));
  if host is null or host !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' then return null; end if;
  return host;
end;
$$;
revoke all on function private.redirect_url_host(text) from public, anon, authenticated;

create or replace function private.is_approved_merchant_destination(p_merchant_id uuid, p_url text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.merchant_redirect_domains d
    where d.merchant_id = p_merchant_id
      and d.is_active
      and (
        d.domain = private.redirect_url_host(p_url)
        or (d.match_subdomains and private.redirect_url_host(p_url) like '%.' || d.domain)
      )
  );
$$;
revoke all on function private.is_approved_merchant_destination(uuid, text) from public, anon, authenticated;

insert into public.merchant_redirect_domains(merchant_id, domain, match_subdomains)
select distinct o.merchant_id, private.redirect_url_host(o.destination_url), false
from public.offers o
where private.redirect_url_host(o.destination_url) is not null
on conflict (merchant_id, domain) do nothing;

insert into public.merchant_redirect_domains(merchant_id, domain, match_subdomains)
select m.id, private.redirect_url_host(m.storefront_url), false
from public.merchants m
where private.redirect_url_host(m.storefront_url) is not null
on conflict (merchant_id, domain) do nothing;

create or replace function private.validate_active_offer_destination()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' and not private.is_approved_merchant_destination(new.merchant_id, new.destination_url) then
    raise exception 'active offer destination must use an approved HTTPS domain for its merchant';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_active_offer_destination() from public, anon, authenticated;

drop trigger if exists validate_active_offer_destination_before_write on public.offers;
create trigger validate_active_offer_destination_before_write
before insert or update of merchant_id, destination_url, status on public.offers
for each row execute function private.validate_active_offer_destination();

create or replace function private.protect_active_redirect_domain()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare current_domain text := old.domain;
begin
  if tg_op <> 'DELETE' then
    new.domain := lower(trim(new.domain));
    if new.domain !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' then
      raise exception 'approved redirect domain must be a valid hostname without a protocol or path';
    end if;
  end if;
  if tg_op = 'DELETE' or (old.is_active and (new.is_active is false or new.domain <> old.domain)) then
    if exists (
      select 1 from public.offers o
      where o.merchant_id = old.merchant_id
        and o.status = 'active'
        and private.redirect_url_host(o.destination_url) = current_domain
    ) then
      raise exception 'cannot remove or disable a domain used by active offers; pause or update those offers first';
    end if;
  end if;
  if tg_op = 'UPDATE' then new.updated_at := now(); end if;
  return coalesce(new, old);
end;
$$;
revoke all on function private.protect_active_redirect_domain() from public, anon, authenticated;

drop trigger if exists protect_active_redirect_domain_before_write on public.merchant_redirect_domains;
create trigger protect_active_redirect_domain_before_write
before insert or update or delete on public.merchant_redirect_domains
for each row execute function private.protect_active_redirect_domain();

create or replace function public.get_safe_offer_redirect(p_offer_id uuid)
returns table(destination_url text, merchant_id uuid, provider_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select o.destination_url, o.merchant_id, o.provider_id
  from public.offers o
  join public.merchants m on m.id = o.merchant_id
  where o.id = p_offer_id
    and o.status = 'active'
    and m.is_active
    and private.is_approved_merchant_destination(o.merchant_id, o.destination_url)
  limit 1;
$$;
revoke all on function public.get_safe_offer_redirect(uuid) from public;
grant execute on function public.get_safe_offer_redirect(uuid) to anon, authenticated;
