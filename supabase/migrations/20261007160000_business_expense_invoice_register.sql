-- Step 4: manual business expense invoices, per-line GST details, private files and audit history.
-- Supplier tax amounts/rates are transcribed from invoices; input GST is never auto-claimed.

create table public.business_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_reference text not null unique default ('EXP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  expense_date date not null,
  category text not null check (category in (
    'hosting_software','advertising','payment_processing','professional_services',
    'office','travel','hardware','telecom','banking','other'
  )),
  vendor_name text not null check (length(trim(vendor_name)) between 2 and 200),
  vendor_gstin text,
  invoice_number text,
  invoice_date date,
  invoice_type text not null default 'other'
    check (invoice_type in ('tax_invoice','bill_of_supply','receipt','other')),
  place_of_supply_state text,
  description text not null check (length(trim(description)) between 2 and 500),
  assessable_total numeric(14,2) not null default 0 check (assessable_total >= 0),
  total_gst numeric(14,2) not null default 0 check (total_gst >= 0),
  other_charges numeric(14,2) not null default 0 check (other_charges >= 0),
  round_off numeric(8,2) not null default 0 check (round_off between -100 and 100),
  invoice_total numeric(14,2) not null check (invoice_total >= 0),
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  entry_status text not null default 'active' check (entry_status in ('active','void')),
  void_reason text,
  document_path text,
  document_name text,
  document_mime_type text,
  document_size_bytes bigint,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((entry_status = 'void') = (length(trim(coalesce(void_reason, ''))) > 0)),
  check (
    (document_path is null and document_name is null and document_mime_type is null and document_size_bytes is null)
    or
    (document_path is not null and document_name is not null and document_mime_type in ('application/pdf','image/jpeg','image/png','image/webp') and document_size_bytes between 1 and 10485760)
  ),
  check (vendor_gstin is null or length(trim(vendor_gstin)) = 15),
  check (invoice_date is null or invoice_date <= expense_date + 31)
);

create index business_expenses_date_idx on public.business_expenses (expense_date desc, created_at desc);
create index business_expenses_vendor_idx on public.business_expenses (vendor_name, invoice_date desc);

create table public.business_expense_lines (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.business_expenses(id) on delete restrict,
  line_number integer not null check (line_number > 0),
  description text not null check (length(trim(description)) between 2 and 300),
  hsn_sac text,
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  unit_name text,
  assessable_value numeric(14,2) not null check (assessable_value >= 0),
  gst_treatment text not null default 'unclassified'
    check (gst_treatment in ('unclassified','taxable','exempt','nil_rated','zero_rated','outside_scope','reverse_charge','other')),
  gst_rate_percent numeric(7,4) check (gst_rate_percent between 0 and 100),
  cgst_rate_percent numeric(7,4) check (cgst_rate_percent between 0 and 100),
  sgst_rate_percent numeric(7,4) check (sgst_rate_percent between 0 and 100),
  igst_rate_percent numeric(7,4) check (igst_rate_percent between 0 and 100),
  cess_rate_percent numeric(7,4) check (cess_rate_percent between 0 and 100),
  cgst_amount numeric(14,2) not null default 0 check (cgst_amount >= 0),
  sgst_amount numeric(14,2) not null default 0 check (sgst_amount >= 0),
  igst_amount numeric(14,2) not null default 0 check (igst_amount >= 0),
  cess_amount numeric(14,2) not null default 0 check (cess_amount >= 0),
  tax_code_version_id uuid references public.tax_code_versions(id) on delete restrict,
  input_tax_review_status text not null default 'pending_review'
    check (input_tax_review_status in ('pending_review','eligible','partially_eligible','ineligible','not_applicable')),
  input_tax_eligible_amount numeric(14,2) not null default 0 check (input_tax_eligible_amount >= 0),
  input_tax_review_note text,
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(expense_id, line_number),
  check (input_tax_eligible_amount <= cgst_amount + sgst_amount + igst_amount + cess_amount),
  check (
    (input_tax_review_status = 'pending_review'
      and input_tax_eligible_amount = 0 and reviewed_by is null and reviewed_at is null)
    or
    (input_tax_review_status in ('eligible','partially_eligible')
      and input_tax_eligible_amount > 0 and reviewed_by is not null and reviewed_at is not null
      and length(trim(coalesce(input_tax_review_note,''))) > 0)
    or
    (input_tax_review_status in ('ineligible','not_applicable')
      and input_tax_eligible_amount = 0 and reviewed_by is not null and reviewed_at is not null
      and length(trim(coalesce(input_tax_review_note,''))) > 0)
  )
);

