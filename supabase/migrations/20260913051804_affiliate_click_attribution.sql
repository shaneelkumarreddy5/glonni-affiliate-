alter table public.affiliate_providers
  add column if not exists click_reference_parameter text,
  add column if not exists attribution_enabled boolean not null default false,
  add column if not exists attribution_verified_at timestamptz,
  add column if not exists attribution_verified_by uuid references public.profiles(id) on delete set null;

alter table public.affiliate_providers
  drop constraint if exists affiliate_providers_click_reference_parameter_format,
  add constraint affiliate_providers_click_reference_parameter_format check (
    click_reference_parameter is null
    or click_reference_parameter ~ '^[A-Za-z][A-Za-z0-9_.-]{0,63}$'
  ),
  drop constraint if exists affiliate_providers_attribution_configuration_complete,
  add constraint affiliate_providers_attribution_configuration_complete check (
    attribution_enabled is false or click_reference_parameter is not null
  );

grant select (id, is_active, click_reference_parameter, attribution_enabled)
  on public.affiliate_providers to anon;
drop policy if exists "public reads active provider attribution configuration"
  on public.affiliate_providers;
create policy "public reads active provider attribution configuration"
  on public.affiliate_providers for select to anon
  using (is_active);

alter table public.redirect_events
  add column if not exists attribution_parameter text,
  add column if not exists attribution_value text,
  add column if not exists traffic_source text,
  add column if not exists traffic_medium text,
  add column if not exists traffic_campaign text,
  add column if not exists placement text,
  add column if not exists device_type text not null default 'unknown',
  add column if not exists destination_host text;

alter table public.redirect_events
  drop constraint if exists redirect_events_attribution_pair,
  add constraint redirect_events_attribution_pair check (
    (attribution_parameter is null and attribution_value is null)
    or (
      attribution_parameter is not null
      and attribution_value = click_token::text
    )
  ),
  drop constraint if exists redirect_events_device_type_check,
  add constraint redirect_events_device_type_check
    check (device_type in ('desktop', 'mobile', 'tablet', 'bot', 'unknown'));

create index if not exists redirect_events_attribution_value_idx
  on public.redirect_events(attribution_value)
  where attribution_value is not null;
create index if not exists redirect_events_campaign_time_idx
  on public.redirect_events(traffic_campaign, created_at desc)
  where traffic_campaign is not null;

drop function if exists public.get_safe_offer_redirect(uuid);
create function public.get_safe_offer_redirect(p_offer_id uuid)
returns table(
  destination_url text,
  merchant_id uuid,
  provider_id uuid,
  click_reference_parameter text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    o.destination_url,
    o.merchant_id,
    o.provider_id,
    case
      when ap.is_active and ap.attribution_enabled
        then ap.click_reference_parameter
      else null
    end
  from public.offers o
  join public.merchants m on m.id = o.merchant_id
  left join public.affiliate_providers ap on ap.id = o.provider_id
  where o.id = p_offer_id
    and o.status = 'active'
    and m.is_active
    and private.is_approved_merchant_destination(o.merchant_id, o.destination_url)
  limit 1;
$$;

revoke all on function public.get_safe_offer_redirect(uuid) from public;
grant execute on function public.get_safe_offer_redirect(uuid) to anon, authenticated;

comment on column public.affiliate_providers.click_reference_parameter is
  'Provider-approved outbound query parameter used to transmit Glonni click IDs.';
comment on column public.redirect_events.attribution_value is
  'Exact Glonni click ID transmitted to the affiliate provider for conversion matching.';
