import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminSidebar } from '@/components/admin-sidebar';
import { createClient } from '@/lib/supabase/server';
import { AlertTriangle,ArrowLeft,Download,FileClock,ReceiptText,ShieldCheck } from 'lucide-react';
import { getFinanceTaxReport } from '@/lib/finance-tax/report-data';
import { fiscalYearOptions,getLatestCompletedFiscalSelection } from '@/lib/finance-tax/fiscal-period';
import { resolveReportPeriod } from '@/lib/finance-tax/report-period';
import { ReportPrintButton } from '@/components/report-print-button';

export const dynamic='force-dynamic';
type Search={mode?:string;date?:string;from?:string;to?:string;fy?:string;q?:string};
const money=(v:number|string|null|undefined)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(Number(v??0));
const sum=(rows:any[],key:string)=>rows.reduce((total,row)=>total+Number(row[key]??0),0);
const labels=(v:string)=>v.replaceAll('_',' ');
const localDate=(v:string)=>new Date(v).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'});
const datasetLabels:Record<string,string>={
  report_summary:'Selected-period summary',
  affiliate_conversions:'Affiliate commissions and conversions',
  commerce_orders:'Voucher and bill orders',
  cashback_awards:'Cashback award register',
  payout_items:'User payout register',
  business_expenses:'Business expense invoices',
  business_expense_lines:'Purchase invoice tax lines and ITC review',
  provider_documents:'Provider statements and tax documents',
  provider_matches:'Provider reconciliation matches and variances',
};

