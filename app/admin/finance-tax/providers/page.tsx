import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminSidebar } from '@/components/admin-sidebar';
import { createClient } from '@/lib/supabase/server';
import { AlertTriangle,ArrowLeft,FileSpreadsheet,FileText,ReceiptText,ShieldCheck,Unlink2,XCircle } from 'lucide-react';
import {
  createFinanceProviderDocument,openFinanceProviderDocumentFile,recordFinanceProviderMatch,voidFinanceProviderDocument,
} from './actions';
import { ProviderDocumentUploader } from '@/components/provider-document-uploader';

export const dynamic='force-dynamic';
type Search={notice?:string;open?:string};
const providerTypes:Record<string,string>={
  affiliate_network:'Affiliate network',brand:'Brand / merchant',voucher_bill_provider:'Voucher / bill provider',
  payment_gateway:'Payment gateway',payout_provider:'Payout provider',other:'Other provider',
};
const kinds:Record<string,string>={
  affiliate_statement:'Affiliate statement',supplier_tax_invoice:'Supplier tax invoice',sales_tax_invoice:'Sales tax invoice',
  payment_settlement:'Payment settlement',payout_statement:'Payout statement',other:'Other document',
};
const labels=(v:string)=>v.replaceAll('_',' ');
const money=(v:number|string|null)=>v===null||v===undefined?'—':
  new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(Number(v));

