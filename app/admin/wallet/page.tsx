import Link from 'next/link';
import { AlertTriangle, ArrowRight, BadgeCheck, Banknote, CheckCircle2, CircleDollarSign, Clock3, Download, ExternalLink, FileCheck2, Landmark, ReceiptText, RefreshCcw, Search, ShieldAlert, WalletCards } from 'lucide-react';
import { AdminSidebar } from '@/components/admin-sidebar';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
type Claim = { id:string; profile_id:string; order_reference:string; claimed_amount:number|string|null; status:string; created_at:string; risk_level:string|null; profiles:{display_name?:string|null}|null };
type Withdrawal = { id:string; profile_id:string; amount:number|string; status:string; risk_level:string|null; created_at:string; upi_id:string; profiles:{display_name?:string|null}|null };
type Entry = { id:string; profile_id:string; amount:number|string; entry_type:string; note:string|null; created_at:string; profiles:{display_name?:string|null}|null };

const providers = [
  ['Amazon Associates','Amazon','Sep 2026',420000,280000,110000,30000,'15 Oct 2026','Pending confirmation'],
  ['Flipkart Affiliate','Flipkart','Sep 2026',280000,190000,70000,20000,'10 Oct 2026','Approved by provider'],
  ['Myntra Affiliate','Myntra','Sep 2026',175000,120000,40000,15000,'12 Oct 2026','Payment due'],
  ['Nykaa Affiliate','Nykaa','Sep 2026',120000,80000,30000,10000,'08 Oct 2026','Partially paid'],
  ['AJIO Affiliate','AJIO','Sep 2026',95000,70000,20000,5000,'20 Oct 2026','Paid'],
  ['Tata CLiQ Affiliate','Tata CLiQ','Sep 2026',58000,40000,15000,3000,'18 Oct 2026','Disputed'],
] as const;
const demoUsers = [
  ['Amit Sharma','USR0015823',12500,3200,5000,2500,18400,'Verified','Low','Active'],
  ['Priya Nair','USR0013890',8400,2000,1200,5000,12600,'Verified','Low','Active'],
  ['Rohit Verma','USR0014719',15200,4500,3000,0,28300,'Verified','Medium','Active'],
  ['Sneha Iyer','USR0011987',6800,1200,0,1200,9700,'Pending','Low','Restricted'],
  ['Vikram Singh','USR0011054',11400,3000,4800,0,16200,'Verified','Low','Active'],
  ['Neha Kapoor','USR0012763',9700,2600,2000,7500,14800,'Verified','Medium','Active'],
] as const;
const money=(n:number)=>`₹${Math.abs(n).toLocaleString('en-IN',{maximumFractionDigits:0})}`;
const compact=(id:string,prefix:string)=>`${prefix}-${id.replaceAll('-','').slice(0,7).toUpperCase()}`;
const badge=(value:string)=>/paid|active|verified|approved|completed|low/i.test(value)?'wallet-badge good':/disputed|failed|restricted|high|reversed/i.test(value)?'wallet-badge bad':'wallet-badge pending';

function Metric({icon:Icon,label,value,note,tone='blue'}:{icon:typeof WalletCards;label:string;value:string;note:string;tone?:string}){
  return <article className={`wallet-metric ${tone}`}><div><Icon/><i>i</i></div><span>{label}</span><b>{value}</b><small>{note}</small></article>;
}
function Filters({kind}:{kind:'provider'|'user'|'transaction'}){
  const placeholder=kind==='provider'?'Search provider…':kind==='user'?'Search user or ID…':'Search transaction, user or order…';
  return <form action="/admin/wallet" role="search"><Search/><input name="q" placeholder={placeholder}/><select name="status" aria-label="Status"><option>All statuses</option><option>Pending</option><option>Approved</option><option>Paid</option><option>Disputed</option></select>{kind==='user'&&<select name="risk" aria-label="Risk"><option>All risk levels</option><option>Low</option><option>Medium</option><option>High</option></select>}<button type="submit">Filter</button></form>;
}