export default async function FinanceTaxReportsPage({searchParams}:{searchParams:Promise<Search>}) {
  const query=await searchParams;
  const latest=getLatestCompletedFiscalSelection();
  const period=resolveReportPeriod(query)??resolveReportPeriod({mode:'quarter',fy:latest.fy,q:latest.q})!;
  const fyOptions=fiscalYearOptions(latest.fy);
  const selectedDate=query.date??new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date());
  const supabase=await createClient();
  const [{data:{user}},{data:assurance}]=await Promise.all([supabase.auth.getUser(),supabase.auth.mfa.getAuthenticatorAssuranceLevel()]);
  if(!user)redirect('/admin/login?next=/admin/finance-tax/reports');
  const [{data:profile},{data:employee}]=await Promise.all([
    supabase.from('profiles').select('role').eq('id',user.id).maybeSingle(),
    supabase.from('employees').select('status').eq('profile_id',user.id).maybeSingle(),
  ]);
  if(assurance?.currentLevel!=='aal2'||!profile||!['owner','admin'].includes(profile.role)||employee?.status!=='active')
    redirect('/admin/login?next=/admin/finance-tax/reports');

  const [report,exportAuditResult]=await Promise.all([
    getFinanceTaxReport(supabase,period.start,period.end),
    supabase.from('finance_tax_export_audit').select('id,actor_id,period_start,period_end,dataset,row_count,csv_sha256,exported_at').order('exported_at',{ascending:false}).limit(25),
  ]);
  const activeExpenses=report.expenses.filter(row=>row.entry_status==='active');
  const activeExpenseIds=new Set(activeExpenses.map(row=>row.id));
  const activeExpenseLines=report.expenseLines.filter(row=>activeExpenseIds.has(row.expense_id));
  const activeDocs=report.providerDocuments.filter(row=>row.entry_status==='active');
  const activeDocIds=new Set(activeDocs.map(row=>row.id));
  const activeMatches=report.providerMatches.filter(row=>activeDocIds.has(row.document_id));
  const expensesTotal=sum(activeExpenses,'invoice_total');
  const expenseGst=sum(activeExpenseLines,'cgst_amount')+sum(activeExpenseLines,'sgst_amount')+sum(activeExpenseLines,'igst_amount')+sum(activeExpenseLines,'cess_amount');
  const reviewedItc=sum(activeExpenseLines.filter(row=>['eligible','partially_eligible'].includes(row.input_tax_review_status)),'input_tax_eligible_amount');
  const pendingItc=activeExpenseLines.filter(row=>row.input_tax_review_status==='pending_review').length;
  const taxableConversions=report.conversions;
  const commerceOrderTotal=sum(report.commerceOrders,'amount');
  const affiliateCommissionTotal=sum(taxableConversions,'commission_amount');
  const cashbackTotal=sum(report.cashbackAwards,'amount');
  const payoutTotal=sum(report.payoutItems,'amount');
  const matchingDifferences=activeMatches.filter(row=>row.match_status==='difference');
  const varianceTotal=sum(matchingDifferences,'variance_amount');
  const docsMissing=activeDocs.filter(row=>!row.document_file_name).length;
  const expensesMissing=activeExpenses.filter(row=>!row.document_name).length;
  const activeDocsByFlow=(flow:string)=>activeDocs.filter(row=>row.document_flow===flow);
  const flowTax=(flow:string,key:string)=>sum(activeDocsByFlow(flow),key);
  const exportUrl=(dataset:string)=>`/admin/finance-tax/reports/export?mode=${period.mode}&from=${period.start}&to=${period.end}&dataset=${dataset}`;
  const metricStyle={display:'grid',gap:4,background:'#fff',border:'1px solid #e5e9f0',borderRadius:10,padding:15,minWidth:0};
  const labelStyle={fontSize:11,fontWeight:700,color:'#536078'};

  return <main className="admin-v2"><AdminSidebar/><section className="admin-main">
    <header className="admin-top"><ReceiptText size={21}/><b>Finance &amp; Tax · Reports</b><span className="dashboard-date">Auditor source pack</span><span className="avatar">SR</span></header>
    <main className="admin-content">
      <div className="admin-title"><div><p>FINANCE · REPORTING</p><h1>Finance &amp; tax reports</h1><span>Review source records and download selected-period registers for your auditor.</span></div><div style={{display:'flex',gap:8}}><ReportPrintButton/><Link href="/admin/finance-tax" className="add-store"><ArrowLeft size={14} style={{verticalAlign:'middle',marginRight:5}}/>Finance &amp; Tax</Link></div></div>
      <form method="get" action="/admin/finance-tax/reports" style={{display:'flex',gap:10,alignItems:'end',flexWrap:'wrap',background:'#fff',border:'1px solid #e5e9f0',borderRadius:10,padding:14,marginTop:16}}>
        <label style={{fontSize:11,fontWeight:700}}>Report period<select name="mode" defaultValue={period.mode} style={{display:'block',padding:9,marginTop:5,border:'1px solid #d7deea',borderRadius:7}}><option value="day">Daily</option><option value="week">Weekly (Monday–Sunday)</option><option value="month">Monthly</option><option value="quarter">Quarterly</option><option value="custom">Custom dates</option></select></label>
        <label style={{fontSize:11,fontWeight:700}}>Date for daily / weekly / monthly<input type="date" name="date" defaultValue={selectedDate} style={{display:'block',padding:8,marginTop:5,border:'1px solid #d7deea',borderRadius:7}}/></label>
        <label style={{fontSize:11,fontWeight:700}}>Custom from<input type="date" name="from" defaultValue={query.from??period.start} style={{display:'block',padding:8,marginTop:5,border:'1px solid #d7deea',borderRadius:7}}/></label>
        <label style={{fontSize:11,fontWeight:700}}>Custom to<input type="date" name="to" defaultValue={query.to??period.end} style={{display:'block',padding:8,marginTop:5,border:'1px solid #d7deea',borderRadius:7}}/></label>
        <label style={{fontSize:11,fontWeight:700}}>FY<select name="fy" defaultValue={query.fy??latest.fy} style={{display:'block',padding:8,marginTop:5,border:'1px solid #d7deea',borderRadius:7}}>{fyOptions.map(fy=><option key={fy} value={fy}>{fy}</option>)}</select></label>
        <label style={{fontSize:11,fontWeight:700}}>Quarter<select name="q" defaultValue={query.q??latest.q} style={{display:'block',padding:8,marginTop:5,border:'1px solid #d7deea',borderRadius:7}}><option value="1">Q1 · Apr–Jun</option><option value="2">Q2 · Jul–Sep</option><option value="3">Q3 · Oct–Dec</option><option value="4">Q4 · Jan–Mar</option></select></label>
        <button className="add-store" type="submit">Load report</button>
        <b style={{marginLeft:'auto',fontSize:12,color:'#536078'}}>Showing {period.label} · {period.start} to {period.end}</b>
      </form>

      <section style={{display:'flex',gap:10,alignItems:'flex-start',padding:14,margin:'14px 0',border:'1px solid #f2d28c',borderRadius:9,background:'#fff9e9',color:'#73520a',fontSize:12,lineHeight:1.6}}>
        <AlertTriangle size={18}/><span><b>This is an auditor source pack, not a GST return or tax payable calculation.</b> Affiliate commissions, customer order values, cashback awards and payouts are shown as separate operational records. Customer invoice line taxes and GST on affiliate income are not yet captured consistently enough to calculate outward liability. Provider invoices and expenses show GST as reported on documents; only reviewed expense ITC appears in the reviewed amount.</span>
      </section>

      {report.errors.length>0&&<section role="alert" style={{padding:13,border:'1px solid #efb8ad',background:'#fff3ef',color:'#8f3024',borderRadius:9,fontSize:12,marginBottom:14}}>
        <b>Report data is incomplete.</b> One or more source queries failed or exceeded the safe row limit; do not rely on summary totals until corrected.
        <ul>{report.errors.map((error,index)=><li key={index}>{error}</li>)}</ul>
      </section>}

      <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:10}}>
        <article style={metricStyle}><small style={labelStyle}>Affiliate commission records</small><b style={{fontSize:20}}>{money(affiliateCommissionTotal)}</b><span style={{fontSize:11,color:'#68758b'}}>{report.conversions.length} conversion records · no GST inferred</span></article>
        <article style={metricStyle}><small style={labelStyle}>Voucher / bill order value</small><b style={{fontSize:20}}>{money(commerceOrderTotal)}</b><span style={{fontSize:11,color:'#68758b'}}>{report.commerceOrders.length} orders · gross operational amount, not taxable turnover</span></article>
        <article style={metricStyle}><small style={labelStyle}>Cashback award records</small><b style={{fontSize:20}}>{money(cashbackTotal)}</b><span style={{fontSize:11,color:'#68758b'}}>{report.cashbackAwards.length} award rows · not added to wallet/payout totals</span></article>
        <article style={metricStyle}><small style={labelStyle}>User payout item records</small><b style={{fontSize:20}}>{money(payoutTotal)}</b><span style={{fontSize:11,color:'#68758b'}}>{report.payoutItems.length} payout rows · status breakdown below</span></article>
        <article style={metricStyle}><small style={labelStyle}>Active business expense invoices</small><b style={{fontSize:20}}>{money(expensesTotal)}</b><span style={{fontSize:11,color:'#68758b'}}>{activeExpenses.length} invoices · {money(expenseGst)} GST reported on invoice lines</span></article>
        <article style={metricStyle}><small style={labelStyle}>Reviewer-confirmed expense ITC</small><b style={{fontSize:20}}>{money(reviewedItc)}</b><span style={{fontSize:11,color:'#68758b'}}>{pendingItc} expense lines still pending review</span></article>
      </section>

      <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:12,marginTop:14}}>
        <article style={{background:'#fff',border:'1px solid #e5e9f0',borderRadius:10,padding:15}}>
          <h2 style={{fontSize:15,marginTop:0}}>Provider documents · active reported tax</h2>
          <table><thead><tr><th>FLOW</th><th>DOCS</th><th>TAXABLE VALUE</th><th>CGST</th><th>SGST</th><th>IGST</th><th>CESS</th><th>TOTAL</th></tr></thead><tbody>
            {(['inward','outward','settlement'] as const).map(flow=><tr key={flow}><td>{labels(flow)}</td><td>{activeDocsByFlow(flow).length}</td><td>{money(flowTax(flow,'taxable_value'))}</td><td>{money(flowTax(flow,'cgst_amount'))}</td><td>{money(flowTax(flow,'sgst_amount'))}</td><td>{money(flowTax(flow,'igst_amount'))}</td><td>{money(flowTax(flow,'cess_amount'))}</td><td>{money(flowTax(flow,'document_total'))}</td></tr>)}
          </tbody></table>
          <small style={{display:'block',marginTop:8,color:'#68758b'}}>Inward provider-document GST is not automatically considered eligible input tax.</small>
        </article>
        <article style={{background:'#fff',border:'1px solid #e5e9f0',borderRadius:10,padding:15}}>
          <h2 style={{fontSize:15,marginTop:0}}>Reconciliation &amp; completeness</h2>
          <ul style={{fontSize:12,lineHeight:1.9,paddingLeft:18,marginBottom:0}}>
            <li>{activeMatches.length} provider match rows · {activeMatches.filter(row=>row.match_status==='matched').length} matched · {matchingDifferences.length} amount differences</li>
            <li>Difference variance: {money(varianceTotal)} (provider reported minus system amount)</li>
            <li>{activeMatches.filter(row=>row.match_status==='manual').length} manual unmatched records need source review</li>
            <li>{docsMissing} active provider documents and {expensesMissing} active expense invoices have no file attached</li>
            <li>{pendingItc} expense invoice lines need adviser review · {activeDocsByFlow('inward').length} inward provider documents have no separate ITC review decision</li>
            <li>{report.undatedConversionCount} affiliate conversion records have no event date and are excluded from quarter totals</li>
          </ul>
        </article>
      </section>

      <section style={{background:'#fff',border:'1px solid #e5e9f0',borderRadius:10,padding:15,marginTop:14}}>
        <h2 style={{fontSize:15,marginTop:0}}>Operational status breakdown</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:12}}>
          {[
            ['Affiliate conversions',report.conversions,'status','commission_amount'],
            ['Cashback awards',report.cashbackAwards,'status','amount'],
            ['Voucher / bill orders',report.commerceOrders,'payment_status','amount'],
            ['Payout items',report.payoutItems,'status','amount'],
            ['Business expense entries',report.expenses,'entry_status','invoice_total'],
            ['Provider documents',report.providerDocuments,'entry_status','document_total'],
          ].map(([title,rows,statusKey,amountKey])=>{
            const list=rows as any[];const byStatus=new Map<string,{count:number;amount:number}>();
            for(const row of list){const key=String(row[statusKey as string]??'unknown');const item=byStatus.get(key)??{count:0,amount:0};item.count++;item.amount+=Number(row[amountKey as string]??0);byStatus.set(key,item);}
            return <div key={title as string} style={{border:'1px solid #edf0f5',borderRadius:8,padding:10}}>
              <b style={{fontSize:12}}>{title as string}</b>{[...byStatus].length?<ul style={{fontSize:11,color:'#536078',paddingLeft:17,marginBottom:0}}>{[...byStatus].map(([status,item])=><li key={status}>{labels(status)} · {item.count} · {money(item.amount)}</li>)}</ul>:<p style={{fontSize:11,color:'#68758b',marginBottom:0}}>No records in this period.</p>}
            </div>;
          })}
        </div>
        <small style={{display:'block',marginTop:10,color:'#68758b'}}>Each section reports one source table only; totals across sections should not be added together because records can describe the same customer journey.</small>
      </section>

      <section style={{background:'#fff',border:'1px solid #e5e9f0',borderRadius:10,padding:15,marginTop:14}}>
        <header style={{display:'flex',alignItems:'center',gap:8}}><Download size={17}/><h2 style={{fontSize:15,margin:0}}>Auditor CSV registers</h2><span style={{marginLeft:'auto',fontSize:11,color:'#68758b'}}>Each download records its SHA-256 checksum and row count.</span></header>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:8,marginTop:12}}>
          {Object.entries(datasetLabels).map(([dataset,title])=><Link key={dataset} href={exportUrl(dataset)} className="add-store" style={{display:'flex',justifyContent:'space-between',alignItems:'center',textDecoration:'none'}}><span>{title}</span><Download size={14}/></Link>)}
        </div>
        <small style={{display:'block',marginTop:10,color:'#68758b'}}>CSV downloads are period-filtered and contain source references without customer names or payment destination details. Export history is retained below.</small>
      </section>

      <section style={{background:'#fff',border:'1px solid #e5e9f0',borderRadius:10,padding:15,marginTop:14,overflowX:'auto'}}>
        <h2 style={{fontSize:15,display:'flex',gap:8,alignItems:'center',marginTop:0}}><FileClock size={17}/>Recent auditor exports</h2>
        {exportAuditResult.error?<p role="alert" style={{fontSize:12,color:'#9b3022'}}>Export history is unavailable.</p>:exportAuditResult.data?.length?<table><thead><tr><th>EXPORTED AT</th><th>PERIOD</th><th>DATASET</th><th>ROWS</th><th>EXPORTED BY</th><th>SHA-256</th></tr></thead><tbody>{exportAuditResult.data.map(row=><tr key={row.id}><td>{localDate(row.exported_at)}</td><td>{row.period_start} to {row.period_end}</td><td>{datasetLabels[row.dataset]??labels(row.dataset)}</td><td>{row.row_count}</td><td><code>{row.actor_id}</code></td><td><code>{row.csv_sha256}</code></td></tr>)}</tbody></table>:<p style={{fontSize:12,color:'#68758b'}}>No auditor CSV exports have been downloaded yet.</p>}
      </section>
      <p style={{display:'flex',gap:7,alignItems:'center',fontSize:11,color:'#68758b',marginTop:14}}><ShieldCheck size={15}/>The affiliate acceptance simulator is stored separately from live finance source tables and is not included in this report.</p>
    </main>
  </section></main>;
}
