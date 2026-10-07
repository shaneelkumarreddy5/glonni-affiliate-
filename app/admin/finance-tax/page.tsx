import { AdminSidebar } from '@/components/admin-sidebar';
import { AlertTriangle, ArrowRight, FileText, LockKeyhole, ReceiptText, Upload, WalletCards } from 'lucide-react';

export const dynamic = 'force-dynamic';

const plannedSections = [
  { title: 'Income & transactions', description: 'Affiliate commissions, voucher and bill-payment orders, cashback, refunds, and provider settlements.', icon: WalletCards },
  { title: 'Invoices & expenses', description: 'Supplier bills, website expenses, uploaded invoice files, and review status.', icon: Upload },
  { title: 'Tax codes & reports', description: 'CA-approved tax classifications, quarter reconciliation, and auditor exports.', icon: FileText },
];

export default async function FinanceTaxPage() {
  return <main className="admin-v2"><AdminSidebar/><section className="admin-main">
    <header className="admin-top"><ReceiptText size={21}/><b>Finance &amp; Tax</b><span className="dashboard-date">Admin · Finance records</span><span className="avatar">SR</span></header>
    <main className="admin-content">
      <div className="admin-title"><div><p>OPERATIONS · FINANCE</p><h1>Finance &amp; Tax</h1><span>Organize Glonni’s transaction records and supporting documents for review.</span></div></div>
      <section style={{display:'flex',gap:12,alignItems:'flex-start',padding:16,marginTop:20,border:'1px solid #f2d28c',borderRadius:10,background:'#fff9e9',color:'#73520a'}}>
        <AlertTriangle size={20} aria-hidden="true"/><div><b>Foundation step — reporting is not active yet</b><p style={{margin:'6px 0 0',fontSize:12,lineHeight:1.6}}>This page is a navigation and access-controlled starting point. It does not yet calculate GST, store invoices or produce tax returns. Existing admin data may include test/mock records; do not use it as a tax filing source.</p></div>
      </section>
      <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:14,marginTop:18}}>
        {plannedSections.map(({title,description,icon:Icon})=><article key={title} style={{background:'#fff',border:'1px solid #e5e9f0',borderRadius:10,padding:18}}>
          <Icon size={20} color="#315fc2" aria-hidden="true"/><h2 style={{fontSize:15,margin:'12px 0 6px'}}>{title}</h2><p style={{fontSize:12,color:'#60708b',lineHeight:1.6,margin:0}}>{description}</p><span style={{display:'inline-flex',gap:6,alignItems:'center',marginTop:14,fontSize:11,color:'#7b8799'}}>Planned for later steps <ArrowRight size={13}/></span>
        </article>)}
      </section>
      <section style={{display:'flex',gap:10,alignItems:'center',padding:15,marginTop:18,border:'1px solid #e5e9f0',borderRadius:10,background:'#fff',fontSize:12,color:'#536078'}}>
        <LockKeyhole size={18}/><span>Read-only in Step 1. Finance permissions and protected write actions will be added with the data and workflow steps.</span>
      </section>
    </main>
  </section></main>;
}
