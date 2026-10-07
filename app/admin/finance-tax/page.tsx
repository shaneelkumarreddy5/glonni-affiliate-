import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminSidebar } from '@/components/admin-sidebar';
import { createClient } from '@/lib/supabase/server';
import { AlertTriangle, BadgeCheck, Building2, FileClock, FileText, Plus, ReceiptText, ShieldCheck } from 'lucide-react';
import { createTaxCodeVersion, saveTaxBusinessProfile } from './actions';

export const dynamic = 'force-dynamic';

type Search = { notice?: string };
const areas: Record<string,string> = {
  affiliate_commission:'Affiliate commission', voucher_sale:'Voucher sale',
  bill_payment:'Bill payment', cashback:'Cashback', gateway_fee:'Gateway fee',
  operating_expense:'Operating expense', other:'Other',
};
const labels = (value:string) => value.replaceAll('_',' ');

export default async function FinanceTaxPage({searchParams}:{searchParams:Promise<Search>}) {
  const query=await searchParams;
  const supabase=await createClient();
  const [{data:{user}},{data:assurance}]=await Promise.all([
    supabase.auth.getUser(), supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if(!user) redirect('/admin/login?next=/admin/finance-tax');
  const [{data:profile},{data:employee}]=await Promise.all([
    supabase.from('profiles').select('role').eq('id',user.id).maybeSingle(),
    supabase.from('employees').select('status').eq('profile_id',user.id).maybeSingle(),
  ]);
  if(assurance?.currentLevel!=='aal2'||!profile||!['owner','admin'].includes(profile.role)||employee?.status!=='active') {
    redirect('/admin/login?next=/admin/finance-tax');
  }
  const [{data:business},{data:codes,error},{data:audit}]=await Promise.all([
    supabase.from('tax_business_profiles').select('*').eq('singleton_id',1).maybeSingle(),
    supabase.from('tax_code_versions').select('*').order('code_key').order('version',{ascending:false}),
    supabase.from('tax_configuration_audit').select('id,record_type,record_id,event_type,created_at').order('created_at',{ascending:false}).limit(8),
  ]);
  const notices:Record<string,string>={
    business_saved:'Business tax profile saved and recorded in the audit history.',
    tax_code_saved:'Tax code version saved. Draft codes do not apply to transactions.',
    invalid_business:'Enter a legal name and choose a GST registration status.',
    invalid_tax_code:'Check the tax code fields. Approved codes require a rate, effective date, adviser name and review reference.',
    business_failed:'Business details could not be saved. Check your connection and admin access.',
    tax_code_failed:'Tax code could not be saved. Please retry or check for duplicate data.',
  };
  const notice=query.notice?notices[query.notice]:null;

  return <main className="admin-v2"><AdminSidebar/><section className="admin-main">
    <header className="admin-top"><ReceiptText size={21}/><b>Finance &amp; Tax</b><span className="dashboard-date">Business setup · tax codes</span><span className="avatar">SR</span></header>
    <main className="admin-content">
      <div className="admin-title"><div><p>OPERATIONS · FINANCE</p><h1>Finance &amp; Tax setup</h1><span>Store business details and tax classifications supplied or confirmed by your tax adviser.</span></div></div>
      {notice&&<p role="status" style={{background:'#eef8f0',border:'1px solid #cfe8d5',padding:12,borderRadius:8,fontSize:12,color:'#24733c'}}>{notice}</p>}
      {(error)&&<p role="alert" style={{background:'#fff4e5',padding:12,borderRadius:8,fontSize:12}}>Tax configuration tables are not available yet. Apply the Step 2 database migration.</p>}
      <section style={{display:'flex',gap:11,alignItems:'flex-start',padding:14,margin:'18px 0',border:'1px solid #f2d28c',borderRadius:9,background:'#fff9e9',color:'#73520a',fontSize:12,lineHeight:1.6}}>
        <AlertTriangle size={19}/><span><b>Configuration only.</b> No rate is guessed or applied to transactions. Enter a rate only after your tax adviser confirms the treatment and effective date. The next steps will connect approved codes to transaction records.</span>
      </section>
      <Link href="/admin/finance-tax/transactions" style={{display:'flex',alignItems:'center',gap:10,padding:14,margin:'0 0 16px',border:'1px solid #dbe4f2',borderRadius:9,background:'#fff',fontSize:13,fontWeight:700,color:'#234b9a'}}><ReceiptText size={18}/>Open source-linked transaction ledger<span style={{marginLeft:'auto',fontSize:11,color:'#68758b'}}>Affiliate, cashback, wallet, payouts, voucher orders →</span></Link>
      <section style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(320px,1fr)',gap:16,alignItems:'start'}}>
        <form action={saveTaxBusinessProfile} style={{background:'#fff',border:'1px solid #e5e9f0',borderRadius:10,padding:18,display:'grid',gap:12}}>
          <div style={{display:'flex',gap:10,alignItems:'center'}}><Building2 size={19}/><div><h2 style={{margin:0,fontSize:16}}>Business tax profile</h2><small style={{color:'#68758b'}}>Enter details exactly as registered.</small></div></div>
          <label>Legal business name<input name="legalName" required maxLength={200} defaultValue={business?.legal_name??''} placeholder="As shown on PAN/GST records"/></label>
          <label>Trade name<input name="tradeName" maxLength={200} defaultValue={business?.trade_name??''}/></label>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><label>PAN<input name="pan" maxLength={10} defaultValue={business?.pan??''}/></label><label>GSTIN<input name="gstin" maxLength={15} defaultValue={business?.gstin??''}/></label></div>
          <label>GST registration status<select name="gstRegistrationStatus" defaultValue={business?.gst_registration_status??'unconfirmed'}><option value="unconfirmed">Not confirmed</option><option value="unregistered">Not registered</option><option value="regular">Regular registration</option><option value="composition">Composition</option><option value="other">Other / ask adviser</option></select></label>
          <label>Registered address<textarea name="registeredAddress" rows={2} defaultValue={business?.registered_address??''}/></label>
          <div style={{display:'grid',gridTemplateColumns:'1fr 120px',gap:10}}><label>State / Union Territory<input name="stateName" defaultValue={business?.state_name??''}/></label><label>State code<input name="stateCode" maxLength={2} defaultValue={business?.state_code??''}/></label></div>
          <label>Business contact email<input name="contactEmail" type="email" defaultValue={business?.contact_email??''}/></label>
          <button className="add-store" type="submit">Save business details</button>
        </form>
        <section style={{display:'grid',gap:16}}>
          <form action={createTaxCodeVersion} style={{background:'#fff',border:'1px solid #e5e9f0',borderRadius:10,padding:18,display:'grid',gap:11}}>
            <div style={{display:'flex',gap:10,alignItems:'center'}}><Plus size={19}/><div><h2 style={{margin:0,fontSize:16}}>Add tax code version</h2><small style={{color:'#68758b'}}>Saved as a draft unless adviser review is recorded.</small></div></div>
            <label>Tax code name<input name="displayName" required placeholder="e.g. Affiliate commission service"/></label>
            <label>Code key (optional)<input name="codeKey" placeholder="Generated from the name if blank"/></label>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><label>Business area<select name="supplyArea">{Object.entries(areas).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>GST treatment<select name="gstTreatment"><option value="unclassified">Not classified</option><option value="taxable">Taxable</option><option value="exempt">Exempt</option><option value="nil_rated">Nil rated</option><option value="zero_rated">Zero rated</option><option value="outside_scope">Outside scope</option><option value="reverse_charge">Reverse charge</option><option value="other">Other / adviser guidance</option></select></label></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><label>Rate (%)<input name="ratePercent" type="number" min="0" max="100" step="0.0001" placeholder="Leave blank until confirmed"/></label><label>HSN / SAC<input name="hsnSac" maxLength={24}/></label></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><label>Tax components<select name="taxComponentMode"><option value="not_set">Not confirmed</option><option value="cgst_sgst">CGST + SGST</option><option value="igst">IGST</option><option value="manual">Manual / adviser guidance</option></select></label><label>Effective from<input name="effectiveFrom" type="date"/></label></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><label>Effective to (optional)<input name="effectiveTo" type="date"/></label><label>Code status<select name="status"><option value="draft">Draft (not applied)</option><option value="approved">Mark reviewed by tax adviser</option></select></label></div>
            <label>Adviser name (required to mark reviewed)<input name="adviserName" maxLength={160}/></label>
            <label>Adviser reference / note (required to mark reviewed)<textarea name="approvalReference" rows={2} maxLength={1000} placeholder="Record who confirmed the classification and the supporting reference."/></label>
            <button className="add-store" type="submit">Save tax code</button>
          </form>
        </section>
      </section>
      <section style={{background:'#fff',border:'1px solid #e5e9f0',borderRadius:10,marginTop:18,overflow:'hidden'}}>
        <header style={{display:'flex',alignItems:'center',gap:9,padding:16,borderBottom:'1px solid #e5e9f0'}}><FileText size={18}/><h2 style={{fontSize:16,margin:0}}>Tax code register</h2><span style={{marginLeft:'auto',fontSize:11,color:'#68758b'}}>{codes?.length??0} versions</span></header>
        {codes?.length?<div style={{overflowX:'auto'}}><table><thead><tr><th>CODE / VERSION</th><th>BUSINESS AREA</th><th>TREATMENT</th><th>RATE</th><th>EFFECTIVE</th><th>STATUS</th></tr></thead><tbody>{codes.map((code:any)=><tr key={code.id}><td><b>{code.display_name}</b><small style={{display:'block',color:'#68758b'}}>{code.code_key} · v{code.version} · {code.hsn_sac||'HSN/SAC not set'}</small></td><td>{areas[code.supply_area]??labels(code.supply_area)}</td><td>{labels(code.gst_treatment)}</td><td>{code.rate_percent===null?'—':`${code.rate_percent}%`}</td><td>{code.effective_from??'Not set'}{code.effective_to? ` to ${code.effective_to}`:''}</td><td>{code.status}</td></tr>)}</tbody></table></div>:<p style={{padding:16,fontSize:12,color:'#68758b'}}>No tax codes yet. Add adviser-confirmed code records here; no default rates have been inserted.</p>}
      </section>
      <section style={{background:'#fff',border:'1px solid #e5e9f0',borderRadius:10,marginTop:16,padding:16}}>
        <h2 style={{fontSize:15,display:'flex',gap:8,alignItems:'center'}}><FileClock size={17}/>Recent configuration history</h2>
        {audit?.length?<ul style={{fontSize:11,color:'#536078',paddingLeft:18}}>{audit.map(item=><li key={item.id}>{item.event_type} · {item.record_type} · {new Date(item.created_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}</li>)}</ul>:<p style={{fontSize:12,color:'#68758b'}}>Changes are recorded automatically once configuration is saved.</p>}
        <small style={{display:'flex',gap:7,alignItems:'center',color:'#68758b'}}><ShieldCheck size={14}/>Changes are append-audited. Approved codes are retained as separate versions.</small>
      </section>
    </main>
  </section></main>;
}