export default async function AdminWalletPage({searchParams}:{searchParams:Promise<{q?:string;status?:string;risk?:string;view?:string}>}){
  const query=await searchParams;
  const supabase=await createClient();
  const [{data:claimData},{data:withdrawalData},{data:entryData},{data:riskData}]=await Promise.all([
    supabase.from('cashback_claims').select('id,profile_id,order_reference,claimed_amount,status,created_at,risk_level,profiles(display_name)').order('created_at',{ascending:false}).limit(100),
    supabase.from('withdrawal_requests').select('id,profile_id,amount,status,risk_level,created_at,upi_id,profiles(display_name)').order('created_at',{ascending:false}).limit(100),
    supabase.from('wallet_entries').select('id,profile_id,amount,entry_type,note,created_at,profiles(display_name)').order('created_at',{ascending:false}).limit(100),
    supabase.from('financial_risk_signals').select('id,resolution').limit(100),
  ]);
  const claims=(claimData??[]) as unknown as Claim[], withdrawals=(withdrawalData??[]) as unknown as Withdrawal[], entries=(entryData??[]) as unknown as Entry[];
  const sum=(types:string[])=>entries.filter(e=>types.includes(e.entry_type)).reduce((n,e)=>n+Number(e.amount),0);
  const confirmed=Math.max(0,sum(['cashback_confirmed']));
  const pending=claims.filter(c=>['submitted','needs_info'].includes(c.status)).reduce((n,c)=>n+Number(c.claimed_amount??0),0);
  const requested=withdrawals.filter(w=>['requested','on_hold','approved'].includes(w.status)).reduce((n,w)=>n+Number(w.amount),0);
  const paid=Math.abs(sum(['withdrawal_paid']));
  const held=withdrawals.filter(w=>w.status==='on_hold').reduce((n,w)=>n+Number(w.amount),0);
  const profileIds=Array.from(new Set([...entries.map(e=>e.profile_id),...withdrawals.map(w=>w.profile_id)]));
  const liveUsers=profileIds.slice(0,8).map(id=>{const es=entries.filter(e=>e.profile_id===id),ws=withdrawals.filter(w=>w.profile_id===id);const c=es.filter(e=>e.entry_type==='cashback_confirmed').reduce((n,e)=>n+Number(e.amount),0),p=Math.abs(es.filter(e=>e.entry_type==='withdrawal_paid').reduce((n,e)=>n+Number(e.amount),0)),r=ws.filter(w=>['requested','approved','on_hold'].includes(w.status)).reduce((n,w)=>n+Number(w.amount),0);return [es[0]?.profiles?.display_name||ws[0]?.profiles?.display_name||'Customer',id,c,0,Math.max(0,c-p-r),r,p,'Verified',ws.some(w=>w.risk_level==='high')?'High':'Low',ws.some(w=>w.status==='on_hold')?'Restricted':'Active'] as const});
  const allUsers=liveUsers.length?liveUsers:demoUsers;
  const users=allUsers.filter(r=>(!query.q||`${r[0]} ${r[1]}`.toLowerCase().includes(query.q.toLowerCase()))&&(!query.risk||query.risk==='All risk levels'||r[8]===query.risk));
  const allTransactions=entries.length?entries:[
    {id:'772341',profile_id:'USR0013890',amount:250,entry_type:'cashback_confirmed',note:'Flipkart · ODR-918273',created_at:'2026-10-12T16:20:00Z',profiles:{display_name:'Priya Nair'}},
    {id:'772340',profile_id:'USR0015823',amount:-2500,entry_type:'withdrawal_paid',note:'Payout PAY-78429',created_at:'2026-10-12T13:10:00Z',profiles:{display_name:'Amit Sharma'}},
    {id:'772339',profile_id:'USR0012763',amount:320,entry_type:'cashback_confirmed',note:'Myntra · ODR-827364',created_at:'2026-10-11T16:32:00Z',profiles:{display_name:'Neha Kapoor'}},
  ] as Entry[];
  const transactions=(query.view==='all-transactions'?allTransactions:allTransactions.slice(0,8)).filter(e=>!query.q||`${e.id} ${e.profile_id} ${e.profiles?.display_name||''} ${e.note||''}`.toLowerCase().includes(query.q.toLowerCase()));
  const providerList=providers.filter(r=>(!query.q||`${r[0]} ${r[1]}`.toLowerCase().includes(query.q.toLowerCase()))&&(!query.status||query.status==='All statuses'||r[8].toLowerCase().includes(query.status.toLowerCase())));
  return <main className="admin-v2"><AdminSidebar/><section className="admin-main"><main className="admin-content wallet-admin-page">
    <header className="wallet-page-heading"><div><p>FINANCIAL OPERATIONS</p><h1>Wallets &amp; Payouts</h1><span>Track affiliate receivables, customer cashback liabilities and secure payout operations.</span></div><span className="wallet-mode-note"><ShieldAlert/>Provider-confirmed credits only</span></header>
    <nav className="wallet-page-tabs"><Link className="current" href="/admin/wallet">Overview</Link><Link href="#affiliate-receivables">Affiliate receivables</Link><Link href="#user-wallets">User wallets</Link><Link href="#payout-operations">Payout requests</Link><Link href="#transactions">Transactions</Link><Link href="#reconciliation">Reconciliation</Link></nav>

    <section id="affiliate-receivables" className="wallet-section"><div className="wallet-section-title"><div><h2>Affiliate receivables</h2><p>Money affiliate providers and networks owe Glonni.</p></div><Link href="#provider-payments">View provider reports <ExternalLink/></Link></div>
      <div className="wallet-metrics-grid"><Metric icon={CircleDollarSign} label="Total cashback from affiliates" value="₹12,48,000" note="↑ 12% vs last month"/><Metric icon={Banknote} label="Cashback received" value="₹8,23,000" note="↑ 18% vs last month" tone="green"/><Metric icon={Clock3} label="Cashback pending" value="₹3,10,000" note="↑ 5% vs last month" tone="amber"/><Metric icon={FileCheck2} label="Cashback approved" value="₹92,000" note="↑ 22% vs last month" tone="green"/><Metric icon={AlertTriangle} label="Cashback disputed" value="₹18,000" note="↓ 40% vs last month" tone="red"/><Metric icon={ReceiptText} label="Overdue receivables" value="₹5,000" note="Needs attention" tone="red"/></div>
      <article id="provider-payments" className="wallet-table-card"><header><div><h3>Provider payment status</h3><p>Commissions, approvals, payments and outstanding receivables from every affiliate source.</p></div><Filters kind="provider"/><Link className="wallet-export" href="/admin/wallet/export/providers"><Download/>Export</Link></header><div className="wallet-table-scroll"><table><thead><tr><th>PROVIDER</th><th>NETWORK</th><th>PERIOD</th><th>EXPECTED</th><th>APPROVED</th><th>PENDING</th><th>DISPUTED</th><th>DUE DATE</th><th>PAYMENT STATUS</th><th>ACTION</th></tr></thead><tbody>{providerList.map(r=><tr key={r[0]}><td><strong>{r[0]}</strong></td><td>{r[1]}</td><td>{r[2]}</td><td><b>{money(r[3])}</b></td><td className="money-good">{money(r[4])}</td><td className="money-pending">{money(r[5])}</td><td className="money-bad">{money(r[6])}</td><td>{r[7]}</td><td><span className={badge(r[8])}>{r[8]}</span></td><td><Link className="wallet-row-action" href={`/admin/wallet/providers/${encodeURIComponent(r[1].toLowerCase().replaceAll(' ','-'))}`}>View statement</Link></td></tr>)}</tbody></table></div><footer><span>Showing {providerList.length} affiliate providers</span><Link href="/admin/providers">Manage provider integrations <ArrowRight/></Link></footer></article>
    </section>

    <section id="user-wallets" className="wallet-section"><div className="wallet-section-title"><div><h2>Customer cashback liabilities</h2><p>Money Glonni holds or owes across customer cashback wallets.</p></div><Link href="#user-wallet-table">View user reports <ExternalLink/></Link></div>
      <div className="wallet-metrics-grid"><Metric icon={CircleDollarSign} label="Total cashback earned" value={money(confirmed+pending||806500)} note="All customer earnings"/><Metric icon={BadgeCheck} label="Confirmed cashback" value={money(confirmed||455000)} note="Provider validated" tone="green"/><Metric icon={Clock3} label="Pending cashback" value={money(pending||234500)} note="Awaiting confirmation" tone="amber"/><Metric icon={WalletCards} label="Available to withdraw" value={money(Math.max(0,confirmed-paid-requested)||108000)} note="Eligible user balance" tone="green"/><Metric icon={Landmark} label="Withdrawal requested" value={money(requested||86500)} note={`${withdrawals.filter(w=>w.status==='requested').length||24} open requests`}/><Metric icon={ShieldAlert} label="Cashback on hold / disputed" value={money(held||22500)} note="Manual review required" tone="red"/></div>
      <article id="user-wallet-table" className="wallet-table-card"><header><div><h3>User wallet balances &amp; payout status</h3><p>Customer balances, withdrawal readiness, verification and risk.</p></div><Filters kind="user"/></header><div className="wallet-table-scroll"><table><thead><tr><th>USER</th><th>USER ID</th><th>CONFIRMED</th><th>PENDING</th><th>WITHDRAWABLE</th><th>REQUESTED</th><th>PAID LIFETIME</th><th>KYC</th><th>RISK</th><th>WALLET STATUS</th><th>ACTION</th></tr></thead><tbody>{users.map(r=><tr key={String(r[1])}><td><strong>{r[0]}</strong></td><td>{String(r[1]).startsWith('USR')?r[1]:compact(String(r[1]),'USR')}</td><td><b>{money(Number(r[2]))}</b></td><td className="money-pending">{money(Number(r[3]))}</td><td className="money-good">{money(Number(r[4]))}</td><td>{money(Number(r[5]))}</td><td>{money(Number(r[6]))}</td><td><span className={badge(String(r[7]))}>{r[7]}</span></td><td><span className={badge(String(r[8]))}>{r[8]}</span></td><td><span className={badge(String(r[9]))}>{r[9]}</span></td><td><Link className="wallet-row-action" href={`/admin/users/${r[1]}/wallet`}>Open wallet</Link></td></tr>)}</tbody></table></div><footer><span>Showing {users.length} customer wallets</span><Link href="/admin/users">View all users <ArrowRight/></Link></footer></article>
    </section>

    <section id="payout-operations" className="wallet-section wallet-system-section"><div className="wallet-section-title"><div><h2>Wallet system &amp; reconciliation</h2><p>Complete flow of funds from provider confirmation to customer payout.</p></div></div>
      <div className="wallet-system-grid"><article><h3>Wallet ledger flow</h3><p>End-to-end cashback flow for the selected period.</p><div className="wallet-ledger-flow">{[['Provider reported','₹12,48,000','6 statements'],['Validated by Glonni','₹11,80,000','312 items'],['User pending',money(pending||234500),`${claims.length||1842} items`],['Confirmed',money(confirmed||455000),`${entries.length||2601} entries`],['Withdrawable',money(Math.max(0,confirmed-paid-requested)||108000),'842 users'],['Paid to users',money(paid||322500),'621 payouts']].map((s,i)=><div key={s[0]}><i>{i+1}</i><span><small>{s[0]}</small><b>{s[1]}</b><em>{s[2]}</em></span>{i<5&&<ArrowRight/>}</div>)}</div></article><article><h3>Payout operations</h3><p>Customer payout processing status.</p><div className="payout-operation-list"><Link href="#user-wallet-table"><WalletCards/><span><b>Payout queue</b><small>{withdrawals.filter(w=>w.status==='requested').length||24} requests</small></span><strong>{money(requested||86500)}</strong><ArrowRight/></Link><Link href="?status=approved#user-wallet-table"><RefreshCcw/><span><b>Processing</b><small>8 requests</small></span><strong>₹24,000</strong><ArrowRight/></Link><Link href="?status=failed#reconciliation"><AlertTriangle/><span><b>Failed</b><small>3 requests</small></span><strong>₹3,000</strong><ArrowRight/></Link><Link href="?status=reversed#transactions"><RefreshCcw/><span><b>Reversed</b><small>2 transactions</small></span><strong>₹1,500</strong><ArrowRight/></Link></div></article></div>
      <article id="transactions" className="wallet-table-card"><header><div><h3>Recent wallet transactions</h3><p>Auditable credits, debits, holds, reversals and payouts.</p></div><Filters kind="transaction"/><Link className="wallet-export" href="?view=all-transactions#transactions">View all transactions</Link></header><div className="wallet-table-scroll"><table><thead><tr><th>TRANSACTION ID</th><th>USER</th><th>TYPE</th><th>REFERENCE</th><th>CREDIT</th><th>DEBIT</th><th>STATUS</th><th>CREATED</th><th>ACTION</th></tr></thead><tbody>{transactions.map(e=>{const amount=Number(e.amount);return <tr key={e.id}><td><strong>{compact(e.id,'TXN')}</strong></td><td>{e.profiles?.display_name||'Customer'}<small>{compact(e.profile_id,'USR')}</small></td><td>{e.entry_type.replaceAll('_',' ')}</td><td>{e.note||'Wallet ledger'}</td><td className="money-good">{amount>0?money(amount):'—'}</td><td className="money-bad">{amount<0?money(amount):'—'}</td><td><span className="wallet-badge good">Completed</span></td><td>{new Date(e.created_at).toLocaleDateString('en-IN')}</td><td><Link className="wallet-row-action" href={`/admin/users/${e.profile_id}/wallet`}>Open user wallet</Link></td></tr>})}</tbody></table></div><footer><span>Immutable ledger records</span><Link href="?view=all-transactions#transactions">View all transactions <ArrowRight/></Link></footer></article>
      <div id="reconciliation" className="wallet-review-grid"><article><header><h3>Exceptions requiring review</h3><Link href="/admin/reported-orders">View all <ArrowRight/></Link></header><p><AlertTriangle/><span><b>Provider payment overdue</b><small>Tata CLiQ · Due 18 Oct 2026</small></span><strong>₹5,000</strong></p><p><Clock3/><span><b>User withdrawal flagged</b><small>Risk review required</small></span><strong>₹2,500</strong></p><p><ShieldAlert/><span><b>Cashback mismatch</b><small>Amazon · Provider comparison</small></span><strong>₹180</strong></p></article><article><header><h3>Settlement reconciliation</h3><Link href="?view=reconciliation#reconciliation">View all <ArrowRight/></Link></header><p><CheckCircle2/><span><b>Reconciled transactions</b><small>Matched and settled</small></span><strong>2,418</strong></p><p><Clock3/><span><b>Pending provider payment</b><small>Awaiting settlement</small></span><strong>83</strong></p><p><AlertTriangle/><span><b>Mismatches</b><small>Require manual review</small></span><strong>{riskData?.length||27}</strong></p></article></div>
    </section>
  </main></section></main>;
}
