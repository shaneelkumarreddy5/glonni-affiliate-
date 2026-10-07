import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AdminSidebar } from '@/components/admin-sidebar';
import { createClient } from '@/lib/supabase/server';
import { ArrowLeft, CircleAlert, Database, FileText, ReceiptText, ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

type LedgerRow = {
  source_type: string;
  source_id: string;
  related_source_id: string | null;
  occurred_at: string;
  profile_id: string | null;
  merchant_id: string | null;
  affiliate_provider_id: string | null;
  source_reference: string | null;
  source_status: string;
  currency: string | null;
  order_value: number | string | null;
  commission_amount: number | string | null;
  cashback_amount: number | string | null;
  source_amount: number | string | null;
};

const titles: Record<string,string> = {
  affiliate_conversion:'Affiliate conversion',
  cashback_award:'Cashback award',
  wallet_entry:'Wallet entry',
  withdrawal_request:'Withdrawal request',
  payout_batch:'Payout batch',
  payout_item:'Payout item',
  payout_event:'Payout event',
  voucher_bill_order:'Voucher / bill order',
};
const money=(value:number|string|null,currency:string|null='INR')=>{if(value===null||value===undefined)return '—';const unit=(currency||'INR').toUpperCase();return new Intl.NumberFormat('en-IN',{style:'currency',currency:/^[A-Z]{3}$/.test(unit)?unit:'INR',maximumFractionDigits:2}).format(Number(value));};
const shortId=(id:string|null)=>id?id.slice(0,8)+'…':'—';

export default async function FinanceTaxTransactionsPage() {
  const supabase=await createClient();
  const [{data:{user}},{data:assurance}]=await Promise.all([
    supabase.auth.getUser(),supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if(!user) redirect('/admin/login?next=/admin/finance-tax/transactions');
  const [{data:profile},{data:employee}]=await Promise.all([
    supabase.from('profiles').select('role').eq('id',user.id).maybeSingle(),
    supabase.from('employees').select('status').eq('profile_id',user.id).maybeSingle(),
  ]);
  if(assurance?.currentLevel!=='aal2'||!profile||!['owner','admin'].includes(profile.role)||employee?.status!=='active') {
    redirect('/admin/login?next=/admin/finance-tax/transactions');
  }
  const {data,error,count}=await supabase.from('finance_tax_source_ledger').select('*',{count:'exact'}).order('occurred_at',{ascending:false}).limit(250);
  const rows=(data??[]) as LedgerRow[];
  const typeCounts=new Map<string,number>();
  for(const row of rows) typeCounts.set(row.source_type,(typeCounts.get(row.source_type)??0)+1);

  return <main className="admin-v2"><AdminSidebar/><section className="admin-main">
    <header className="admin-top"><ReceiptText size={21}/><b>Finance &amp; Tax · Transactions</b><span className="dashboard-date">Live source records</span><span className="avatar">SR</span></header>
    <main className="admin-content">
      <div className="admin-title"><div><p>FINANCE · SOURCE LINKS</p><h1>Transaction ledger</h1><span>Read-only records linked directly to Glonni’s operational tables.</span></div><Link href="/admin/finance-tax" className="add-store"><ArrowLeft size={15} style={{verticalAlign:'middle',marginRight:6}}/>Back to setup</Link></div>
      <section style={{display:'flex',gap:10,alignItems:'flex-start',padding:14,marginTop:18,border:'1px solid #f2d28c',borderRadius:9,background:'#fff9e9',color:'#73520a',fontSize:12,lineHeight:1.6}}>
        <CircleAlert size={18}/><span><b>Source records, not tax totals.</b> Each row is a different lifecycle record. For example, a conversion, cashback award, wallet entry and payout can all refer to the same customer journey. Do not add these rows together. GST treatment is not calculated here.</span>
      </section>
      <section style={{display:'flex',gap:12,alignItems:'center',padding:14,marginTop:12,border:'1px solid #dbe4f2',borderRadius:9,background:'#fff',fontSize:12,color:'#536078'}}>
        <Database size={18}/><span>Source data may include test or simulator events. Reconcile and exclude test records before preparing auditor or filing reports.</span><b style={{marginLeft:'auto',whiteSpace:'nowrap'}}>{count??rows.length} records · latest 250 shown</b>
      </section>
      {error&&<p role="alert" style={{padding:12,background:'#fff3ef',borderRadius:8,fontSize:12,color:'#9b3022'}}>Could not read the source ledger. Check the Step 3 database migration and admin access.</p>}
      {!error&&rows.length===0&&<section style={{display:'grid',placeItems:'center',gap:8,padding:40,marginTop:16,background:'#fff',border:'1px solid #e5e9f0',borderRadius:10,textAlign:'center'}}>
        <Database size={26} color="#7b8799"/><b>No transaction source records yet</b><span style={{fontSize:12,color:'#68758b'}}>The live source tables returned no records. This is an empty ledger, not a zero-tax calculation.</span>
      </section>}
      {rows.length>0&&<section style={{background:'#fff',border:'1px solid #e5e9f0',borderRadius:10,marginTop:16,overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}><table><thead><tr><th>DATE</th><th>RECORD TYPE</th><th>SOURCE / RELATED ID</th><th>REFERENCE</th><th>CUSTOMER ID</th><th>ORDER VALUE</th><th>COMMISSION</th><th>CASHBACK</th><th>RECORD AMOUNT</th><th>STATUS</th></tr></thead><tbody>
        {rows.map((row)=><tr key={row.source_type+row.source_id}>
          <td>{row.occurred_at?new Date(row.occurred_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}):'—'}</td>
          <td><b>{titles[row.source_type]??row.source_type}</b></td>
          <td><code>{shortId(row.source_id)}</code>{row.related_source_id&&<small style={{display:'block',color:'#68758b'}}>related {shortId(row.related_source_id)}</small>}</td>
          <td>{row.source_reference??'—'}</td>
          <td>{shortId(row.profile_id)}</td>
          <td>{money(row.order_value,row.currency)}</td><td>{money(row.commission_amount,row.currency)}</td>
          <td>{money(row.cashback_amount,row.currency)}</td><td>{money(row.source_amount,row.currency)}</td>
          <td>{row.source_status.replaceAll('_',' ')}</td>
        </tr>)}
        </tbody></table></div>
      </section>}
      <section style={{display:'flex',gap:8,alignItems:'center',marginTop:14,fontSize:11,color:'#68758b'}}><ShieldCheck size={15}/>This ledger reads source records live. It does not copy or alter affiliate, cashback, wallet or payout rows.</section>
      <section style={{background:'#fff',border:'1px solid #e5e9f0',borderRadius:10,padding:16,marginTop:14}}>
        <h2 style={{fontSize:15,display:'flex',gap:8,alignItems:'center'}}><FileText size={17}/>Voucher and bill payment orders</h2>
        <p style={{fontSize:12,color:'#68758b',lineHeight:1.6,marginBottom:0}}>Order-level records now have a secure schema and audit trail. Glonni’s current voucher page is a catalogue, and no checkout/provider callback currently populates orders automatically. The order rows will appear here after the payment integration is connected.</p>
      </section>
    </main>
  </section></main>;
}
