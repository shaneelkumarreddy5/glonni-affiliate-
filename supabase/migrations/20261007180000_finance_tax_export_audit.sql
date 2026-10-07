-- Step 6: immutable audit records for quarterly finance/tax CSV exports.

create table public.finance_tax_export_audit (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  dataset text not null check (dataset in (
    'report_summary','affiliate_conversions','commerce_orders','cashback_awards','payout_items',
    'business_expenses','business_expense_lines','provider_documents','provider_matches'
  )),
  row_count bigint not null check (row_count >= 0),
  csv_sha256 text not null check (csv_sha256 ~ '^[a-f0-9]{64}$'),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  exported_at timestamptz not null default now(),
  check (period_end >= period_start)
);
create index finance_tax_export_audit_period_idx on public.finance_tax_export_audit(period_start,period_end,exported_at desc);
create index finance_tax_export_audit_actor_idx on public.finance_tax_export_audit(actor_id,exported_at desc);

alter table public.finance_tax_export_audit enable row level security;
revoke all on public.finance_tax_export_audit from public,anon,authenticated;
grant select on public.finance_tax_export_audit to authenticated;
create policy "active finance admins read tax export audit"
on public.finance_tax_export_audit for select to authenticated
using (private.is_active_finance_admin());

create or replace function public.record_finance_tax_export(
  p_period_start date,p_period_end date,p_dataset text,p_row_count bigint,p_csv_sha256 text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := auth.uid(); new_id uuid;
begin
  if not private.is_active_finance_admin() then raise exception 'Active Owner/Admin MFA required'; end if;
  if p_period_start is null or p_period_end is null or p_period_end<p_period_start then
    raise exception 'Invalid export period';
  end if;
  if p_dataset not in (
    'report_summary','affiliate_conversions','commerce_orders','cashback_awards','payout_items',
    'business_expenses','business_expense_lines','provider_documents','provider_matches'
  ) then raise exception 'Unsupported export dataset'; end if;
  if p_row_count is null or p_row_count<0 or p_csv_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid export row count or checksum';
  end if;
  insert into public.finance_tax_export_audit(period_start,period_end,dataset,row_count,csv_sha256,actor_id)
  values(p_period_start,p_period_end,p_dataset,p_row_count,p_csv_sha256,actor)
  returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.record_finance_tax_export(date,date,text,bigint,text) from public,anon;
grant execute on function public.record_finance_tax_export(date,date,text,bigint,text) to authenticated;

comment on table public.finance_tax_export_audit is
  'Append-only log of auditor CSV exports, with selected period, dataset, row count and SHA-256 digest.';