create index business_expense_lines_expense_idx on public.business_expense_lines (expense_id, line_number);

create table public.business_expense_audit (
  id bigint generated always as identity primary key,
  expense_id uuid not null references public.business_expenses(id) on delete restrict,
  entity_type text not null check (entity_type in ('expense','line')),
  entity_id text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in ('insert','update')),
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create index business_expense_audit_expense_idx on public.business_expense_audit (expense_id, created_at desc);

alter table public.business_expenses enable row level security;
alter table public.business_expense_lines enable row level security;
alter table public.business_expense_audit enable row level security;
revoke all on public.business_expenses from public, anon, authenticated;
revoke all on public.business_expense_lines from public, anon, authenticated;
revoke all on public.business_expense_audit from public, anon, authenticated;
grant select on public.business_expenses to authenticated;
grant select on public.business_expense_lines to authenticated;
grant select on public.business_expense_audit to authenticated;

create or replace function private.is_active_finance_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.jwt() ->> 'aal') = 'aal2'
    and exists (
      select 1 from public.profiles p
      join public.employees e on e.profile_id = p.id
      where p.id = (select auth.uid())
        and p.role::text in ('owner','admin')
        and e.status::text = 'active'
    );
$$;
revoke all on function private.is_active_finance_admin() from public, anon;
grant execute on function private.is_active_finance_admin() to authenticated;

create policy "active finance admins read business expenses"
on public.business_expenses for select to authenticated
using (private.is_active_finance_admin());
create policy "active finance admins read business expense lines"
on public.business_expense_lines for select to authenticated
using (private.is_active_finance_admin());
create policy "active finance admins read business expense audit"
on public.business_expense_audit for select to authenticated
using (private.is_active_finance_admin());

create or replace function private.audit_business_expense_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expense_key uuid;
begin
  if TG_TABLE_NAME = 'business_expenses' then
    expense_key := coalesce(NEW.id, OLD.id);
    insert into public.business_expense_audit(expense_id, entity_type, entity_id, actor_id, event_type, before_data, after_data)
    values (
      expense_key, 'expense', expense_key::text, auth.uid(), lower(TG_OP),
      case when TG_OP = 'INSERT' then null else to_jsonb(OLD) end,
      case when TG_OP = 'DELETE' then null else to_jsonb(NEW) end
    );
  else
    expense_key := coalesce(NEW.expense_id, OLD.expense_id);
    insert into public.business_expense_audit(expense_id, entity_type, entity_id, actor_id, event_type, before_data, after_data)
    values (
      expense_key, 'line', coalesce(NEW.id, OLD.id)::text, auth.uid(), lower(TG_OP),
      case when TG_OP = 'INSERT' then null else to_jsonb(OLD) end,
      case when TG_OP = 'DELETE' then null else to_jsonb(NEW) end
    );
  end if;
  return NEW;
end;
$$;
revoke all on function private.audit_business_expense_change() from public, anon, authenticated;

create trigger business_expense_audit_trigger
after insert or update on public.business_expenses
for each row execute function private.audit_business_expense_change();
create trigger business_expense_line_audit_trigger
after insert or update on public.business_expense_lines
for each row execute function private.audit_business_expense_change();

