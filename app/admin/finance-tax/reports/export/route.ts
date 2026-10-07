import { createHash } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { getFinanceTaxReport } from '@/lib/finance-tax/report-data';
import { resolveReportPeriod } from '@/lib/finance-tax/report-period';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const DATASETS=new Set([
  'report_summary','affiliate_conversions','commerce_orders','cashback_awards','payout_items',
  'business_expenses','business_expense_lines','provider_documents','provider_matches',
]);
const asNumber=(v:any)=>Number(v??0);
const sum=(rows:any[],key:string)=>rows.reduce((total,row)=>total+asNumber(row[key]),0);
const json=(v:any)=>v===null||v===undefined?'':typeof v==='object'?JSON.stringify(v):String(v);
function csvCell(value:any,key:string) {
  if(value===null||value===undefined)return '';
  const text=json(value);
  const numeric=new Set([
    'order_value','commission_amount','cashback_amount','expected_commission','commission_variance',
    'amount','assessable_total','total_gst','other_charges','round_off','invoice_total','quantity',
    'assessable_value','gst_rate_percent','cgst_rate_percent','sgst_rate_percent','igst_rate_percent','cess_rate_percent',
    'cgst_amount','sgst_amount','igst_amount','cess_amount','input_tax_eligible_amount','taxable_value',
    'other_adjustments','document_total','provider_reported_amount','system_amount','variance_amount',
    'metric_value',
  ]);
  const safe=numeric.has(key)&&Number.isFinite(Number(text))?String(Number(text)):
    (/^[\s]*[=+\-@]/.test(text)?`'${text}`:text);
  return `"${safe.replaceAll('"','""')}"`;
}
function makeCsv(columns:string[],rows:any[]) {
  const header=columns.map(key=>csvCell(key,key)).join(',');
  const body=rows.map(row=>columns.map(key=>csvCell(row[key],key)).join(',')).join('\r\n');
  return '\uFEFF'+header+'\r\n'+body+'\r\n';
}

