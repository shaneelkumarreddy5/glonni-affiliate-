import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminSidebar } from '@/components/admin-sidebar';
import { createClient } from '@/lib/supabase/server';
import { AlertTriangle, ArrowLeft, FileText, ReceiptText, ShieldCheck, XCircle } from 'lucide-react';
import { createBusinessExpense, openBusinessExpenseDocument, reviewBusinessExpenseLine, voidBusinessExpense } from './actions';
import { ExpenseLinesEditor } from '@/components/expense-lines-editor';
import { ExpenseInvoiceUploader } from '@/components/expense-invoice-uploader';

export const dynamic = 'force-dynamic';

type Search = { notice?: string; open?: string };
const categories: Record<string,string> = {
  hosting_software:'Hosting & software', advertising:'Advertising', payment_processing:'Payment processing',
  professional_services:'Professional services', office:'Office', travel:'Travel', hardware:'Hardware',
  telecom:'Telecom', banking:'Banking fees', other:'Other',
};
const labels = (value:string) => value.replaceAll('_',' ');
const money = (value:number|string|null) => value===null||value===undefined?'—':
  new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(Number(value));

export default async function BusinessExpensesPage({searchParams}:{searchParams:Promise<Search>}) {
  const query=await searchParams;
  const supabase=await createClient();
  const [{data:{user}},{data:assurance}]=await Promise.all([
    supabase.auth.getUser(),supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if(!user) redirect('/admin/login?next=/admin/finance-tax/expenses');
  const [{data:profile},{data:employee}]=await Promise.all([
    supabase.from('profiles').select('role').eq('id',user.id).maybeSingle(),
    supabase.from('employees').select('status').eq('profile_id',user.id).maybeSingle(),
  ]);
  if(assurance?.currentLevel!=='aal2'||!profile||!['owner','admin'].includes(profile.role)||employee?.status!=='active') {
    redirect('/admin/login?next=/admin/finance-tax/expenses');
  }
  const {data:expenses,error}=await supabase.from('business_expenses').select('*').order('expense_date',{ascending:false}).limit(300);
  const ids=(expenses??[]).map(row=>row.id);
  let lines:any[]=[];
  let audit:any[]=[];
  let lineError:any=null;
  if(ids.length) {
    const [lineResult,auditResult]=await Promise.all([
      supabase.from('business_expense_lines').select('*').in('expense_id',ids).order('line_number'),
      supabase.from('business_expense_audit').select('expense_id,entity_type,event_type,created_at').in('expense_id',ids).order('created_at',{ascending:false}).limit(100),
    ]);
    lines=lineResult.data??[];
    lineError=lineResult.error;
    audit=auditResult.data??[];
  }
  const byExpense=new Map<string,any[]>();
  for(const line of lines??[]) byExpense.set(line.expense_id,[...(byExpense.get(line.expense_id)??[]),line]);
  const auditByExpense=new Map<string,any[]>();
  for(const event of audit??[]) auditByExpense.set(event.expense_id,[...(auditByExpense.get(event.expense_id)??[]),event]);
  const notices:Record<string,string>={
    expense_saved:'Expense saved. Attach the supplier invoice to keep its source document with the record.',
    review_saved:'Input tax review saved and audit recorded.',
    expense_voided:'Expense entry voided; the audit history is retained.',
    invalid_expense:'Check the expense header, invoice date, category and total.',
    invalid_lines:'Check invoice lines and numeric values.',
    create_failed:'Could not save this invoice. Ensure invoice total equals assessable lines, GST, other charges and rounding.',
    invalid_review:'A review status, amount and reviewer note are required.',
    review_failed:'Review could not be saved. Check the eligible amount against the GST on that line.',
    invalid_void:'Enter a reason of at least five characters.',
    void_failed:'This expense could not be voided.',
    document_missing:'No private document is attached to that expense.',
    document_unavailable:'The private invoice could not be opened.',
  };
  const notice=query.notice?notices[query.notice]:null;
  const inputStyle={width:'100%',boxSizing:'border-box' as const,padding:'9px 10px',border:'1px solid #d7deea',borderRadius:7,marginTop:5,fontSize:12};
  const labelStyle={display:'block',fontSize:11,fontWeight:600,color:'#46546a'};

  return <main className="admin-v2"><AdminSidebar/><section className="admin-main">
    <header className="admin-top"><ReceiptText size={21}/><b>Finance &amp; Tax · Expenses</b><span className="dashboard-date">Purchase invoices &amp; costs</span><span className="avatar">SR</span></header>
    <main className="admin-content">
      <div className="admin-title"><div><p>FINANCE · SOURCE DOCUMENTS</p><h1>Business expenses</h1><span>Enter supplier costs, invoice GST by line, and adviser-reviewed input tax status.</span></div><Link href="/admin/finance-tax" className="add-store"><ArrowLeft size={15} style={{verticalAlign:'middle',marginRight:6}}/>Finance &amp; Tax setup</Link></div>
      {notice&&<p role="status" style={{background:'#eef8f0',border:'1px solid #cfe8d5',padding:12,borderRadius:8,fontSize:12,color:'#24733c'}}>{notice}</p>}
      {(error||lineError)&&<p role="alert" style={{background:'#fff4e5',padding:12,borderRadius:8,fontSize:12}}>Expense tables are unavailable. Check the Step 4 database migration.</p>}
      <section style={{display:'flex',gap:10,alignItems:'flex-start',padding:13,margin:'16px 0',border:'1px solid #f2d28c',borderRadius:9,background:'#fff9e9',color:'#73520a',fontSize:12,lineHeight:1.55}}>
        <AlertTriangle size={18}/><span><b>Enter amounts from the source invoice.</b> GST and ITC are not inferred. Input tax remains pending until a reviewer records the adviser decision and note.</span>
      </section>
      <details open style={{background:'#fff',border:'1px solid #e5e9f0',borderRadius:10,padding:16}}>
        <summary style={{cursor:'pointer',fontWeight:700,display:'flex',alignItems:'center',gap:8}}><FileText size={17}/>Record an expense or supplier invoice</summary>
        <form action={createBusinessExpense} style={{display:'grid',gap:12,marginTop:14}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:10}}>
            <label style={labelStyle}>Expense date<input name="expenseDate" type="date" required style={inputStyle}/></label>
            <label style={labelStyle}>Category<select name="category" required style={inputStyle}>{Object.entries(categories).map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label>
            <label style={labelStyle}>Supplier / vendor<input name="vendorName" required maxLength={200} style={inputStyle}/></label>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:10}}>
            <label style={labelStyle}>Vendor GSTIN<input name="vendorGstin" maxLength={15} style={inputStyle} placeholder="Optional"/></label>
            <label style={labelStyle}>Invoice number<input name="invoiceNumber" maxLength={120} style={inputStyle}/></label>
            <label style={labelStyle}>Invoice date<input name="invoiceDate" type="date" style={inputStyle}/></label>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:10}}>
            <label style={labelStyle}>Document type<select name="invoiceType" style={inputStyle}><option value="tax_invoice">Tax invoice</option><option value="bill_of_supply">Bill of supply</option><option value="receipt">Receipt</option><option value="other">Other</option></select></label>
            <label style={labelStyle}>Place of supply (state)<input name="placeOfSupplyState" maxLength={80} style={inputStyle}/></label>
            <label style={labelStyle}>What was purchased?<input name="description" required maxLength={500} style={inputStyle} placeholder="e.g. Annual hosting subscription"/></label>
          </div>
          <ExpenseLinesEditor/>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:10}}>
            <label style={labelStyle}>Other charges (₹)<input name="otherCharges" type="number" min="0" step="0.01" defaultValue="0" style={inputStyle}/></label>
            <label style={labelStyle}>Round off (₹)<input name="roundOff" type="number" min="-100" max="100" step="0.01" defaultValue="0" style={inputStyle}/></label>
            <label style={labelStyle}>Invoice total (₹)<input name="invoiceTotal" type="number" min="0" step="0.01" required style={inputStyle}/></label>
          </div>
          <button className="add-store" type="submit">Save expense</button>
        </form>
      </details>

      <section style={{background:'#fff',border:'1px solid #e5e9f0',borderRadius:10,marginTop:18,overflow:'hidden'}}>
        <header style={{display:'flex',alignItems:'center',gap:8,padding:15,borderBottom:'1px solid #e5e9f0'}}><ReceiptText size={17}/><h2 style={{fontSize:15,margin:0}}>Expense register</h2><span style={{marginLeft:'auto',fontSize:11,color:'#68758b'}}>{expenses?.length??0} records · latest 300</span></header>
        {!expenses?.length?<p style={{padding:18,fontSize:12,color:'#68758b'}}>No expense invoices have been entered yet.</p>:<div style={{display:'grid',gap:12,padding:12}}>
          {expenses.map((expense:any)=>{
            const expenseLines=byExpense.get(expense.id)??[];
            const open=query.open===expense.id;
            const events=auditByExpense.get(expense.id)??[];
            return <details key={expense.id} open={open} style={{border:'1px solid #e5e9f0',borderRadius:9,padding:13}}>
              <summary style={{cursor:'pointer',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                <b>{expense.vendor_name}</b><span style={{color:'#68758b',fontSize:11}}>{expense.invoice_number||expense.expense_reference} · {expense.invoice_date||expense.expense_date} · {categories[expense.category]??labels(expense.category)}</span>
                <b style={{marginLeft:'auto'}}>{money(expense.invoice_total)}</b><span style={{fontSize:10,padding:'4px 7px',borderRadius:10,background:expense.entry_status==='active'?'#eaf6ed':'#fbeceb',color:expense.entry_status==='active'?'#277247':'#a63d36'}}>{labels(expense.entry_status)}</span>
              </summary>
              <div style={{display:'grid',gap:12,marginTop:13}}>
                <div style={{fontSize:12,color:'#536078'}}><b>Invoice:</b> {expense.invoice_type.replaceAll('_',' ')} · GSTIN {expense.vendor_gstin||'not provided'} · Place of supply {expense.place_of_supply_state||'not set'}<br/><b>Description:</b> {expense.description}<br/><b>Totals:</b> Assessable {money(expense.assessable_total)} · GST {money(expense.total_gst)} · Other {money(expense.other_charges)} · Round off {money(expense.round_off)}</div>
                <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
                  <form action={openBusinessExpenseDocument}><input type="hidden" name="expenseId" value={expense.id}/><button type="submit" disabled={!expense.document_path} className="add-store">{expense.document_path?'Open private invoice':'No invoice file'}</button></form>
                  {expense.entry_status==='active'&&<ExpenseInvoiceUploader expenseId={expense.id} documentName={expense.document_name}/>}
                </div>
                {expenseLines.map((line:any)=><div key={line.id} style={{border:'1px solid #edf0f5',borderRadius:8,padding:12,fontSize:12}}>
                  <b>Line {line.line_number}: {line.description}</b><span style={{marginLeft:8,color:'#68758b'}}>HSN/SAC {line.hsn_sac||'—'} · {line.gst_treatment.replaceAll('_',' ')} · {money(line.assessable_value)}</span>
                  <p style={{margin:'6px 0',color:'#536078'}}>Rates: GST {line.gst_rate_percent??'—'}% · CGST {line.cgst_rate_percent??'—'}% · SGST {line.sgst_rate_percent??'—'}% · IGST {line.igst_rate_percent??'—'}% · cess {line.cess_rate_percent??'—'}%<br/>Tax amounts: CGST {money(line.cgst_amount)} · SGST {money(line.sgst_amount)} · IGST {money(line.igst_amount)} · cess {money(line.cess_amount)}<br/>Input tax review: <b>{labels(line.input_tax_review_status)}</b> · eligible {money(line.input_tax_eligible_amount)}{line.input_tax_review_note?<> · {line.input_tax_review_note}</>:null}</p>
                  {expense.entry_status==='active'&&<form action={reviewBusinessExpenseLine} style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 2fr auto',gap:8,alignItems:'end'}}>
                    <input type="hidden" name="lineId" value={line.id}/><input type="hidden" name="expenseId" value={expense.id}/>
                    <label style={labelStyle}>Review status<select name="status" defaultValue={line.input_tax_review_status==='pending_review'?'not_applicable':line.input_tax_review_status} style={inputStyle}><option value="eligible">Eligible</option><option value="partially_eligible">Partially eligible</option><option value="ineligible">Ineligible</option><option value="not_applicable">Not applicable</option></select></label>
                    <label style={labelStyle}>Eligible GST (₹)<input name="eligibleAmount" type="number" min="0" step="0.01" defaultValue={line.input_tax_eligible_amount} style={inputStyle}/></label>
                    <span style={{fontSize:10,color:'#68758b'}}>GST total: {money(Number(line.cgst_amount)+Number(line.sgst_amount)+Number(line.igst_amount)+Number(line.cess_amount))}</span>
                    <label style={labelStyle}>Adviser note / reference<input name="note" required minLength={3} maxLength={1000} style={inputStyle} defaultValue={line.input_tax_review_note||''} placeholder="Who confirmed this treatment?"/></label>
                    <button className="add-store" type="submit">Save review</button>
                  </form>}
                </div>)}
                {expense.entry_status==='active'&&<details style={{borderTop:'1px solid #e5e9f0',paddingTop:10}}>
                  <summary style={{cursor:'pointer',fontSize:12,color:'#a63d36',display:'flex',alignItems:'center',gap:6}}><XCircle size={15}/>Void this entry</summary>
                  <form action={voidBusinessExpense} style={{display:'flex',gap:8,marginTop:8}}>
                    <input type="hidden" name="expenseId" value={expense.id}/><input name="reason" required minLength={5} placeholder="Reason for voiding this invoice" style={{...inputStyle,marginTop:0}}/><button type="submit" className="add-store">Void</button>
                  </form>
                </details>}
                <small style={{display:'flex',gap:6,alignItems:'center',color:'#68758b'}}><ShieldCheck size={14}/>{events.length} audit events retained for this entry.</small>
              </div>
            </details>;
          })}
        </div>}
      </section>
      <p style={{display:'flex',gap:7,alignItems:'center',fontSize:11,color:'#68758b',marginTop:14}}><ShieldCheck size={15}/>Only active Owner/Admin accounts with MFA can access expense values and private invoice files.</p>
    </main>
  </section></main>;
}