export default async function ProviderDocumentsPage({searchParams}:{searchParams:Promise<Search>}) {
  const query=await searchParams;
  const supabase=await createClient();
  const [{data:{user}},{data:assurance}]=await Promise.all([supabase.auth.getUser(),supabase.auth.mfa.getAuthenticatorAssuranceLevel()]);
  if(!user)redirect('/admin/login?next=/admin/finance-tax/providers');
  const [{data:profile},{data:employee}]=await Promise.all([
    supabase.from('profiles').select('role').eq('id',user.id).maybeSingle(),
    supabase.from('employees').select('status').eq('profile_id',user.id).maybeSingle(),
  ]);
  if(assurance?.currentLevel!=='aal2'||!profile||!['owner','admin'].includes(profile.role)||employee?.status!=='active')
    redirect('/admin/login?next=/admin/finance-tax/providers');

  const [
    {data:documents,error},
    {data:affiliates},{data:merchants},{data:paymentProviders},
    {data:conversions},{data:orders},{data:payouts},
  ]=await Promise.all([
    supabase.from('finance_provider_documents').select('*').order('created_at',{ascending:false}).limit(300),
    supabase.from('affiliate_providers').select('id,name,adapter_key').order('name'),
    supabase.from('merchants').select('id,name,slug').order('name').limit(300),
    supabase.from('payment_provider_configs').select('id,name,provider_key').order('priority').order('name'),
    supabase.from('referral_conversions').select('id,provider_id,merchant_id,provider_order_reference,occurred_at,commission_amount,currency').order('occurred_at',{ascending:false}).limit(200),
    supabase.from('commerce_finance_orders').select('id,order_reference,provider_order_reference,fulfilment_provider_key,payment_provider_key,amount,currency,order_kind,payment_status').order('created_at',{ascending:false}).limit(200),
    supabase.from('payout_items').select('id,provider_payout_reference,amount,currency,status,created_at').order('created_at',{ascending:false}).limit(200),
  ]);
  const ids=(documents??[]).map(x=>x.id);
  let matches:any[]=[];let audit:any[]=[];let childError:any=null;
  if(ids.length) {
    const [matchResult,auditResult]=await Promise.all([
      supabase.from('finance_provider_document_matches').select('*').in('document_id',ids).order('created_at',{ascending:false}),
      supabase.from('finance_provider_document_audit').select('document_id,created_at').in('document_id',ids).order('created_at',{ascending:false}).limit(150),
    ]);
    matches=matchResult.data??[];childError=matchResult.error;audit=auditResult.data??[];
  }
  const matchesByDocument=new Map<string,any[]>();
  for(const row of matches)matchesByDocument.set(row.document_id,[...(matchesByDocument.get(row.document_id)??[]),row]);
  const auditCounts=new Map<string,number>();
  for(const row of audit)auditCounts.set(row.document_id,(auditCounts.get(row.document_id)??0)+1);
  const affiliateNames=new Map<string,string>((affiliates??[]).map(x=>[x.id,x.name] as [string,string]));
  const merchantNames=new Map<string,string>((merchants??[]).map(x=>[x.id,x.name] as [string,string]));
  const notices:Record<string,string>={
    document_saved:'Provider document saved. Attach its source file and reconcile listed amounts.',
    match_saved:'Reconciliation line saved with a system amount snapshot and variance.',
    document_voided:'Provider document voided; audit history is retained.',
    invalid_document:'Check provider, dates, GSTIN and ensure the document total equals taxable value, GST, charges and rounding.',
    create_failed:'Provider document could not be saved. Check the linked provider and entered amounts.',
    invalid_match:'Choose a source or manual entry, enter the reported amount and add a short match note.',
    match_failed:'That source could not be matched to this provider document. Confirm provider ownership and avoid duplicate source matches.',
    document_missing:'No file is attached to this provider document.',
    document_unavailable:'The private provider document could not be opened.',
    invalid_void:'Enter a reason of at least five characters.',
    void_failed:'This provider document could not be voided.',
  };
  const notice=query.notice?notices[query.notice]:null;
  const fieldStyle={width:'100%',boxSizing:'border-box' as const,padding:'9px 10px',border:'1px solid #d7deea',borderRadius:7,marginTop:5,fontSize:12};
  const labelStyle={display:'block',fontSize:11,fontWeight:600,color:'#46546a'};
  const conversionOptions=(conversions??[]).map(c=>({
    value:`affiliate_conversion:${c.id}`,
    label:`${affiliateNames.get(c.provider_id)||'Affiliate'} · ${c.provider_order_reference||c.id.slice(0,8)} · commission ${money(c.commission_amount)} · ${c.occurred_at?new Date(c.occurred_at).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata'}):'date n/a'}`,
  }));
  const orderOptions=(orders??[]).map(o=>({
    value:`commerce_order:${o.id}`,
    label:`${o.order_reference} · ${labels(o.order_kind)} · ${money(o.amount)} · ${o.payment_status}`,
  }));
  const payoutOptions=(payouts??[]).map(p=>({
    value:`payout_item:${p.id}`,
    label:`${p.provider_payout_reference||p.id.slice(0,8)} · ${money(p.amount)} · ${p.status}`,
  }));

  return <main className="admin-v2"><AdminSidebar/><section className="admin-main">
    <header className="admin-top"><ReceiptText size={21}/><b>Finance &amp; Tax · Provider documents</b><span className="dashboard-date">Statements · invoices · reconciliation</span><span className="avatar">SR</span></header>
    <main className="admin-content">
      <div className="admin-title"><div><p>FINANCE · PROVIDER EVIDENCE</p><h1>Provider documents &amp; reconciliation</h1><span>Register provider statements and tax invoices, then match reported amounts to Glonni source records.</span></div><Link href="/admin/finance-tax" className="add-store"><ArrowLeft size={15} style={{verticalAlign:'middle',marginRight:6}}/>Finance &amp; Tax</Link></div>
      {notice&&<p role="status" style={{background:'#eef8f0',border:'1px solid #cfe8d5',padding:12,borderRadius:8,fontSize:12,color:'#24733c'}}>{notice}</p>}
      {(error||childError)&&<p role="alert" style={{background:'#fff4e5',padding:12,borderRadius:8,fontSize:12}}>Provider document tables are unavailable. Check the Step 5 migration.</p>}
      <section style={{display:'flex',gap:10,alignItems:'flex-start',padding:13,margin:'16px 0',border:'1px solid #f2d28c',borderRadius:9,background:'#fff9e9',color:'#73520a',fontSize:12,lineHeight:1.55}}>
        <AlertTriangle size={18}/><span><b>Reconciliation evidence, not a tax filing.</b> Amounts and GST are copied from the document. Matched lines compare the provider amount with a snapshot from the linked source record. Gateway fees and provider APIs are not inferred where Glonni has no matching source data.</span>
      </section>
      <details open style={{background:'#fff',border:'1px solid #e5e9f0',borderRadius:10,padding:16}}>
        <summary style={{cursor:'pointer',fontWeight:700,display:'flex',alignItems:'center',gap:8}}><FileText size={17}/>Register a provider statement or tax document</summary>
        <form action={createFinanceProviderDocument} style={{display:'grid',gap:12,marginTop:14}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:10}}>
            <label style={labelStyle}>Provider type<select name="providerType" required style={fieldStyle}>{Object.entries(providerTypes).map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label>
            <label style={labelStyle}>Provider / counterparty name<input name="providerName" required maxLength={200} style={fieldStyle}/></label>
            <label style={labelStyle}>Provider key (optional)<input name="providerKey" maxLength={120} style={fieldStyle} placeholder="e.g. adapter or settlement key"/></label>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:10}}>
            <label style={labelStyle}>Affiliate network link<select name="affiliateProviderId" style={fieldStyle}><option value="">Not linked</option>{(affiliates??[]).map(x=><option key={x.id} value={x.id}>{x.name} · {x.adapter_key}</option>)}</select></label>
            <label style={labelStyle}>Brand / merchant link<select name="merchantId" style={fieldStyle}><option value="">Not linked</option>{(merchants??[]).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
            <label style={labelStyle}>Payment gateway link<select name="paymentProviderId" style={fieldStyle}><option value="">Not linked</option>{(paymentProviders??[]).map(x=><option key={x.id} value={x.id}>{x.name} · {x.provider_key}</option>)}</select></label>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:10}}>
            <label style={labelStyle}>Document kind<select name="documentKind" style={fieldStyle}>{Object.entries(kinds).map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label>
            <label style={labelStyle}>Document flow<select name="documentFlow" style={fieldStyle}><option value="inward">Received from provider</option><option value="outward">Issued to provider</option><option value="settlement">Settlement statement</option></select></label>
            <label style={labelStyle}>Counterparty GSTIN<input name="counterpartyGstin" maxLength={15} style={fieldStyle}/></label>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:10}}>
            <label style={labelStyle}>Period from<input name="periodStart" type="date" style={fieldStyle}/></label>
            <label style={labelStyle}>Period to<input name="periodEnd" type="date" style={fieldStyle}/></label>
            <label style={labelStyle}>Invoice / statement number<input name="invoiceNumber" maxLength={120} style={fieldStyle}/></label>
            <label style={labelStyle}>Document date<input name="invoiceDate" type="date" style={fieldStyle}/></label>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:10}}>
            {[
              ['taxableValue','Taxable value (₹)'],['cgstAmount','CGST (₹)'],['sgstAmount','SGST (₹)'],['igstAmount','IGST (₹)'],
              ['cessAmount','Cess (₹)'],['otherCharges','Other charges (₹)'],['roundOff','Round off (₹)'],['documentTotal','Document total (₹)'],
            ].map(([name,label])=><label key={name} style={labelStyle}>{label}<input name={name} type="number" step="0.01" min={name==='roundOff'?'-100':'0'} max={name==='roundOff'?'100':undefined} defaultValue={name==='roundOff'?'0':undefined} required style={fieldStyle}/></label>)}
          </div>
          <label style={labelStyle}>Notes / adviser reference<textarea name="notes" maxLength={2000} rows={2} style={fieldStyle}/></label>
          <button className="add-store" type="submit">Save provider document</button>
        </form>
      </details>

      <section style={{background:'#fff',border:'1px solid #e5e9f0',borderRadius:10,marginTop:18,overflow:'hidden'}}>
        <header style={{display:'flex',alignItems:'center',gap:8,padding:15,borderBottom:'1px solid #e5e9f0'}}><FileSpreadsheet size={17}/><h2 style={{fontSize:15,margin:0}}>Provider document register</h2><span style={{marginLeft:'auto',fontSize:11,color:'#68758b'}}>{documents?.length??0} records · latest 300</span></header>
        {!documents?.length?<p style={{padding:18,fontSize:12,color:'#68758b'}}>No provider tax documents or statements have been registered yet.</p>:<div style={{display:'grid',gap:12,padding:12}}>
          {documents.map((doc:any)=>{
            const rows=matchesByDocument.get(doc.id)??[];
            const expanded=query.open===doc.id;
            const variance=rows.reduce((sum,row)=>sum+Number(row.variance_amount??0),0);
            return <details key={doc.id} open={expanded} style={{border:'1px solid #e5e9f0',borderRadius:9,padding:13}}>
              <summary style={{cursor:'pointer',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                <b>{doc.provider_name}</b><span style={{fontSize:11,color:'#68758b'}}>{doc.invoice_number||doc.document_reference} · {providerTypes[doc.provider_type]??labels(doc.provider_type)} · {kinds[doc.document_kind]??labels(doc.document_kind)} · {doc.invoice_date||'date not set'}</span>
                <b style={{marginLeft:'auto'}}>{money(doc.document_total)}</b><span style={{fontSize:10,padding:'4px 7px',borderRadius:10,background:doc.entry_status==='active'?'#eaf6ed':'#fbeceb',color:doc.entry_status==='active'?'#277247':'#a63d36'}}>{labels(doc.entry_status)}</span>
              </summary>
              <div style={{display:'grid',gap:12,marginTop:13}}>
                <div style={{fontSize:12,color:'#536078'}}><b>Period:</b> {doc.period_start||'—'} to {doc.period_end||'—'} · <b>Flow:</b> {labels(doc.document_flow)} · <b>GSTIN:</b> {doc.counterparty_gstin||'not supplied'}<br/><b>Tax values:</b> Base {money(doc.taxable_value)} · CGST {money(doc.cgst_amount)} · SGST {money(doc.sgst_amount)} · IGST {money(doc.igst_amount)} · cess {money(doc.cess_amount)} · charges {money(doc.other_charges)} · round {money(doc.round_off)}<br/><b>Provider links:</b> {doc.affiliate_provider_id?affiliateNames.get(doc.affiliate_provider_id):null}{doc.merchant_id?merchantNames.get(doc.merchant_id):null}{doc.payment_provider_id?(paymentProviders??[]).find(p=>p.id===doc.payment_provider_id)?.name:null}{doc.provider_key?' · '+doc.provider_key:''}{doc.notes?' · '+doc.notes:''}</div>
                <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
                  <form action={openFinanceProviderDocumentFile}><input type="hidden" name="documentId" value={doc.id}/><button className="add-store" disabled={!doc.document_path} type="submit">{doc.document_path?'Open private file':'No source file'}</button></form>
                  {doc.entry_status==='active'&&<ProviderDocumentUploader documentId={doc.id} fileName={doc.document_file_name}/>}
                </div>
                <section style={{border:'1px solid #edf0f5',borderRadius:8,padding:12}}>
                  <header style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><b>Statement / transaction matches</b><span style={{fontSize:11,color:'#68758b'}}>{rows.length} lines · variance total {money(variance)}</span></header>
                  {rows.length?<div style={{overflowX:'auto',marginTop:9}}><table><thead><tr><th>TYPE</th><th>PROVIDER REFERENCE</th><th>REPORTED</th><th>SYSTEM SNAPSHOT</th><th>VARIANCE</th><th>STATUS</th><th>NOTE</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{labels(row.source_type)}</td><td>{row.source_reference||row.source_id?.slice(0,8)||'Manual'}</td><td>{money(row.provider_reported_amount)}</td><td>{money(row.system_amount)}</td><td>{money(row.variance_amount)}</td><td>{labels(row.match_status)}</td><td>{row.match_note}</td></tr>)}</tbody></table></div>:<p style={{fontSize:11,color:'#68758b',margin:'9px 0'}}>No matched lines yet.</p>}
                  {doc.entry_status==='active'&&<form action={recordFinanceProviderMatch} style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 2fr auto',gap:8,alignItems:'end',marginTop:12}}>
                    <input type="hidden" name="documentId" value={doc.id}/>
                    <label style={labelStyle}>Link source record<select name="sourceSelection" style={fieldStyle}><option value="manual">Manual / no source record</option>
                      {conversionOptions.length>0&&<optgroup label="Affiliate conversions">{conversionOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>}
                      {orderOptions.length>0&&<optgroup label="Voucher / bill orders">{orderOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>}
                      {payoutOptions.length>0&&<optgroup label="Payout items">{payoutOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>}
                    </select></label>
                    <label style={labelStyle}>Provider reference<input name="sourceReference" maxLength={160} style={fieldStyle}/></label>
                    <label style={labelStyle}>Reported amount (₹)<input name="reportedAmount" type="number" min="0" step="0.01" required style={fieldStyle}/></label>
                    <label style={labelStyle}>Match note<input name="matchNote" required minLength={3} maxLength={1000} style={fieldStyle} placeholder="Source reference / reason"/></label>
                    <button className="add-store" type="submit">Add match</button>
                  </form>}
                </section>
                {doc.entry_status==='active'&&<details style={{borderTop:'1px solid #e5e9f0',paddingTop:10}}>
                  <summary style={{cursor:'pointer',fontSize:12,color:'#a63d36',display:'flex',alignItems:'center',gap:6}}><XCircle size={15}/>Void this provider document</summary>
                  <form action={voidFinanceProviderDocument} style={{display:'flex',gap:8,marginTop:8}}><input type="hidden" name="documentId" value={doc.id}/><input name="reason" minLength={5} required placeholder="Reason for voiding" style={{...fieldStyle,marginTop:0}}/><button type="submit" className="add-store">Void</button></form>
                </details>}
                <small style={{display:'flex',gap:6,alignItems:'center',color:'#68758b'}}><ShieldCheck size={14}/>{auditCounts.get(doc.id)??0} audit events retained · file access restricted to finance admins.</small>
              </div>
            </details>;
          })}
        </div>}
      </section>
      <p style={{display:'flex',gap:7,alignItems:'center',fontSize:11,color:'#68758b',marginTop:14}}><Unlink2 size={15}/>Source lists show latest 200 records; each link snapshots the current system amount for later variance review.</p>
    </main>
  </section></main>;
}
