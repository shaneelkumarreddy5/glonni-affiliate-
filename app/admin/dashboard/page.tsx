import { AdminSidebar } from '@/components/admin-sidebar';
import { createClient } from '@/lib/supabase/server';
import { Activity, AlertTriangle, ArrowRight, BadgeDollarSign, Bell, Building2, CheckCircle2, CircleDollarSign, Database, FileClock, MousePointerClick, Package, ShieldAlert, Store, Users, WalletCards } from 'lucide-react';

export const dynamic = 'force-dynamic';

const money = (value: number) => `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value)}`;
const percent = (part: number, total: number) => total ? `${Math.round((part / total) * 1000) / 10}%` : '0%';

function ViewAll({ href, label = 'View all' }: { href: string; label?: string }) {
  return <a className="dashboard-view-all" href={href}>{label}<ArrowRight size={14}/></a>;
}

export default async function Dashboard() {
  const supabase = await createClient();
  const [{ data: merchants }, { data: products }, { data: offers }, { count: profileCount }, { data: clicks }, { data: conversions }, { data: approvals }, { data: entries }, { data: withdrawals }, { data: risks }, { data: events }] = await Promise.all([
    supabase.from('merchants').select('id,is_active'),
    supabase.from('products').select('id'),
    supabase.from('offers').select('id,reward_type,status'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('redirect_events').select('id,created_at').order('created_at', { ascending: false }).limit(250),
    supabase.from('referral_conversions').select('id,status,commission_amount,cashback_amount,created_at').order('created_at', { ascending: false }).limit(250),
    supabase.from('ai_work_items').select('id,title,summary,risk_level,status,area,created_at').order('created_at', { ascending: false }).limit(50),
    supabase.from('wallet_entries').select('amount,entry_type').limit(250),
    supabase.from('withdrawal_requests').select('amount,status,risk_level').order('created_at', { ascending: false }).limit(100),
    supabase.from('financial_risk_signals').select('id').limit(100),
    supabase.from('activity_events').select('id,occurred_at,event_type,surface,request_status,error_details').order('occurred_at', { ascending: false }).limit(12),
  ]);

  const merchantList = merchants ?? [];
  const offerList = offers ?? [];
  const conversionList = conversions ?? [];
  const eventList = events ?? [];
  const clickCount = (clicks ?? []).length;
  const activeStores = merchantList.filter((item) => item.is_active).length;
  const activeOffers = offerList.filter((item) => item.status === 'active').length;
  const reportedOrders = conversionList.length;
  const confirmedOrders = conversionList.filter((item) => item.status === 'confirmed');
  const confirmedCommission = confirmedOrders.reduce((sum, item) => sum + Number(item.commission_amount ?? 0), 0);
  const cashbackLiability = confirmedOrders.reduce((sum, item) => sum + Number(item.cashback_amount ?? 0), 0);
  const pendingCommission = conversionList.filter((item) => item.status === 'pending').reduce((sum, item) => sum + Number(item.commission_amount ?? 0), 0);
  const payoutExposure = (withdrawals ?? []).filter((item) => ['requested', 'on_hold', 'approved'].includes(item.status ?? '')).reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const pendingApprovals = (approvals ?? []).filter((item) => item.status === 'pending_approval');
  const errorEvents = eventList.filter((item) => (item.request_status ?? 200) >= 400);
  const confirmedWallet = (entries ?? []).filter((item) => item.entry_type === 'cashback_confirmed').reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const fallbackApprovals = [
    { title: 'Review provider policy update', summary: 'Awaiting owner rule decision', risk_level: 'medium', area: 'Provider policy' },
    { title: 'Review cashback exception', summary: 'Provider confirmation required', risk_level: 'high', area: 'Cashback' },
  ];
  const approvalPreview = pendingApprovals.length ? pendingApprovals.slice(0, 3) : fallbackApprovals;
  const traffic = [
    { label: 'Customer activity', value: Math.max(profileCount ?? 0, clickCount), href: '/admin/users', accent: 'blue' },
    { label: 'Product views', value: Math.max(clickCount, 0), href: '/admin/analytics', accent: 'blue' },
    { label: 'Outbound clicks', value: clickCount, href: '/admin/orders', accent: 'blue' },
    { label: 'Reported orders', value: reportedOrders, href: '/admin/reported-orders', accent: 'soft' },
    { label: 'Confirmed conversions', value: confirmedOrders.length, href: '/admin/orders', accent: 'green' },
  ];

  return <main className="admin-v2"><AdminSidebar/><section className="admin-main"><header className="admin-top dashboard-top"><div className="dashboard-top-title"><Activity size={21}/><b>Dashboard</b></div><form action="/admin/search"><input name="q" placeholder="Search users, offers, partners, or activity…" aria-label="Search admin workspace"/></form><span className="dashboard-period">This month</span><span className="dashboard-mode">MOCK MODE · TEST DATA</span><Bell size={19}/><span className="avatar">SR</span><div><b>Shaneel</b><small>Owner</small></div></header><main className="admin-content dashboard-overview"><div className="dashboard-hero"><div><p>BUSINESS OVERVIEW</p><h1>Good morning, Shaneel</h1><span>Your daily Glonni operating picture. Open any panel to review the underlying workspace.</span></div></div>

  <section className="dashboard-kpis">
    <a href="/admin/orders" className="dashboard-kpi"><MousePointerClick/><span>Outbound clicks</span><b>{clickCount}</b><small>Open tracked orders <ArrowRight size={12}/></small></a>
    <a href="/admin" className="dashboard-kpi"><Store/><span>Active stores</span><b>{activeStores}</b><small>{merchantList.length} configured <ArrowRight size={12}/></small></a>
    <a href="/admin/offers" className="dashboard-kpi"><Package/><span>Active offers</span><b>{activeOffers}</b><small>{offerList.filter((item) => ['fixed_cashback', 'percentage_cashback'].includes(item.reward_type ?? '')).length} cashback eligible <ArrowRight size={12}/></small></a>
    <a href="/admin/users" className="dashboard-kpi"><Users/><span>Registered users</span><b>{profileCount ?? 0}</b><small>Open customer management <ArrowRight size={12}/></small></a>
    <a href="/admin/orders" className="dashboard-kpi"><BadgeDollarSign/><span>Confirmed commission</span><b>{money(confirmedCommission)}</b><small>Provider-reported only <ArrowRight size={12}/></small></a>
    <a href="/admin/wallet" className="dashboard-kpi"><WalletCards/><span>Cashback liability</span><b>{money(cashbackLiability)}</b><small>{money(confirmedWallet)} ledger credits <ArrowRight size={12}/></small></a>
  </section>

  <section className="dashboard-grid dashboard-primary-grid">
    <article className="dashboard-panel traffic-panel"><div className="dashboard-panel-title"><div><span><MousePointerClick/>Traffic funnel</span><p>From customer discovery to confirmed conversion</p></div><ViewAll href="/admin/analytics" label="Open analytics"/></div><div className="traffic-funnel">{traffic.map((item, index) => <div className={`traffic-step ${item.accent}`} key={item.label}><a href={item.href}><small>{item.label}</small><b>{item.value}</b><i style={{ height: `${Math.max(20, Math.round(((item.value || 0) / Math.max(1, traffic[0].value || 1)) * 100))}%` }}/><em>{percent(item.value, traffic[0].value)}</em></a>{index < traffic.length - 1 && <ArrowRight className="traffic-arrow" size={16}/>}</div>)}</div></article>
    <article className="dashboard-panel revenue-panel"><div className="dashboard-panel-title"><div><span><CircleDollarSign/>Revenue &amp; cashflow</span><p>Confirmed income and current liabilities</p></div><ViewAll href="/admin/orders"/></div><a href="/admin/orders" className="finance-row"><span>Confirmed commission</span><b>{money(confirmedCommission)}</b></a><a href="/admin/orders" className="finance-row"><span>Pending commission</span><b>{money(pendingCommission)}</b></a><a href="/admin/wallet" className="finance-row"><span>Cashback liability</span><b>{money(cashbackLiability)}</b></a><a href="/admin/wallet" className="finance-row"><span>Payout exposure</span><b>{money(payoutExposure)}</b></a></article>
    <article className="dashboard-panel approvals-panel"><div className="dashboard-panel-title"><div><span><CheckCircle2/>Owner approvals <em>{pendingApprovals.length}</em></span><p>Items that need your decision</p></div><ViewAll href="/admin/approvals"/></div><div className="approval-list">{approvalPreview.map((item, index) => <a href="/admin/approvals" key={`${item.title}-${index}`} className="approval-item"><i className={item.risk_level === 'high' || item.risk_level === 'critical' ? 'risk-high' : 'risk-medium'}><AlertTriangle size={15}/></i><span><b>{item.title}</b><small>{item.area} · {item.summary}</small></span><strong>Review</strong></a>)}</div></article>
  </section>

  <section className="dashboard-grid dashboard-health-grid">
    <article className="dashboard-panel provider-panel"><div className="dashboard-panel-title"><div><span><Building2/>Provider health</span><p>Merchant and provider integration readiness</p></div><ViewAll href="/admin/providers"/></div><div className="provider-statuses"><a href="/admin/providers"><i className="ok"/>Configured<b>{activeStores}</b><small>Active merchants</small></a><a href="/admin/providers"><i className="pending"/>Awaiting approval<b>3</b><small>Preview registry</small></a><a href="/admin/integrations"><i className="attention"/>Needs attention<b>0</b><small>No live API issues</small></a></div></article>
    <article className="dashboard-panel risk-panel"><div className="dashboard-panel-title"><div><span><ShieldAlert/>Risk &amp; security alerts <em>{(risks ?? []).length + errorEvents.length}</em></span><p>Recent system, fraud and access signals</p></div><ViewAll href="/admin/activity?status=errors"/></div><div className="risk-list">{errorEvents.length ? errorEvents.slice(0, 3).map((item) => <a href="/admin/activity?status=errors" key={item.id}><AlertTriangle/><span><b>{item.event_type.replaceAll('_', ' ')}</b><small>{item.error_details || 'Request needs review'}</small></span><em>Review</em></a>) : <a href="/admin/activity?status=errors"><CheckCircle2/><span><b>No unresolved logged errors</b><small>Open the audit log to monitor customer, admin and API requests.</small></span><em>Open log</em></a>}</div></article>
    <article className="dashboard-panel system-panel"><div className="dashboard-panel-title"><div><span><Database/>System health</span><p>Operational service readiness</p></div><a className="dashboard-healthy" href="/admin/integrations">Preview healthy</a></div>{[['Supabase database','/admin/settings'],['Redirect tracking','/admin/orders'],['AI service','/admin/ai-agents'],['Scheduled jobs','/admin/integrations']].map(([label, href]) => <a href={href} key={label} className="system-row"><CheckCircle2/><span>{label}</span><b>Ready</b></a>)}</article>
  </section>

  <section className="dashboard-grid dashboard-bottom-grid">
    <article className="dashboard-panel growth-panel"><div className="dashboard-panel-title"><div><span><Users/>Growth snapshot</span><p>Customer engagement signals</p></div><ViewAll href="/admin/analytics"/></div><div className="growth-metrics"><a href="/admin/users"><small>Registered users</small><b>{profileCount ?? 0}</b><em>Open users</em></a><a href="/admin/analytics"><small>Tracked clicks</small><b>{clickCount}</b><em>Open analytics</em></a><a href="/admin/reported-orders"><small>Reported orders</small><b>{reportedOrders}</b><em>Open orders</em></a><a href="/admin/wallet"><small>Confirmed cashback</small><b>{money(cashbackLiability)}</b><em>Open payouts</em></a></div></article>
    <article className="dashboard-panel activity-panel"><div className="dashboard-panel-title"><div><span><FileClock/>Recent activity</span><p>Latest customer, admin and API events</p></div><ViewAll href="/admin/activity"/></div><div className="dashboard-activity">{eventList.length ? eventList.slice(0, 5).map((item) => <a href="/admin/activity" key={item.id}><i/><span>{item.event_type.replaceAll('_', ' ')}</span><small>{item.surface}</small><em>{new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(new Date(item.occurred_at))}</em></a>) : <a href="/admin/activity"><i/><span>No events logged yet</span><small>Activity begins when the customer or admin app is used.</small><em>Open log</em></a>}</div></article>
  </section>
  <p className="dashboard-footnote">All dashboard values link to their source workspace. “Mock mode” means preview records and controls may not represent live provider, commission, payout or advertising activity.</p>
  </main></section></main>;
}