create or replace function public.create_business_expense_with_lines(p_expense jsonb, p_lines jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  expense_id uuid;
  item jsonb;
  idx integer := 0;
  assessable_sum numeric(14,2) := 0;
  tax_sum numeric(14,2) := 0;
  entered_total numeric(14,2);
  other_value numeric(14,2);
  round_value numeric(8,2);
  line_value numeric(14,2);
  line_tax numeric(14,2);
  code_id uuid;
  code_status text;
  code_area text;
  code_from date;
  code_to date;
  expense_day date;
begin
  if not private.is_active_finance_admin() then
    raise exception 'Active Owner/Admin MFA required';
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 1 or jsonb_array_length(p_lines) > 30 then
    raise exception 'Add between 1 and 30 invoice lines';
  end if;

  expense_day := (p_expense ->> 'expenseDate')::date;
  entered_total := (p_expense ->> 'invoiceTotal')::numeric;
  other_value := coalesce(nullif(p_expense ->> 'otherCharges','')::numeric,0);
  round_value := coalesce(nullif(p_expense ->> 'roundOff','')::numeric,0);
  if entered_total < 0 or other_value < 0 or round_value < -100 or round_value > 100 then
    raise exception 'Invoice amounts are invalid';
  end if;

  insert into public.business_expenses(
    expense_date, category, vendor_name, vendor_gstin, invoice_number, invoice_date,
    invoice_type, place_of_supply_state, description, other_charges, round_off,
    invoice_total, currency, created_by, updated_by
  ) values (
    expense_day,
    p_expense ->> 'category',
    trim(p_expense ->> 'vendorName'),
    nullif(upper(trim(p_expense ->> 'vendorGstin')),''),
    nullif(trim(p_expense ->> 'invoiceNumber'),''),
    nullif(p_expense ->> 'invoiceDate','')::date,
    p_expense ->> 'invoiceType',
    nullif(trim(p_expense ->> 'placeOfSupplyState'),''),
    trim(p_expense ->> 'description'),
    other_value, round_value, entered_total, 'INR', actor, actor
  ) returning id into expense_id;

  for item in select value from jsonb_array_elements(p_lines) loop
    idx := idx + 1;
    line_value := (item ->> 'assessableValue')::numeric;
    line_tax :=
      coalesce(nullif(item ->> 'cgstAmount','')::numeric,0) +
      coalesce(nullif(item ->> 'sgstAmount','')::numeric,0) +
      coalesce(nullif(item ->> 'igstAmount','')::numeric,0) +
      coalesce(nullif(item ->> 'cessAmount','')::numeric,0);
    if line_value < 0 or line_tax < 0 then raise exception 'Line amounts cannot be negative'; end if;
    code_id := nullif(item ->> 'taxCodeVersionId','')::uuid;
    if code_id is not null then
      select c.status, c.supply_area, c.effective_from, c.effective_to
      into code_status, code_area, code_from, code_to
      from public.tax_code_versions c where c.id = code_id;
      if not found or code_status <> 'approved'
        or code_area not in ('operating_expense','gateway_fee')
        or code_from > expense_day
        or (code_to is not null and code_to < expense_day) then
        raise exception 'Choose an approved expense tax code effective on the invoice date';
      end if;
    end if;

    insert into public.business_expense_lines(
      expense_id,line_number,description,hsn_sac,quantity,unit_name,assessable_value,
      gst_treatment,gst_rate_percent,cgst_rate_percent,sgst_rate_percent,igst_rate_percent,cess_rate_percent,
      cgst_amount,sgst_amount,igst_amount,cess_amount,tax_code_version_id,created_by
    ) values (
      expense_id,idx,trim(item ->> 'description'),nullif(trim(item ->> 'hsnSac'),''),
      coalesce(nullif(item ->> 'quantity','')::numeric,1),nullif(trim(item ->> 'unitName'),''),
      line_value,coalesce(nullif(item ->> 'gstTreatment',''),'unclassified'),
      nullif(item ->> 'gstRatePercent','')::numeric,
      nullif(item ->> 'cgstRatePercent','')::numeric,
      nullif(item ->> 'sgstRatePercent','')::numeric,
      nullif(item ->> 'igstRatePercent','')::numeric,
      nullif(item ->> 'cessRatePercent','')::numeric,
      coalesce(nullif(item ->> 'cgstAmount','')::numeric,0),
      coalesce(nullif(item ->> 'sgstAmount','')::numeric,0),
      coalesce(nullif(item ->> 'igstAmount','')::numeric,0),
      coalesce(nullif(item ->> 'cessAmount','')::numeric,0),
      code_id,actor
    );
    assessable_sum := assessable_sum + line_value;
    tax_sum := tax_sum + line_tax;
  end loop;

  if abs((assessable_sum + tax_sum + other_value + round_value) - entered_total) > 0.02 then
    raise exception 'Invoice total must match line values, GST, other charges, and rounding';
  end if;

  update public.business_expenses
  set assessable_total = assessable_sum, total_gst = tax_sum, updated_by = actor, updated_at = now()
  where id = expense_id;
  return expense_id;
end;
$$;
revoke all on function public.create_business_expense_with_lines(jsonb,jsonb) from public, anon;
grant execute on function public.create_business_expense_with_lines(jsonb,jsonb) to authenticated;

create or replace function public.review_business_expense_line(
  p_line_id uuid, p_status text, p_eligible_amount numeric, p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  available_tax numeric(14,2);
begin
  if not private.is_active_finance_admin() then raise exception 'Active Owner/Admin MFA required'; end if;
  if p_status not in ('eligible','partially_eligible','ineligible','not_applicable') then
    raise exception 'Select a review status';
  end if;
  if length(trim(coalesce(p_note,''))) < 3 then raise exception 'Add the adviser review note or reference'; end if;
  select cgst_amount + sgst_amount + igst_amount + cess_amount into available_tax
  from public.business_expense_lines where id = p_line_id;
  if not found then raise exception 'Expense line not found'; end if;
  if p_eligible_amount < 0 or p_eligible_amount > available_tax then raise exception 'Eligible amount must be within the invoice GST amount'; end if;
  if p_status in ('eligible','partially_eligible') and p_eligible_amount <= 0 then raise exception 'Enter the eligible amount confirmed by your adviser'; end if;
  if p_status in ('ineligible','not_applicable') and p_eligible_amount <> 0 then raise exception 'Ineligible lines must have zero eligible amount'; end if;

  update public.business_expense_lines
  set input_tax_review_status = p_status,
      input_tax_eligible_amount = p_eligible_amount,
      input_tax_review_note = trim(p_note),
      reviewed_by = actor,
      reviewed_at = now(),
      updated_at = now()
  where id = p_line_id;
end;
$$;
revoke all on function public.review_business_expense_line(uuid,text,numeric,text) from public, anon;
grant execute on function public.review_business_expense_line(uuid,text,numeric,text) to authenticated;

create or replace function public.attach_business_expense_document(
  p_expense_id uuid, p_path text, p_name text, p_mime_type text, p_size_bytes bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if not private.is_active_finance_admin() then raise exception 'Active Owner/Admin MFA required'; end if;
  if p_path not like p_expense_id::text || '/%' then raise exception 'Document path does not match expense record'; end if;
  if p_mime_type not in ('application/pdf','image/jpeg','image/png','image/webp')
    or p_size_bytes < 1 or p_size_bytes > 10485760 then raise exception 'Unsupported document type or size'; end if;
  if not exists (
    select 1 from storage.objects where bucket_id = 'finance-expense-invoices' and name = p_path
  ) then raise exception 'Uploaded document was not found in the private invoice bucket'; end if;
  update public.business_expenses
  set document_path = p_path,
      document_name = left(trim(p_name),255),
      document_mime_type = p_mime_type,
      document_size_bytes = p_size_bytes,
      updated_by = actor,
      updated_at = now()
  where id = p_expense_id and entry_status = 'active';
  if not found then raise exception 'Expense entry not found or void'; end if;
end;
$$;
revoke all on function public.attach_business_expense_document(uuid,text,text,text,bigint) from public, anon;
grant execute on function public.attach_business_expense_document(uuid,text,text,text,bigint) to authenticated;

create or replace function public.void_business_expense(p_expense_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_active_finance_admin() then raise exception 'Active Owner/Admin MFA required'; end if;
  if length(trim(coalesce(p_reason,''))) < 5 then raise exception 'A reason is required to void an expense'; end if;
  update public.business_expenses
  set entry_status='void', void_reason=trim(p_reason), updated_by=auth.uid(), updated_at=now()
  where id=p_expense_id and entry_status='active';
  if not found then raise exception 'Active expense entry not found'; end if;
end;
$$;
revoke all on function public.void_business_expense(uuid,text) from public, anon;
grant execute on function public.void_business_expense(uuid,text) to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'finance-expense-invoices','finance-expense-invoices',false,10485760,
  array['application/pdf','image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "finance admins upload expense invoices" on storage.objects;
drop policy if exists "finance admins read expense invoices" on storage.objects;
create policy "finance admins upload expense invoices"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'finance-expense-invoices'
  and private.is_active_finance_admin()
  and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  and exists (select 1 from public.business_expenses e where e.id::text = (storage.foldername(name))[1] and e.entry_status='active')
);
create policy "finance admins read expense invoices"
on storage.objects for select to authenticated
using (
  bucket_id = 'finance-expense-invoices'
  and private.is_active_finance_admin()
  and exists (select 1 from public.business_expenses e where e.id::text = (storage.foldername(name))[1])
);

create or replace function private.audit_business_expense_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expense_key uuid;
begin
  if TG_TABLE_NAME = 'business_expenses' then
    expense_key := coalesce(NEW.id, OLD.id);
    insert into public.business_expense_audit(expense_id, entity_type, entity_id, actor_id, event_type, before_data, after_data)
    values (
      expense_key, 'expense', expense_key::text, auth.uid(), lower(TG_OP),
      case when TG_OP = 'INSERT' then null else to_jsonb(OLD) end,
      case when TG_OP = 'DELETE' then null else to_jsonb(NEW) end
    );
  else
    expense_key := coalesce(NEW.expense_id, OLD.expense_id);
    insert into public.business_expense_audit(expense_id, entity_type, entity_id, actor_id, event_type, before_data, after_data)
    values (
      expense_key, 'line', coalesce(NEW.id, OLD.id)::text, auth.uid(), lower(TG_OP),
      case when TG_OP = 'INSERT' then null else to_jsonb(OLD) end,
      case when TG_OP = 'DELETE' then null else to_jsonb(NEW) end
    );
  end if;
  return NEW;
end;
$$;

create or replace view public.finance_tax_source_ledger
with (security_invoker = true)
as
  select 'affiliate_conversion'::text as source_type,c.id as source_id,c.redirect_event_id as related_source_id,
    c.occurred_at as occurred_at,c.profile_id,c.merchant_id,c.provider_id as affiliate_provider_id,
    c.provider_order_reference as source_reference,c.status::text as source_status,c.currency,
    c.order_value::numeric as order_value,c.commission_amount::numeric as commission_amount,
    c.cashback_amount::numeric as cashback_amount,c.commission_amount::numeric as source_amount
  from public.referral_conversions c
  union all
  select 'cashback_award'::text,a.id,a.conversion_id,a.created_at,a.profile_id,
    null::uuid,null::uuid,null::text,a.status::text,a.currency,
    null::numeric,null::numeric,a.amount::numeric,a.amount::numeric
  from public.cashback_awards a
  union all
  select 'wallet_entry'::text,w.id,coalesce(w.award_id,w.payout_item_id),w.created_at,w.profile_id,
    null::uuid,null::uuid,null::text,w.entry_type::text,'INR'::text,
    null::numeric,null::numeric,null::numeric,w.amount::numeric
  from public.wallet_entries w
  union all
  select 'withdrawal_request'::text,r.id,null::uuid,r.created_at,r.profile_id,
    null::uuid,null::uuid,null::text,r.status::text,'INR'::text,
    null::numeric,null::numeric,null::numeric,r.amount::numeric
  from public.withdrawal_requests r
  union all
  select 'payout_batch'::text,b.id,null::uuid,b.created_at,null::uuid,
    null::uuid,null::uuid,b.batch_reference::text,b.status::text,b.currency,
    null::numeric,null::numeric,null::numeric,b.total_amount::numeric
  from public.payout_batches b
  union all
  select 'payout_item'::text,i.id,i.withdrawal_id,i.created_at,i.profile_id,
    null::uuid,null::uuid,i.provider_payout_reference::text,i.status::text,i.currency,
    null::numeric,null::numeric,null::numeric,i.amount::numeric
  from public.payout_items i
  union all
  select 'payout_event'::text,e.id,e.payout_item_id,e.created_at,null::uuid,
    null::uuid,null::uuid,e.provider_reference::text,e.event_type::text,null::text,
    null::numeric,null::numeric,null::numeric,null::numeric
  from public.payout_events e
  union all
  select 'voucher_bill_order'::text,o.id,o.catalog_item_id,o.created_at,o.profile_id,
    null::uuid,null::uuid,coalesce(o.provider_order_reference,o.payment_reference,o.order_reference),
    (o.payment_status || '/' || o.fulfilment_status || '/' || o.verification_status)::text,
    o.currency,o.amount::numeric,null::numeric,null::numeric,o.amount::numeric
  from public.commerce_finance_orders o
  union all
  select 'business_expense'::text,x.id,null::uuid,
    (x.expense_date::timestamp at time zone 'Asia/Kolkata'),null::uuid,
    null::uuid,null::uuid,x.invoice_number,x.entry_status,x.currency,
    null::numeric,null::numeric,null::numeric,x.invoice_total::numeric
  from public.business_expenses x;

revoke all on public.finance_tax_source_ledger from public, anon, authenticated;
grant select on public.finance_tax_source_ledger to authenticated;

comment on table public.business_expenses is
  'Manual business expense and supplier invoice register. GST values are transcribed from source documents and require adviser review.';
comment on table public.business_expense_lines is
  'Invoice line-level HSN/SAC, supplied GST rates and tax amounts, and reviewer-controlled input tax treatment.';
comment on table public.business_expense_audit is
  'Append-only audit history for business expense headers and invoice lines.';
comment on view public.finance_tax_source_ledger is
  'Live, source-linked operational and expense records. Lifecycle rows are separate and not intended to be blindly summed.';
