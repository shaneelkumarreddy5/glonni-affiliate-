import Link from 'next/link';
import { AdminSidebar } from '@/components/admin-sidebar';
import { createClient } from '@/lib/supabase/server';
import { AlertTriangle, ArrowRight, BadgeIndianRupee, CheckCircle2, Plus, Search, Store, Tag, WalletCards } from 'lucide-react';
import { createStore } from './actions';

export const dynamic = 'force-dynamic';
type SearchState = { q?: string; status?: string };
const money=(n:number)=>`₹${Math.round(n).toLocaleString('en-IN')}`;
const state=(active:boolean,approval:string|null)=>approval==='pending'?'Needs attention':active?'Active':approval==='paused'?'Paused':approval||'Draft';
const tone=(value:string)=>['Active','Connected','Compliant','approved'].includes(value)?'good':['Needs attention','pending','draft'].includes(value)?'warn':['Paused','rejected','Restricted'].includes(value)?'bad':'neutral';

export default async function Admin({searchParams}:{searchParams:Promise<SearchState>}) {
  const query=await searchParams;
  const supabase=await createClient();
  const [{data:stores},{data:offers},{data:clicks},{data:conversions},{data:providers},{data:events}]=await Promise.all([
    supabase.from('merchants').select('id,name,slug,logo_url,storefront_url,is_active,approval_status,homepage_position,updated_at').order('homepage_position'),
    supabase.from('offers').select('id,merchant_id,provider_id,status,reward_type,cashback_amount,cashback_percent'),
    supabase.from('redirect_events').select('id,merchant_id,created_at').order('created_at',{ascending:false}).limit(1000),
    supabase.from('referral_conversions').select('id,merchant_id,status,commission_amount,cashback_amount,created_at').order('created_at',{ascending:false}).limit(1000),
    supabase.from('affiliate_providers').select('id,name,is_active'),
    supabase.from('audit_events').select('id,event_type,entity_id,created_at').eq('entity_type','merchant').order('created_at',{ascending:false}).limit(8),
  ]);
  const all=stores??[], offerRows=offers??[], clickRows=clicks??[], conversionRows=conversions??[], providerRows=providers??[];
  const enriched=all.map(store=>{const so=offerRows.filter(x=>x.merchant_id===store.id), sc=clickRows.filter(x=>x.merchant_id===store.id), cv=conversionRows.filter(x=>x.merchant_id===store.id);const provider=providerRows.find(p=>p.id===so.find(x=>x.provider_id)?.provider_id);return {store,offers:so,clicks:sc.length,conversions:cv,provider};});
  const filtered=enriched.filter(({store})=>{const matchesText=!query.q||`${store.name} ${store.slug}`.toLowerCase().includes(query.q.toLowerCase());const current=state(store.is_active,store.approval_status).toLowerCase().replace(' ','-');const matchesStatus=!query.status||query.status==='all'||current===query.status||(query.status==='needs-attention'&&['draft','pending','rejected'].includes(store.approval_status??''));return matchesText&&matchesStatus;});
  const active=all.filter(s=>s.is_active).length, attention=all.filter(s=>['draft','pending','rejected'].includes(s.approval_status??'')).length;
  const confirmed=conversionRows.filter(x=>x.status==='confirmed'), commission=confirmed.reduce((n,x)=>n+Number(x.commission_amount||0),0), liability=confirmed.reduce((n,x)=>n+Number(x.cashback_amount||0),0);
  return <main className="admin-v2"><AdminSidebar/><section className="admin-main"><main className="admin-content stores-admin-page">
    <div className="admin-title stores-title"><div><p>CATALOGUE OPERATIONS</p><h1>Stores &amp; Brands</h1><span>Manage merchant identity, affiliate connections, offers and storefront visibility.</span></div><a className="add-store" href="#new-store"><Plus/> Add store</a></div>
    <section className="store-kpis">
      <Link href="/admin"><Store/><span>Total stores<b>{all.length}</b><small>Configured merchants</small></span></Link>
      <Link href="/admin?status=active"><CheckCircle2/><span>Active stores<b>{active}</b><small>Visible to customers</small></span></Link>
      <Link href="/admin?status=needs-attention"><AlertTriangle/><span>Needs attention<b>{attention}</b><small>Review required</small></span></Link>
      <Link href="/admin/offers?status=active"><Tag/><span>Active offers<b>{offerRows.filter(x=>x.status==='active').length}</b><small>Across all stores</small></span></Link>
      <Link href="/admin/wallet"><BadgeIndianRupee/><span>Confirmed commission<b>{money(commission)}</b><small>Provider-confirmed</small></span></Link>
      <Link href="/admin/wallet"><WalletCards/><span>Cashback liability<b>{money(liability)}</b><small>Customer obligation</small></span></Link>
    </section>
    <section className="stores-workspace"><article className="stores-directory">
      <div className="store-directory-tools"><div><h2>{query.status&&query.status!=='all'?query.status.replaceAll('-',' '):'Store directory'}</h2><span>{filtered.length} store{filtered.length===1?'':'s'} shown</span></div><form><input type="hidden" name="status" value={query.status||'all'}/><Search/><input name="q" defaultValue={query.q} placeholder="Search stores or brands…"/><button>Search</button>{(query.q||query.status&&query.status!=='all')&&<Link href="/admin">Clear</Link>}</form></div>
      <div className="table-scroll"><table className="stores-table"><thead><tr><th>STORE</th><th>AFFILIATE PROVIDER</th><th>CONNECTION</th><th>ACTIVE OFFERS</th><th>CLICKS</th><th>CONVERSIONS</th><th>COMMISSION</th><th>CASHBACK</th><th>POLICY</th><th>LAST SYNC</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{filtered.map(({store,offers:so,clicks:sc,conversions:cv,provider})=>{const confirmedRows=cv.filter(x=>x.status==='confirmed'), status=state(store.is_active,store.approval_status), providerName=provider?.name||'Manual';return <tr key={store.id}><td><span className="store-cell">{store.logo_url?<img src={store.logo_url} alt=""/>:<i>{store.name.slice(0,1)}</i>}<span><strong>{store.name}</strong><small>{store.storefront_url?.replace(/^https?:\/\//,'')||store.slug}</small></span></span></td><td>{providerName}</td><td><span className={`ops-chip ${tone(provider?'Connected':'Manual')}`}>{provider?'Connected':'Manual'}</span></td><td>{so.filter(x=>x.status==='active').length}</td><td>{sc}</td><td>{confirmedRows.length}</td><td>{money(confirmedRows.reduce((n,x)=>n+Number(x.commission_amount||0),0))}</td><td>{money(confirmedRows.reduce((n,x)=>n+Number(x.cashback_amount||0),0))}</td><td><span className={`ops-chip ${tone(so.some(x=>x.reward_type?.includes('cashback'))?'Compliant':'Review')}`}>{so.length?'Review ready':'Not assessed'}</span></td><td>{store.updated_at?new Date(store.updated_at).toLocaleDateString('en-IN'):'Not synced'}</td><td><span className={`ops-chip ${tone(status)}`}>{status}</span></td><td><Link className="manage-store" href={`/admin/stores/${store.slug}`}>Manage <ArrowRight/></Link></td></tr>})}</tbody></table></div>
      <footer><span>Showing {filtered.length} of {all.length} stores</span><span>Store records are connected to offers, clicks and conversions.</span></footer>
    </article><aside className="stores-sidepanels"><article><header><h2>Store health</h2><Link href="/admin/providers">View details <ArrowRight/></Link></header><p><i className="health-dot good"/><span>Connected<small>Active merchants</small></span><b>{active}</b></p><p><i className="health-dot warn"/><span>Attention<small>Needs review</small></span><b>{attention}</b></p><p><i className="health-dot neutral"/><span>Paused<small>Hidden from shoppers</small></span><b>{all.filter(x=>!x.is_active).length}</b></p></article><article><header><h2>Recent store activity</h2><Link href="/admin/activity">View all <ArrowRight/></Link></header>{(events??[]).map(event=>{const merchant=all.find(x=>x.id===event.entity_id);return <Link className="sync-event" href={merchant?`/admin/stores/${merchant.slug}#activity`:'/admin/activity'} key={event.id}><i className="health-dot good"/><span><b>{merchant?.name||'Store'}</b><small>{event.event_type.replaceAll('_',' ')}</small></span><time>{new Date(event.created_at).toLocaleDateString('en-IN')}</time></Link>})}{!(events??[]).length&&<p className="empty-admin">No store changes recorded yet.</p>}</article></aside></section>
    <section id="new-store" className="quick-add stores-add"><div><p>STORE SETUP</p><h2>Add a new store or brand</h2><span>New stores remain drafts until an authorised administrator approves them.</span></div><form action={createStore}><input name="name" required placeholder="Store name"/><input name="url" type="url" required placeholder="https://store.example"/><input name="homepagePosition" type="number" min="1" placeholder="Display order"/><button>Add draft store</button></form></section>
  </main></section></main>;
}