export async function GET(request:Request) {
  const url=new URL(request.url);
  const dataset=url.searchParams.get('dataset')??'';
  const period=resolveReportPeriod({mode:url.searchParams.get('mode'),date:url.searchParams.get('date'),from:url.searchParams.get('from'),to:url.searchParams.get('to'),fy:url.searchParams.get('fy'),q:url.searchParams.get('q')});
  if(!period||!DATASETS.has(dataset))return Response.json({error:'Select a valid report period and dataset.'},{status:400});

  const supabase=await createClient();
  const [{data:{user}},{data:assurance}]=await Promise.all([
    supabase.auth.getUser(),supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if(!user)return Response.json({error:'Sign in is required.'},{status:401});
  const [{data:profile},{data:employee}]=await Promise.all([
    supabase.from('profiles').select('role').eq('id',user.id).maybeSingle(),
    supabase.from('employees').select('status').eq('profile_id',user.id).maybeSingle(),
  ]);
  if(assurance?.currentLevel!=='aal2'||!profile||!['owner','admin'].includes(profile.role)||employee?.status!=='active')
    return Response.json({error:'Active Owner/Admin MFA is required.'},{status:403});

  const report=await getFinanceTaxReport(supabase,period.start,period.end);
  if(report.errors.length)return Response.json({error:'The source data is incomplete; no auditor export was produced.',details:report.errors},{status:503});
  const documentById=new Map<string,any>(report.providerDocuments.map(doc=>[doc.id,doc] as [string,any]));
  const expenseById=new Map<string,any>(report.expenses.map(expense=>[expense.id,expense] as [string,any]));
  let rows:any[]=[];
  let columns:string[]=[];

  if(dataset==='report_summary') {
    const activeExpenses=report.expenses.filter(row=>row.entry_status==='active');
    const activeExpenseIds=new Set(activeExpenses.map(row=>row.id));
    const activeLines=report.expenseLines.filter(row=>activeExpenseIds.has(row.expense_id));
    const activeDocs=report.providerDocuments.filter(row=>row.entry_status==='active');
    const activeDocIds=new Set(activeDocs.map(row=>row.id));
    const activeMatches=report.providerMatches.filter(row=>activeDocIds.has(row.document_id));
    const metrics=[
      ['Affiliate conversion rows',report.conversions.length,'Operational conversion records; tax code and GST treatment not inferred.'],
      ['Affiliate commission recorded (INR)',sum(report.conversions,'commission_amount'),'All conversion statuses are included; reconcile provider statement before accounting.'],
      ['Voucher/bill order rows',report.commerceOrders.length,'Gross order records; not a GST taxable-turnover calculation.'],
      ['Voucher/bill order amount (INR)',sum(report.commerceOrders,'amount'),'Amounts from the commerce order register across payment statuses.'],
      ['Cashback award rows',report.cashbackAwards.length,'Separate award ledger; do not add wallet or payout lifecycle rows.'],
      ['Cashback award amount (INR)',sum(report.cashbackAwards,'amount'),'All award statuses included.'],
      ['Payout item rows',report.payoutItems.length,'Separate payout source records; status breakdown is in the payout register.'],
      ['Payout item amount (INR)',sum(report.payoutItems,'amount'),'All payout statuses included; not added to cashback totals.'],
      ['Active expense invoices',activeExpenses.length,'Void entries excluded from this amount.'],
      ['Active expense invoice total (INR)',sum(activeExpenses,'invoice_total'),'Purchase register only.'],
      ['Expense invoice GST reported (INR)',sum(activeLines,'cgst_amount')+sum(activeLines,'sgst_amount')+sum(activeLines,'igst_amount')+sum(activeLines,'cess_amount'),'Invoice transcription; not all is necessarily eligible ITC.'],
      ['Reviewer-confirmed expense ITC (INR)',sum(activeLines.filter(row=>['eligible','partially_eligible'].includes(row.input_tax_review_status)),'input_tax_eligible_amount'),'Only amounts recorded in the reviewer-controlled ITC field.'],
      ['Active provider documents',activeDocs.length,'Reported source documents; inward GST requires separate adviser review.'],
      ['Active inward provider GST (INR)',sum(activeDocs.filter(row=>row.document_flow==='inward'),'cgst_amount')+sum(activeDocs.filter(row=>row.document_flow==='inward'),'sgst_amount')+sum(activeDocs.filter(row=>row.document_flow==='inward'),'igst_amount')+sum(activeDocs.filter(row=>row.document_flow==='inward'),'cess_amount'),'Reported on documents; not included in eligible ITC.'],
      ['Active outward provider-document GST (INR)',sum(activeDocs.filter(row=>row.document_flow==='outward'),'cgst_amount')+sum(activeDocs.filter(row=>row.document_flow==='outward'),'sgst_amount')+sum(activeDocs.filter(row=>row.document_flow==='outward'),'igst_amount')+sum(activeDocs.filter(row=>row.document_flow==='outward'),'cess_amount'),'Document register amount; does not establish complete outward liability.'],
      ['Provider match differences',activeMatches.filter(row=>row.match_status==='difference').length,'Source amount differences requiring review.'],
      ['Provider match variance (INR)',sum(activeMatches.filter(row=>row.match_status==='difference'),'variance_amount'),'Provider reported amount minus source snapshot.'],
      ['Affiliate conversion rows missing event date (all-time)',report.undatedConversionCount,'Excluded from quarter filters until a valid event date is available.'],
    ].map(([metric,value,note])=>({metric,metric_value:value,note,period_start:period.start,period_end:period.end}));
    rows=metrics;columns=['metric','metric_value','note','period_start','period_end'];
  } else if(dataset==='affiliate_conversions') {
    rows=report.conversions;columns=['id','provider_id','merchant_id','provider_order_reference','status','currency','occurred_at','order_value','commission_amount','cashback_amount','financial_validation_status','expected_commission','commission_variance','financial_issue_codes'];
  } else if(dataset==='commerce_orders') {
    rows=report.commerceOrders;columns=['id','order_reference','order_kind','fulfilment_provider_key','payment_provider_key','provider_order_reference','provider_invoice_number','provider_invoice_date','amount','currency','payment_status','fulfilment_status','verification_status','tax_code_version_id','created_at'];
  } else if(dataset==='cashback_awards') {
    rows=report.cashbackAwards;columns=['id','conversion_id','amount','currency','status','created_at','available_at'];
  } else if(dataset==='payout_items') {
    rows=report.payoutItems;columns=['id','batch_id','provider_payout_reference','amount','currency','status','created_at','processed_at'];
  } else if(dataset==='business_expenses') {
    rows=report.expenses.map(row=>({...row,document_attached:!!row.document_name}));
    columns=['id','expense_reference','expense_date','category','vendor_name','vendor_gstin','invoice_number','invoice_date','invoice_type','place_of_supply_state','description','assessable_total','total_gst','other_charges','round_off','invoice_total','currency','entry_status','void_reason','document_attached','created_at'];
  } else if(dataset==='business_expense_lines') {
    rows=report.expenseLines.map(row=>{
      const parent=expenseById.get(row.expense_id);
      return {...row,expense_reference:parent?.expense_reference??'',vendor_name:parent?.vendor_name??'',invoice_number:parent?.invoice_number??'',expense_date:parent?.expense_date??'',entry_status:parent?.entry_status??''};
    });
    columns=['id','expense_id','expense_reference','vendor_name','invoice_number','expense_date','entry_status','line_number','description','hsn_sac','quantity','unit_name','assessable_value','gst_treatment','gst_rate_percent','cgst_rate_percent','sgst_rate_percent','igst_rate_percent','cess_rate_percent','cgst_amount','sgst_amount','igst_amount','cess_amount','input_tax_review_status','input_tax_eligible_amount','input_tax_review_note','reviewed_at'];
  } else if(dataset==='provider_documents') {
    rows=report.providerDocuments.map(row=>({...row,document_attached:!!row.document_file_name}));
    columns=['id','document_reference','provider_type','provider_name','provider_key','document_kind','document_flow','period_start','period_end','invoice_number','invoice_date','counterparty_gstin','taxable_value','cgst_amount','sgst_amount','igst_amount','cess_amount','other_adjustments','round_off','document_total','currency','entry_status','void_reason','notes','document_attached','created_at'];
  } else {
    rows=report.providerMatches.map(row=>{
      const parent=documentById.get(row.document_id);
      return {...row,provider_name:parent?.provider_name??'',document_reference:parent?.document_reference??'',document_status:parent?.entry_status??''};
    });
    columns=['id','document_id','document_reference','provider_name','document_status','source_type','source_id','source_reference','provider_reported_amount','system_amount','variance_amount','match_status','match_note','created_at'];
  }

  const csv=makeCsv(columns,rows);
  const digest=createHash('sha256').update(csv,'utf8').digest('hex');
  const {error:auditError}=await supabase.rpc('record_finance_tax_export',{
    p_period_start:period.start,p_period_end:period.end,p_dataset:dataset,p_row_count:rows.length,p_csv_sha256:digest,
  });
  if(auditError)return Response.json({error:'Could not record the export audit; no file was returned.'},{status:500});

  return new Response(csv,{
    status:200,
    headers:{
      'Content-Type':'text/csv; charset=utf-8',
      'Content-Disposition':`attachment; filename="glonni-${dataset}-${period.mode}-${period.start}-to-${period.end}.csv"`,
      'Cache-Control':'private, no-store',
      'X-Content-Type-Options':'nosniff',
    },
  });
}
