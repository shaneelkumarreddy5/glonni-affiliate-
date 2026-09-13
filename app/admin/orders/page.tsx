import { Bell, CheckCircle2, CircleDollarSign, Clock3, Link2, MousePointerClick, Search, ShieldAlert, TriangleAlert, XCircle } from 'lucide-react';
import { AdminSidebar } from '@/components/admin-sidebar';
import { createClient } from '@/lib/supabase/server';
import { matchConversion, rejectConversion } from '../conversion-actions';

export const dynamic = 'force-dynamic';
const money = (value: number | null, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value ?? 0));
const when = (value: string) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const clean = (value: string) => value.replaceAll('_', ' ');

type Conversion = {
  id: string; provider_order_reference: string | null; provider_click_reference: string | null;
  status: string; match_status: string; match_method: string | null; issue_code: string | null;
  order_value: number | null; commission_amount: number | null; currency: string; created_at: string;
  affiliate_providers: { name: string } | null; offers: { products: { title: string } | null } | null;
  merchants: { name: string } | null; profiles: { full_name: string | null } | null;
};

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; success?: string }> }) {
  const query = await searchParams;
  const active = ['all', 'matched', 'unmatched', 'ambiguous', 'rejected'].includes(query.status ?? '') ? query.status! : 'all';
  const supabase = await createClient();
  const [{ data: conversionRows }, { count: clickCount }, { count: duplicateCount }] = await Promise.all([
    supabase.from('referral_conversions').select('id,provider_order_reference,provider_click_reference,status,match_status,match_method,issue_code,order_value,commission_amount,currency,created_at,affiliate_providers(name),offers(products(title)),merchants(name),profiles(full_name)').order('created_at', { ascending: false }).limit(250),
    supabase.from('redirect_events').select('id', { count: 'exact', head: true }),
    supabase.from('provider_webhook_deliveries').select('id', { count: 'exact', head: true }).eq('outcome', 'duplicate'),
  ]);
  const all = (conversionRows ?? []) as unknown as Conversion[];
  const needle = (query.q ?? '').trim().toLowerCase();
  const rows = all.filter(row => (active === 'all' || row.match_status === active) && (!needle || `${row.provider_order_reference ?? ''} ${row.provider_click_reference ?? ''} ${row.affiliate_providers?.name ?? ''} ${row.merchants?.name ?? ''} ${row.offers?.products?.title ?? ''}`.toLowerCase().includes(needle)));
  const matched = all.filter(row => row.match_status === 'matched');
  const unmatched = all.filter(row => row.match_status === 'unmatched');
  const ambiguous = all.filter(row => row.match_status === 'ambiguous');
  const commission = matched.filter(row => row.status === 'confirmed').reduce((sum, row) => sum + Number(row.commission_amount ?? 0), 0);

  return <main className="admin-v2"><AdminSidebar/><section className="admin-main"><header className="admin-top"><MousePointerClick size={21}/><b>Conversion Operations</b><span className="dashboard-date">Provider postbacks · click matching</span><Bell size={19}/><span className="avatar">SR</span></header><main className="admin-content">
    <div className="admin-title"><div><p>AFFILIATE OPERATIONS · STEP 2</p><h1>Conversions &amp; order matching</h1><span>Every signed provider sale is normalized, de-duplicated and matched to the exact Glonni click before financial processing.</span></div><a className="add-store" href="/admin/postbacks">Open delivery logs</a></div>
    {query.success && <p className="offer-success"><CheckCircle2/>{query.success}</p>}
    <section className="admin-stats conversion-stats"><article><MousePointerClick/><div><small>Tracked clicks</small><b>{clickCount ?? 0}</b><em>Step 1 click records</em></div></article><article><Link2/><div><small>Matched conversions</small><b>{matched.length}</b><em>Customer and offer resolved</em></div></article><article><TriangleAlert/><div><small>Needs investigation</small><b>{unmatched.length + ambiguous.length}</b><em>Missing or unclear click</em></div></article><article><CircleDollarSign/><div><small>Confirmed commission</small><b>{money(commission)}</b><em>Provider-reported only</em></div></article><article><ShieldAlert/><div><small>Duplicates blocked</small><b>{duplicateCount ?? 0}</b><em>Repeated event IDs</em></div></article></section>
    <section className="conversion-workspace"><article className="store-table conversion-table-card"><div className="conversion-toolbar"><nav>{[['all','All'],['matched','Matched'],['unmatched','Unmatched'],['ambiguous','Ambiguous'],['rejected','Rejected']].map(([key,label]) => <a key={key} className={active === key ? 'current' : ''} href={`/admin/orders?status=${key}`}>{label}<span>{key === 'all' ? all.length : all.filter(row => row.match_status === key).length}</span></a>)}</nav><form action="/admin/orders"><input type="hidden" name="status" value={active}/><Search size={17}/><input name="q" defaultValue={query.q} placeholder="Search order, click, provider or product"/><button>Search</button></form></div>
      <div className="table-scroll"><table><thead><tr><th>ORDER / RECEIVED</th><th>PROVIDER</th><th>CUSTOMER / PRODUCT</th><th>ORDER VALUE</th><th>COMMISSION</th><th>ORDER STATUS</th><th>MATCH RESULT</th><th>INVESTIGATE</th></tr></thead><tbody>{rows.length ? rows.map(row => <tr key={row.id}><td><strong>{row.provider_order_reference ?? 'No order reference'}</strong><small>{when(row.created_at)}</small></td><td><strong>{row.affiliate_providers?.name ?? 'Provider'}</strong><small>{row.provider_click_reference ? `Click ${row.provider_click_reference.slice(0, 8)}…` : 'No click returned'}</small></td><td><strong>{row.profiles?.full_name ?? (row.match_status === 'matched' ? 'Customer linked' : 'Unknown customer')}</strong><small>{row.offers?.products?.title ?? row.merchants?.name ?? 'Awaiting click match'}</small></td><td>{money(row.order_value, row.currency)}</td><td>{money(row.commission_amount, row.currency)}</td><td><em className={row.status === 'confirmed' ? 'status-active' : row.status === 'rejected' || row.status === 'cancelled' ? 'status-danger' : 'status-paused'}>{clean(row.status)}</em></td><td><em className={row.match_status === 'matched' ? 'status-active' : row.match_status === 'rejected' ? 'status-danger' : 'status-paused'}>{clean(row.match_status)}</em><small>{row.match_method ? clean(row.match_method) : clean(row.issue_code ?? 'review required')}</small></td><td>{row.match_status === 'matched' ? <span className="conversion-locked"><CheckCircle2 size={15}/>Linked</span> : row.match_status === 'rejected' ? <span className="conversion-locked"><XCircle size={15}/>Closed</span> : <details className="conversion-actions"><summary>Review</summary><div><form action={matchConversion}><input type="hidden" name="conversionId" value={row.id}/><label>Exact Glonni click ID<input name="clickToken" required placeholder="Paste click UUID"/></label><button>Match conversion</button></form><form action={rejectConversion}><input type="hidden" name="conversionId" value={row.id}/><label>Rejection reason<input name="reason" required placeholder="Reason for rejection"/></label><button className="danger-button">Reject event</button></form></div></details>}</td></tr>) : <tr><td colSpan={8}>No conversions match this view.</td></tr>}</tbody></table></div><footer>Matching links the provider order to the original customer, offer and merchant. It does not calculate or release cashback.</footer></article>
      <aside className="admin-right"><article><h2>Matching controls</h2><p>Provider signature <span>Verified first</span></p><p>Provider order ID <span>Unique</span></p><p>Click ownership <span>Same provider</span></p><p>Raw payload <span>Private vault</span></p></article><article><h2>Lifecycle separation</h2><p className="activity"><Clock3 size={14}/>Order status<small>Pending, confirmed, rejected or cancelled—reported by the provider.</small></p><p className="activity"><Link2 size={14}/>Match result<small>Matched, unmatched or ambiguous—decided by Glonni attribution.</small></p><p className="activity"><ShieldAlert size={14}/>No wallet mutation<small>Cashback calculation and approval remain a later controlled step.</small></p></article></aside></section>
  </main></section></main>;
}
