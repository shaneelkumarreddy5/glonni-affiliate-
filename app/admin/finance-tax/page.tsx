import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminSidebar } from '@/components/admin-sidebar';
import { createClient } from '@/lib/supabase/server';
import { AlertTriangle, ArrowRight, Building2, FileClock, FileText, Plus, ReceiptText, ShieldCheck } from 'lucide-react';
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
    <main className="admin-content finance-tax-page">
      <header className="finance-tax-header">
        <div className="admin-title">
          <div><p>OPERATIONS · FINANCE</p><h1>Finance &amp; Tax setup</h1><span>Store business details and tax classifications supplied or confirmed by your tax adviser.</span></div>
          <div className="finance-tax-quick-links" aria-label="Finance destinations">
            <Link href="/admin/finance-tax/expenses"><ReceiptText size={15}/>Business expenses</Link>
            <Link href="/admin/finance-tax/providers"><FileText size={15}/>Provider documents</Link>
            <Link href="/admin/finance-tax/reports"><FileClock size={15}/>Quarterly reports</Link>
            <Link href="/admin/finance-tax/transactions"><ReceiptText size={15}/>Transaction ledger</Link>
          </div>
        </div>
      </header>
      {notice&&<p role="status" className="finance-tax-status">{notice}</p>}
      {error&&<p role="alert" className="finance-tax-error">Tax configuration tables are not available yet. Apply the Step 2 database migration.</p>}
      <section className="finance-tax-notice">
        <AlertTriangle size={18}/><span><b>Configuration only.</b> No rate is guessed or applied to transactions. Enter a rate only after your tax adviser confirms the treatment and effective date.</span>
      </section>

      <form action={saveTaxBusinessProfile} className="finance-tax-card">
        <header className="finance-tax-card-heading"><Building2 size={20}/><div><h2>Business tax profile</h2><p>Enter details exactly as registered.</p></div></header>
        <div className="finance-tax-fields">
          <label>Legal business name<input name="legalName" required maxLength={200} defaultValue={business?.legal_name??''} placeholder="As shown on PAN/GST records"/></label>
          <label>Trade name<input name="tradeName" maxLength={200} defaultValue={business?.trade_name??''} placeholder="Enter trade name"/></label>
          <label>PAN<input name="pan" maxLength={10} defaultValue={business?.pan??''} placeholder="Enter PAN"/></label>
          <label>GSTIN<input name="gstin" maxLength={15} defaultValue={business?.gstin??''} placeholder="Enter GSTIN"/></label>
          <label>GST registration status<select name="gstRegistrationStatus" defaultValue={business?.gst_registration_status??'unconfirmed'}><option value="unconfirmed">Not confirmed</option><option value="unregistered">Not registered</option><option value="regular">Regular registration</option><option value="composition">Composition</option><option value="other">Other / ask adviser</option></select></label>
          <label>Business contact email<input name="contactEmail" type="email" defaultValue={business?.contact_email??''} placeholder="name@business.com"/></label>
          <label className="finance-tax-wide">Registered address<textarea name="registeredAddress" rows={2} defaultValue={business?.registered_address??''} placeholder="Enter registered address"/></label>
          <label>State / Union Territory<input name="stateName" defaultValue={business?.state_name??''} placeholder="Select state"/></label>
          <label>State code<input name="stateCode" maxLength={2} defaultValue={business?.state_code??''} placeholder="Enter state code"/></label>
        </div>
        <footer className="finance-tax-form-footer"><span><i/>Profile details are stored securely</span><button className="finance-tax-primary" type="submit">Save profile</button></footer>
      </form>

      <form action={createTaxCodeVersion} className="finance-tax-card">
        <header className="finance-tax-card-heading"><Plus size={20}/><div><h2>Add tax code version</h2><p>Saved as a draft unless adviser review is recorded.</p></div></header>
        <div className="finance-tax-fields">
          <label>Tax code name<input name="displayName" required placeholder="e.g. Affiliate commission service"/></label>
          <label>Code key (optional)<input name="codeKey" placeholder="Generated from the name if blank"/></label>
          <label>Business area<select name="supplyArea">{Object.entries(areas).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
          <label>GST treatment<select name="gstTreatment"><option value="unclassified">Not classified</option><option value="taxable">Taxable</option><option value="exempt">Exempt</option><option value="nil_rated">Nil rated</option><option value="zero_rated">Zero rated</option><option value="outside_scope">Outside scope</option><option value="reverse_charge">Reverse charge</option><option value="other">Other / adviser guidance</option></select></label>
          <label>Rate (%)<input name="ratePercent" type="number" min="0" max="100" step="0.0001" placeholder="Leave blank until confirmed"/></label>
          <label>HSN / SAC<input name="hsnSac" maxLength={24} placeholder="Enter HSN / SAC"/></label>
          <label>Tax components<select name="taxComponentMode"><option value="not_set">Not confirmed</option><option value="cgst_sgst">CGST + SGST</option><option value="igst">IGST</option><option value="manual">Manual / adviser guidance</option></select></label>
          <label>Effective from<input name="effectiveFrom" type="date"/></label>
          <label>Effective to (optional)<input name="effectiveTo" type="date"/></label>
          <label>Code status<select name="status"><option value="draft">Draft (not applied)</option><option value="approved">Mark reviewed by tax adviser</option></select></label>
          <label>Adviser name (required to mark reviewed)<input name="adviserName" maxLength={160} placeholder="Enter adviser name"/></label>
          <label className="finance-tax-wide">Adviser reference / note (required to mark reviewed)<textarea name="approvalReference" rows={2} maxLength={1000} placeholder="Record who confirmed the classification and the supporting reference."/></label>
        </div>
        <footer className="finance-tax-form-footer"><span><ShieldCheck size={14}/>Approved codes require adviser details</span><button className="finance-tax-primary" type="submit"><Plus size={16}/>Add tax code</button></footer>
      </form>

      <section className="finance-tax-panel finance-tax-register">
        <header className="finance-tax-panel-heading"><div><FileText size={18}/><h2>Tax code register</h2></div><span>{codes?.length??0} versions</span></header>
        {codes?.length?<div className="finance-tax-table-wrap"><table><thead><tr><th>CODE / VERSION</th><th>BUSINESS AREA</th><th>TREATMENT</th><th>RATE</th><th>EFFECTIVE</th><th>STATUS</th></tr></thead><tbody>{codes.map((code:any)=><tr key={code.id}><td><b>{code.display_name}</b><small>{code.code_key} · v{code.version} · {code.hsn_sac||'HSN/SAC not set'}</small></td><td>{areas[code.supply_area]??labels(code.supply_area)}</td><td>{labels(code.gst_treatment)}</td><td>{code.rate_percent===null?'—':`${code.rate_percent}%`}</td><td>{code.effective_from??'Not set'}{code.effective_to? ` to ${code.effective_to}`:''}</td><td><span className={`finance-tax-code-status ${code.status}`}>{labels(code.status)}</span></td></tr>)}</tbody></table></div>:<p className="finance-tax-empty">No tax codes yet. Add adviser-confirmed code records here; no default rates have been inserted.</p>}
      </section>

      <section className="finance-tax-panel finance-tax-history">
        <header className="finance-tax-panel-heading"><div><FileClock size={18}/><h2>Recent configuration history</h2></div></header>
        {audit?.length?<ul>{audit.map(item=><li key={item.id}><span>{item.event_type.replaceAll('_',' ')}</span><b>{labels(item.record_type)}</b><time>{new Date(item.created_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}</time></li>)}</ul>:<p className="finance-tax-empty">Changes are recorded automatically once configuration is saved.</p>}
        <small className="finance-tax-audit-note"><ShieldCheck size={14}/>Changes are append-audited. Approved codes are retained as separate versions.</small>
      </section>

      <section className="finance-tax-records">
        <header><div><h2>Finance records</h2><p>Open related finance and compliance workspaces.</p></div></header>
        <div className="finance-tax-record-grid">
          <Link href="/admin/finance-tax/expenses"><ReceiptText/><span><b>Business expenses</b><small>Manage business expenses and receipts.</small></span><ArrowRight/></Link>
          <Link href="/admin/finance-tax/providers"><FileText/><span><b>Provider documents</b><small>Store provider statements and tax invoices.</small></span><ArrowRight/></Link>
          <Link href="/admin/finance-tax/reports"><FileClock/><span><b>Quarterly reports</b><small>Prepare and view finance reports.</small></span><ArrowRight/></Link>
          <Link href="/admin/finance-tax/transactions"><ReceiptText/><span><b>Transaction ledger</b><small>Open source-linked transaction records.</small></span><ArrowRight/></Link>
        </div>
      </section>
    </main>
  </section></main>;
}
