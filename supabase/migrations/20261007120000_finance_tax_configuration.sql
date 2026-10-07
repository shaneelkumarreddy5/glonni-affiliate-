-- Step 2: business tax profile, effective-dated tax codes, and immutable audit history.
-- Rates are intentionally not seeded; admins enter only advisor-reviewed values.

create table public.tax_business_profiles (
  singleton_id smallint primary key default 1 check (singleton_id = 1),
  legal_name text not null check (length(trim(legal_name)) between 2 and 200),
  trade_name text,
  pan text,
  gstin text,
  gst_registration_status text not null default 'unconfirmed'
    check (gst_registration_status in ('unconfirmed','unregistered','regular','composition','other')),
  registered_address text,
  state_name text,
  state_code text,
  contact_email text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tax_code_versions (
  id uuid primary key default gen_random_uuid(),
  code_key text not null check (code_key ~ '^[a-z0-9][a-z0-9_-]{1,79}$'),
  version integer not null check (version > 0),
  display_name text not null check (length(trim(display_name)) between 2 and 140),
  supply_area text not null check (supply_area in (
    'affiliate_commission','voucher_sale','bill_payment','cashback',
    'gateway_fee','operating_expense','other'
  )),
  gst_treatment text not null default 'unclassified'
    check (gst_treatment in (
      'unclassified','taxable','exempt','nil_rated','zero_rated',
      'outside_scope','reverse_charge','other'
    )),
  rate_percent numeric(7,4) check (rate_percent between 0 and 100),
  hsn_sac text,
  tax_component_mode text not null default 'not_set'
    check (tax_component_mode in ('not_set','cgst_sgst','igst','manual')),
  effective_from date,
  effective_to date,
  status text not null default 'draft' check (status in ('draft','approved','retired')),
  adviser_name text,
  approval_reference text,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(code_key, version),
  check (effective_to is null or effective_from is not null and effective_to >= effective_from),
  check (
    status <> 'approved'
    or (
      rate_percent is not null
      and effective_from is not null
      and length(trim(coalesce(adviser_name, ''))) > 0
      and length(trim(coalesce(approval_reference, ''))) > 0
      and approved_at is not null
      and approved_by is not null
      and gst_treatment <> 'unclassified'
    )
  )
);

create index tax_code_versions_lookup_idx
  on public.tax_code_versions (code_key, effective_from desc, version desc);

create table public.tax_configuration_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  record_type text not null check (record_type in ('business_profile','tax_code')),
  record_id text not null,
  event_type text not null check (event_type in ('insert','update')),
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index tax_configuration_audit_record_idx
  on public.tax_configuration_audit (record_type, record_id, created_at desc);

alter table public.tax_business_profiles enable row level security;
alter table public.tax_code_versions enable row level security;
alter table public.tax_configuration_audit enable row level security;

revoke all on public.tax_business_profiles from public, anon, authenticated;
revoke all on public.tax_code_versions from public, anon, authenticated;
revoke all on public.tax_configuration_audit from public, anon, authenticated;
grant select, insert, update on public.tax_business_profiles to authenticated;
grant select, insert, update on public.tax_code_versions to authenticated;
grant select on public.tax_configuration_audit to authenticated;

create policy "active aal2 admins read tax business profile"
on public.tax_business_profiles for select to authenticated
using (
  (select auth.jwt() ->> 'aal') = 'aal2'
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role::text in ('owner','admin'))
  and exists (select 1 from public.employees e where e.profile_id = (select auth.uid()) and e.status = 'active')
);
create policy "active aal2 admins insert tax business profile"
on public.tax_business_profiles for insert to authenticated
with check (
  (select auth.jwt() ->> 'aal') = 'aal2'
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role::text in ('owner','admin'))
  and exists (select 1 from public.employees e where e.profile_id = (select auth.uid()) and e.status = 'active')
);
create policy "active aal2 admins update tax business profile"
on public.tax_business_profiles for update to authenticated
using (
  (select auth.jwt() ->> 'aal') = 'aal2'
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role::text in ('owner','admin'))
  and exists (select 1 from public.employees e where e.profile_id = (select auth.uid()) and e.status = 'active')
)
with check (
  (select auth.jwt() ->> 'aal') = 'aal2'
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role::text in ('owner','admin'))
  and exists (select 1 from public.employees e where e.profile_id = (select auth.uid()) and e.status = 'active')
);

create policy "active aal2 admins read tax code versions"
on public.tax_code_versions for select to authenticated
using (
  (select auth.jwt() ->> 'aal') = 'aal2'
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role::text in ('owner','admin'))
  and exists (select 1 from public.employees e where e.profile_id = (select auth.uid()) and e.status = 'active')
);
create policy "active aal2 admins insert tax code versions"
on public.tax_code_versions for insert to authenticated
with check (
  (select auth.jwt() ->> 'aal') = 'aal2'
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role::text in ('owner','admin'))
  and exists (select 1 from public.employees e where e.profile_id = (select auth.uid()) and e.status = 'active')
);
create policy "active aal2 admins update tax code versions"
on public.tax_code_versions for update to authenticated
using (
  (select auth.jwt() ->> 'aal') = 'aal2'
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role::text in ('owner','admin'))
  and exists (select 1 from public.employees e where e.profile_id = (select auth.uid()) and e.status = 'active')
)
with check (
  (select auth.jwt() ->> 'aal') = 'aal2'
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role::text in ('owner','admin'))
  and exists (select 1 from public.employees e where e.profile_id = (select auth.uid()) and e.status = 'active')
);

create policy "active aal2 admins read tax config audit"
on public.tax_configuration_audit for select to authenticated
using (
  (select auth.jwt() ->> 'aal') = 'aal2'
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role::text in ('owner','admin'))
  and exists (select 1 from public.employees e where e.profile_id = (select auth.uid()) and e.status = 'active')
);

create or replace function private.audit_tax_configuration_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_value jsonb;
  new_value jsonb;
  row_id text;
begin
  if TG_OP = 'INSERT' then
    old_value := null;
    new_value := to_jsonb(NEW);
    row_id := coalesce(new_value ->> 'id', new_value ->> 'singleton_id', '1');
  else
    old_value := to_jsonb(OLD);
    new_value := to_jsonb(NEW);
    row_id := coalesce(new_value ->> 'id', new_value ->> 'singleton_id', '1');
  end if;

  insert into public.tax_configuration_audit (
    actor_id, record_type, record_id, event_type, before_data, after_data
  ) values (
    auth.uid(),
    case when TG_TABLE_NAME = 'tax_business_profiles' then 'business_profile' else 'tax_code' end,
    row_id,
    lower(TG_OP),
    old_value,
    new_value
  );
  return NEW;
end;
$$;
revoke all on function private.audit_tax_configuration_change() from public, anon, authenticated;

create trigger tax_business_profile_audit
after insert or update on public.tax_business_profiles
for each row execute function private.audit_tax_configuration_change();

create trigger tax_code_version_audit
after insert or update on public.tax_code_versions
for each row execute function private.audit_tax_configuration_change();

comment on table public.tax_business_profiles is
  'Glonni legal and GST registration details. Values are entered by authorized staff; this table does not determine legal tax treatment.';
comment on table public.tax_code_versions is
  'Effective-dated tax code configuration. Rates are entered from tax-adviser guidance and are not automatically inferred or applied to transactions in Step 2.';
comment on table public.tax_configuration_audit is
  'Append-only before/after audit log for finance tax configuration changes.';
