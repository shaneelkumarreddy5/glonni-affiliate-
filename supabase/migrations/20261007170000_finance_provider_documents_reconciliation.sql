-- Step 5: provider tax documents/statements and source-linked reconciliation.
-- Amounts and GST values are transcribed from provider documents; unmatched sources remain explicit.

create table public.finance_provider_documents (
  id uuid primary key default gen_random_uuid(),
  document_reference text not null unique default ('PRV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  provider_type text not null check (provider_type in (
    'affiliate_network','brand','voucher_bill_provider','payment_gateway','payout_provider','other'
  )),
  provider_name text not null check (length(trim(provider_name)) between 2 and 200),
  provider_key text check (provider_key is null or length(trim(provider_key)) between 1 and 120),
  affiliate_provider_id uuid references public.affiliate_providers(id) on delete restrict,
  merchant_id uuid references public.merchants(id) on delete restrict,
  payment_provider_id uuid references public.payment_provider_configs(id) on delete restrict,
  document_kind text not null check (document_kind in (
    'affiliate_statement','supplier_tax_invoice','sales_tax_invoice','payment_settlement','payout_statement','other'
  )),
  document_flow text not null check (document_flow in ('inward','outward','settlement')),
  period_start date,
  period_end date,
  invoice_number text check (invoice_number is null or length(trim(invoice_number)) <= 120),
  invoice_date date,
  counterparty_gstin text,
  taxable_value numeric(14,2) not null default 0 check (taxable_value >= 0),
  cgst_amount numeric(14,2) not null default 0 check (cgst_amount >= 0),
  sgst_amount numeric(14,2) not null default 0 check (sgst_amount >= 0),
  igst_amount numeric(14,2) not null default 0 check (igst_amount >= 0),
  cess_amount numeric(14,2) not null default 0 check (cess_amount >= 0),
  other_charges numeric(14,2) not null default 0 check (other_charges >= 0),
  round_off numeric(8,2) not null default 0 check (round_off between -100 and 100),
  document_total numeric(14,2) not null check (document_total >= 0),
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  notes text check (notes is null or length(notes) <= 2000),
  entry_status text not null default 'active' check (entry_status in ('active','void')),
  void_reason text,
  document_path text,
  document_file_name text,
  document_mime_type text,
  document_size_bytes bigint,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((period_start is null and period_end is null) or (period_start is not null and period_end is not null and period_end >= period_start)),
  check (counterparty_gstin is null or length(trim(counterparty_gstin)) = 15),
  check (abs((taxable_value + cgst_amount + sgst_amount + igst_amount + cess_amount + other_charges + round_off) - document_total) <= 0.02),
  check ((entry_status = 'void') = (length(trim(coalesce(void_reason,''))) > 0)),
  check (
    (document_path is null and document_file_name is null and document_mime_type is null and document_size_bytes is null)
    or
    (document_path is not null and document_file_name is not null and document_mime_type in (
      'application/pdf','image/jpeg','image/png','image/webp','text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ) and document_size_bytes between 1 and 15728640)
  ),
  check (provider_type = 'affiliate_network' or affiliate_provider_id is null),
  check (provider_type = 'brand' or merchant_id is null),
  check (provider_type = 'payment_gateway' or payment_provider_id is null)
);
create index finance_provider_documents_date_idx on public.finance_provider_documents (invoice_date desc, created_at desc);
create index finance_provider_documents_period_idx on public.finance_provider_documents (period_start,period_end);
create index finance_provider_documents_provider_idx on public.finance_provider_documents (provider_type,provider_name);

create table public.finance_provider_document_matches (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.finance_provider_documents(id) on delete restrict,
  source_type text not null check (source_type in ('affiliate_conversion','commerce_order','payout_item','manual')),
  source_id uuid,
  source_reference text check (source_reference is null or length(source_reference) <= 160),
  provider_reported_amount numeric(14,2) not null check (provider_reported_amount >= 0),
  system_amount numeric(14,2) check (system_amount is null or system_amount >= 0),
  variance_amount numeric(14,2) generated always as (
    case when system_amount is null then null else provider_reported_amount - system_amount end
  ) stored,
  match_status text not null check (match_status in ('matched','difference','unmatched','manual')),
  match_note text not null check (length(trim(match_note)) between 3 and 1000),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (
    (source_type = 'manual' and source_id is null and system_amount is null and match_status = 'manual')
    or
    (source_type <> 'manual' and source_id is not null and system_amount is not null and match_status in ('matched','difference','unmatched'))
  )
);
create index finance_provider_matches_doc_idx on public.finance_provider_document_matches (document_id,created_at);
create index finance_provider_matches_source_idx on public.finance_provider_document_matches (source_type,source_id);
create unique index finance_provider_matches_source_unique
  on public.finance_provider_document_matches(document_id,source_type,source_id)
  where source_id is not null;

create table public.finance_provider_document_audit (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.finance_provider_documents(id) on delete restrict,
  entity_type text not null check (entity_type in ('document','match')),
  entity_id text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in ('insert','update')),
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create index finance_provider_doc_audit_idx on public.finance_provider_document_audit(document_id,created_at desc);

alter table public.finance_provider_documents enable row level security;
alter table public.finance_provider_document_matches enable row level security;
alter table public.finance_provider_document_audit enable row level security;
revoke all on public.finance_provider_documents from public,anon,authenticated;
revoke all on public.finance_provider_document_matches from public,anon,authenticated;
revoke all on public.finance_provider_document_audit from public,anon,authenticated;
grant select on public.finance_provider_documents to authenticated;
grant select on public.finance_provider_document_matches to authenticated;
grant select on public.finance_provider_document_audit to authenticated;

create policy "active finance admins read provider documents"
on public.finance_provider_documents for select to authenticated
using (private.is_active_finance_admin());
create policy "active finance admins read provider document matches"
on public.finance_provider_document_matches for select to authenticated
using (private.is_active_finance_admin());
create policy "active finance admins read provider document audit"
on public.finance_provider_document_audit for select to authenticated
using (private.is_active_finance_admin());

create or replace function private.audit_finance_provider_document_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare doc_id uuid;
begin
  if TG_TABLE_NAME = 'finance_provider_documents' then
    doc_id := coalesce(NEW.id,OLD.id);
    insert into public.finance_provider_document_audit(document_id,entity_type,entity_id,actor_id,event_type,before_data,after_data)
    values (doc_id,'document',doc_id::text,auth.uid(),lower(TG_OP),
      case when TG_OP='INSERT' then null else to_jsonb(OLD) end,
      case when TG_OP='DELETE' then null else to_jsonb(NEW) end);
  else
    doc_id := coalesce(NEW.document_id,OLD.document_id);
    insert into public.finance_provider_document_audit(document_id,entity_type,entity_id,actor_id,event_type,before_data,after_data)
    values (doc_id,'match',coalesce(NEW.id,OLD.id)::text,auth.uid(),lower(TG_OP),
      case when TG_OP='INSERT' then null else to_jsonb(OLD) end,
      case when TG_OP='DELETE' then null else to_jsonb(NEW) end);
  end if;
  return NEW;
end;
$$;
revoke all on function private.audit_finance_provider_document_change() from public,anon,authenticated;

create trigger finance_provider_document_audit_trigger
after insert or update on public.finance_provider_documents
for each row execute function private.audit_finance_provider_document_change();
create trigger finance_provider_match_audit_trigger
after insert on public.finance_provider_document_matches
for each row execute function private.audit_finance_provider_document_change();

create or replace function public.create_finance_provider_document(p_document jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := auth.uid(); new_id uuid; total numeric(14,2);
begin
  if not private.is_active_finance_admin() then raise exception 'Active Owner/Admin MFA required'; end if;
  total := coalesce(nullif(p_document->>'documentTotal','')::numeric,0);
  if total < 0 then raise exception 'Document total cannot be negative'; end if;
  insert into public.finance_provider_documents(
    provider_type,provider_name,provider_key,affiliate_provider_id,merchant_id,payment_provider_id,
    document_kind,document_flow,period_start,period_end,invoice_number,invoice_date,counterparty_gstin,
    taxable_value,cgst_amount,sgst_amount,igst_amount,cess_amount,other_charges,round_off,document_total,currency,notes,
    created_by,updated_by
  ) values (
    p_document->>'providerType',trim(p_document->>'providerName'),nullif(trim(p_document->>'providerKey'),''),
    nullif(p_document->>'affiliateProviderId','')::uuid,nullif(p_document->>'merchantId','')::uuid,
    nullif(p_document->>'paymentProviderId','')::uuid,p_document->>'documentKind',p_document->>'documentFlow',
    nullif(p_document->>'periodStart','')::date,nullif(p_document->>'periodEnd','')::date,
    nullif(trim(p_document->>'invoiceNumber'),''),nullif(p_document->>'invoiceDate','')::date,
    nullif(upper(trim(p_document->>'counterpartyGstin')),''),
    coalesce(nullif(p_document->>'taxableValue','')::numeric,0),
    coalesce(nullif(p_document->>'cgstAmount','')::numeric,0),
    coalesce(nullif(p_document->>'sgstAmount','')::numeric,0),
    coalesce(nullif(p_document->>'igstAmount','')::numeric,0),
    coalesce(nullif(p_document->>'cessAmount','')::numeric,0),
    coalesce(nullif(p_document->>'otherCharges','')::numeric,0),
    coalesce(nullif(p_document->>'roundOff','')::numeric,0),total,'INR',
    nullif(trim(p_document->>'notes'),''),
    actor,actor
  ) returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.create_finance_provider_document(jsonb) from public,anon;
grant execute on function public.create_finance_provider_document(jsonb) to authenticated;

create or replace function public.record_finance_provider_document_match(
  p_document_id uuid,p_source_type text,p_source_id uuid,p_source_reference text,p_reported_amount numeric,p_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := auth.uid(); doc public.finance_provider_documents%rowtype;
  expected numeric(14,2); new_id uuid; resolved_status text;
begin
  if not private.is_active_finance_admin() then raise exception 'Active Owner/Admin MFA required'; end if;
  select * into doc from public.finance_provider_documents where id=p_document_id and entry_status='active';
  if not found then raise exception 'Active provider document not found'; end if;
  if p_reported_amount is null or p_reported_amount < 0 or length(trim(coalesce(p_note,''))) < 3 then
    raise exception 'Reported amount and match note are required';
  end if;
  if p_source_type='affiliate_conversion' then
    if doc.provider_type not in ('affiliate_network','brand') then raise exception 'This document cannot match affiliate conversions'; end if;
    select c.commission_amount into expected from public.referral_conversions c
    where c.id=p_source_id
      and (doc.affiliate_provider_id is null or c.provider_id=doc.affiliate_provider_id)
      and (doc.merchant_id is null or c.merchant_id=doc.merchant_id)
      and coalesce(c.currency,'INR')=doc.currency
      and (doc.period_start is null or c.occurred_at::date>=doc.period_start)
      and (doc.period_end is null or c.occurred_at::date<=doc.period_end);
  elsif p_source_type='commerce_order' then
    if doc.provider_type not in ('voucher_bill_provider','payment_gateway') then raise exception 'This document cannot match commerce orders'; end if;
    select o.amount into expected from public.commerce_finance_orders o
    where o.id=p_source_id
      and (
        doc.provider_key is null
        or (doc.provider_type='voucher_bill_provider' and o.fulfilment_provider_key=doc.provider_key)
        or (doc.provider_type='payment_gateway' and o.payment_provider_key=doc.provider_key)
      )
      and (doc.payment_provider_id is null or o.payment_provider_key=(
        select p.provider_key from public.payment_provider_configs p where p.id=doc.payment_provider_id
      ))
      and o.currency=doc.currency
      and (doc.period_start is null or o.created_at::date>=doc.period_start)
      and (doc.period_end is null or o.created_at::date<=doc.period_end);
  elsif p_source_type='payout_item' then
    if doc.provider_type <> 'payout_provider' then raise exception 'This document cannot match payout items'; end if;
    select i.amount into expected from public.payout_items i
    where i.id=p_source_id and i.currency=doc.currency
      and (doc.period_start is null or i.created_at::date>=doc.period_start)
      and (doc.period_end is null or i.created_at::date<=doc.period_end);
  else
    raise exception 'Select a supported system source';
  end if;
  if expected is null then raise exception 'Selected source was not found or does not belong to this provider'; end if;

  resolved_status := case when abs(p_reported_amount-expected) <= 0.02 then 'matched' else 'difference' end;
  insert into public.finance_provider_document_matches(
    document_id,source_type,source_id,source_reference,provider_reported_amount,system_amount,match_status,match_note,created_by
  ) values (
    p_document_id,p_source_type,p_source_id,nullif(trim(p_source_reference),''),p_reported_amount,expected,resolved_status,trim(p_note),actor
  ) returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.record_finance_provider_document_match(uuid,text,uuid,text,numeric,text) from public,anon;
grant execute on function public.record_finance_provider_document_match(uuid,text,uuid,text,numeric,text) to authenticated;

create or replace function public.record_manual_finance_provider_match(
  p_document_id uuid,p_source_reference text,p_reported_amount numeric,p_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := auth.uid(); new_id uuid;
begin
  if not private.is_active_finance_admin() then raise exception 'Active Owner/Admin MFA required'; end if;
  if not exists(select 1 from public.finance_provider_documents where id=p_document_id and entry_status='active') then
    raise exception 'Active provider document not found';
  end if;
  if p_reported_amount is null or p_reported_amount < 0 or length(trim(coalesce(p_note,''))) < 3 then
    raise exception 'Reported amount and match note are required';
  end if;
  insert into public.finance_provider_document_matches(
    document_id,source_type,source_id,source_reference,provider_reported_amount,system_amount,match_status,match_note,created_by
  ) values (
    p_document_id,'manual',null,nullif(trim(p_source_reference),''),p_reported_amount,null,'manual',trim(p_note),actor
  ) returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.record_manual_finance_provider_match(uuid,text,numeric,text) from public,anon;
grant execute on function public.record_manual_finance_provider_match(uuid,text,numeric,text) to authenticated;

create or replace function public.attach_finance_provider_document_file(
  p_document_id uuid,p_path text,p_file_name text,p_mime_type text,p_size_bytes bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_active_finance_admin() then raise exception 'Active Owner/Admin MFA required'; end if;
  if p_path not like p_document_id::text || '/%' then raise exception 'Document path does not match provider document'; end if;
  if p_mime_type not in ('application/pdf','image/jpeg','image/png','image/webp','text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    or p_size_bytes < 1 or p_size_bytes > 15728640 then raise exception 'Unsupported file type or size'; end if;
  if not exists(select 1 from storage.objects where bucket_id='finance-provider-documents' and name=p_path) then
    raise exception 'Uploaded file was not found in the private bucket';
  end if;
  update public.finance_provider_documents
  set document_path=p_path,document_file_name=left(trim(p_file_name),255),
      document_mime_type=p_mime_type,document_size_bytes=p_size_bytes,updated_by=auth.uid(),updated_at=now()
  where id=p_document_id and entry_status='active';
  if not found then raise exception 'Provider document is missing or void'; end if;
end;
$$;
revoke all on function public.attach_finance_provider_document_file(uuid,text,text,text,bigint) from public,anon;
grant execute on function public.attach_finance_provider_document_file(uuid,text,text,text,bigint) to authenticated;

create or replace function public.void_finance_provider_document(p_document_id uuid,p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_active_finance_admin() then raise exception 'Active Owner/Admin MFA required'; end if;
  if length(trim(coalesce(p_reason,''))) < 5 then raise exception 'A reason is required to void a provider document'; end if;
  update public.finance_provider_documents
  set entry_status='void',void_reason=trim(p_reason),updated_by=auth.uid(),updated_at=now()
  where id=p_document_id and entry_status='active';
  if not found then raise exception 'Active provider document not found'; end if;
end;
$$;
revoke all on function public.void_finance_provider_document(uuid,text) from public,anon;
grant execute on function public.void_finance_provider_document(uuid,text) to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('finance-provider-documents','finance-provider-documents',false,15728640,array[
  'application/pdf','image/jpeg','image/png','image/webp','text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "finance admins upload provider documents" on storage.objects;
drop policy if exists "finance admins read provider documents" on storage.objects;
create policy "finance admins upload provider documents"
on storage.objects for insert to authenticated
with check (
  bucket_id='finance-provider-documents'
  and private.is_active_finance_admin()
  and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  and exists(select 1 from public.finance_provider_documents d where d.id::text=(storage.foldername(name))[1] and d.entry_status='active')
);
create policy "finance admins read provider documents"
on storage.objects for select to authenticated
using (
  bucket_id='finance-provider-documents'
  and private.is_active_finance_admin()
  and exists(select 1 from public.finance_provider_documents d where d.id::text=(storage.foldername(name))[1])
);

comment on table public.finance_provider_documents is
  'Manual register of provider tax documents and settlements with private source files and transcribed tax totals.';
comment on table public.finance_provider_document_matches is
  'Append-only source matches between provider reported amounts and system records; variance is calculated from snapshots.';
comment on table public.finance_provider_document_audit is
  'Append-only audit trail for provider documents and reconciliation matches.';
