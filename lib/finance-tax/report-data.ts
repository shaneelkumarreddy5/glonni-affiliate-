import { addIsoDays } from './fiscal-period';

const PAGE_SIZE=1000;
const MAX_ROWS=50000;
type QueryFactory=(from:number,to:number)=>any;
type Paged={rows:any[];error:string|null};

async function fetchPaged(factory:QueryFactory,label:string):Promise<Paged>{
  const rows:any[]=[];
  for(let from=0;from<MAX_ROWS;from+=PAGE_SIZE){
    const {data,error}=await factory(from,from+PAGE_SIZE-1);
    if(error)return {rows,error:`${label}: ${error.message}`};
    const batch=data??[];
    rows.push(...batch);
    if(batch.length<PAGE_SIZE)return {rows,error:null};
  }
  return {rows,error:`${label}: more than ${MAX_ROWS.toLocaleString('en-IN')} rows; narrow the reporting period.`};
}

export type FinanceTaxReport={
  start:string;end:string;
  conversions:any[];cashbackAwards:any[];commerceOrders:any[];payoutItems:any[];
  expenses:any[];expenseLines:any[];providerDocuments:any[];providerMatches:any[];
  undatedConversionCount:number;
  errors:string[];
};

export async function getFinanceTaxReport(supabase:any,start:string,end:string):Promise<FinanceTaxReport>{
  const startTs=`${start}T00:00:00+05:30`;
  const endTs=`${addIsoDays(end,1)}T00:00:00+05:30`;
  const [conversionResult,cashbackResult,orderResult,payoutResult,expenseResult,docByDateResult,docByPeriodResult,undatedResult]=await Promise.all([
    fetchPaged((from,to)=>supabase.from('referral_conversions').select(
      'id,provider_id,merchant_id,provider_order_reference,status,currency,occurred_at,order_value,commission_amount,cashback_amount,financial_validation_status,expected_commission,commission_variance,financial_issue_codes'
    ).gte('occurred_at',startTs).lt('occurred_at',endTs).order('occurred_at').order('id').range(from,to),'Affiliate conversions'),
    fetchPaged((from,to)=>supabase.from('cashback_awards').select(
      'id,conversion_id,amount,currency,status,created_at,available_at'
    ).gte('created_at',startTs).lt('created_at',endTs).order('created_at').order('id').range(from,to),'Cashback awards'),
    fetchPaged((from,to)=>supabase.from('commerce_finance_orders').select(
      'id,order_reference,order_kind,fulfilment_provider_key,payment_provider_key,provider_order_reference,provider_invoice_number,provider_invoice_date,amount,currency,payment_status,fulfilment_status,verification_status,tax_code_version_id,created_at'
    ).gte('created_at',startTs).lt('created_at',endTs).order('created_at').order('id').range(from,to),'Voucher and bill orders'),
    fetchPaged((from,to)=>supabase.from('payout_items').select(
      'id,batch_id,provider_payout_reference,amount,currency,status,created_at,processed_at'
    ).gte('created_at',startTs).lt('created_at',endTs).order('created_at').order('id').range(from,to),'Payout items'),
    fetchPaged((from,to)=>supabase.from('business_expenses').select(
      'id,expense_reference,expense_date,category,vendor_name,vendor_gstin,invoice_number,invoice_date,invoice_type,place_of_supply_state,description,assessable_total,total_gst,other_charges,round_off,invoice_total,currency,entry_status,void_reason,document_name,created_at'
    ).gte('expense_date',start).lte('expense_date',end).order('expense_date').order('id').range(from,to),'Business expenses'),
    fetchPaged((from,to)=>supabase.from('finance_provider_documents').select(
      'id,document_reference,provider_type,provider_name,provider_key,affiliate_provider_id,merchant_id,payment_provider_id,document_kind,document_flow,period_start,period_end,invoice_number,invoice_date,counterparty_gstin,taxable_value,cgst_amount,sgst_amount,igst_amount,cess_amount,other_adjustments,round_off,document_total,currency,notes,entry_status,void_reason,document_file_name,created_at'
    ).not('invoice_date','is',null).gte('invoice_date',start).lte('invoice_date',end).order('invoice_date').order('id').range(from,to),'Provider documents by document date'),
    fetchPaged((from,to)=>supabase.from('finance_provider_documents').select(
      'id,document_reference,provider_type,provider_name,provider_key,affiliate_provider_id,merchant_id,payment_provider_id,document_kind,document_flow,period_start,period_end,invoice_number,invoice_date,counterparty_gstin,taxable_value,cgst_amount,sgst_amount,igst_amount,cess_amount,other_adjustments,round_off,document_total,currency,notes,entry_status,void_reason,document_file_name,created_at'
    ).is('invoice_date',null).not('period_end','is',null).gte('period_end',start).lte('period_end',end).order('period_end').order('id').range(from,to),'Provider statements by period end'),
    supabase.from('referral_conversions').select('id',{count:'exact',head:true}).is('occurred_at',null),
  ]);
  const errors:string[]=[];
  for(const result of [conversionResult,cashbackResult,orderResult,payoutResult,expenseResult,docByDateResult,docByPeriodResult])
    if(result.error)errors.push(result.error);
  if(undatedResult.error)errors.push(`Undated affiliate conversions: ${undatedResult.error.message}`);

  const expenses=expenseResult.rows;
  const expenseIds=expenses.map(row=>row.id);
  const expenseLines:any[]=[];
  for(let i=0;i<expenseIds.length;i+=200){
    const ids=expenseIds.slice(i,i+200);
    const result=await fetchPaged((from,to)=>supabase.from('business_expense_lines').select(
      'id,expense_id,line_number,description,hsn_sac,quantity,unit_name,assessable_value,gst_treatment,gst_rate_percent,cgst_rate_percent,sgst_rate_percent,igst_rate_percent,cess_rate_percent,cgst_amount,sgst_amount,igst_amount,cess_amount,input_tax_review_status,input_tax_eligible_amount,input_tax_review_note,reviewed_at,created_at'
    ).in('expense_id',ids).order('expense_id').order('line_number').range(from,to),'Business expense lines');
    expenseLines.push(...result.rows);
    if(result.error)errors.push(result.error);
  }

  const docMap=new Map<string,any>();
  for(const row of [...docByDateResult.rows,...docByPeriodResult.rows])docMap.set(row.id,row);
  const providerDocuments=[...docMap.values()];
  const providerMatches:any[]=[];
  const providerDocIds=providerDocuments.map(row=>row.id);
  for(let i=0;i<providerDocIds.length;i+=200){
    const ids=providerDocIds.slice(i,i+200);
    const result=await fetchPaged((from,to)=>supabase.from('finance_provider_document_matches').select(
      'id,document_id,source_type,source_id,source_reference,provider_reported_amount,system_amount,variance_amount,match_status,match_note,created_at'
    ).in('document_id',ids).order('document_id').order('created_at').range(from,to),'Provider reconciliation matches');
    providerMatches.push(...result.rows);
    if(result.error)errors.push(result.error);
  }

  return {
    start,end,
    conversions:conversionResult.rows,
    cashbackAwards:cashbackResult.rows,
    commerceOrders:orderResult.rows,
    payoutItems:payoutResult.rows,
    expenses,expenseLines,providerDocuments,providerMatches,
    undatedConversionCount:undatedResult.count??0,errors,
  };
}
