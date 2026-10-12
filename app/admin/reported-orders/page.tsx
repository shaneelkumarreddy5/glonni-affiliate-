import Link from 'next/link';
import { CheckCircle2, Clock3, FileWarning, XCircle } from 'lucide-react';
import { AdminSidebar } from '@/components/admin-sidebar';
import { createClient } from '@/lib/supabase/server';
import { readOperationalRows } from '@/lib/admin-operational-data';
import { reviewCashbackClaim } from '../wallet-actions';

export const dynamic = 'force-dynamic';
type Claim = {
  id: string; profile_id: string; order_reference: string; claimed_amount: number | string | null;
  status: string; evidence_url: string | null; note: string | null; reviewer_note: string | null;
  conversion_id: string | null; risk_score: number | null; created_at: string; reviewed_at: string | null;
  profiles: { display_name: string | null } | null;
  offers: { products: { title: string } | null; merchants: { name: string } | null } | null;
};
const tabs = [['all', 'All claims'], ['submitted', 'Submitted'], ['needs_info', 'Needs information'], ['confirmed', 'Confirmed'], ['rejected', 'Rejected'], ['cancelled', 'Cancelled']];
const label = (value: string) => value.replaceAll('_', ' ');

export default async function ReportedOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const query = await searchParams;
  const status = tabs.some(([key]) => key === query.status) ? query.status! : 'all';
  const supabase = await createClient();
  const [{ rows: claims, failed }, { data: { user } }, { data: assurance }] = await Promise.all([
    readOperationalRows<Claim>(supabase, 'cashback_claims', 'id,profile_id,order_reference,claimed_amount,status,evidence_url,note,reviewer_note,conversion_id,risk_score,created_at,reviewed_at,profiles!profile_id(display_name),offers(products(title),merchants(name))'),
    supabase.auth.getUser(), supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  const [{ data: profile }, { data: employee }] = user ? await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
    supabase.from('employees').select('status').eq('profile_id', user.id).maybeSingle(),
  ]) : [{ data: null }, { data: null }];
  const canReview = Boolean(profile && ['owner', 'admin'].includes(profile.role) && employee?.status === 'active' && assurance?.currentLevel === 'aal2');
  const rows = claims.filter(claim => (status === 'all' || claim.status === status) && (!query.q || `${claim.order_reference} ${claim.profiles?.display_name ?? ''} ${claim.offers?.products?.title ?? ''} ${claim.offers?.merchants?.name ?? ''}`.toLowerCase().includes(query.q.toLowerCase()))).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const stats = [{ icon: FileWarning, title: 'Submitted', key: 'submitted' }, { icon: Clock3, title: 'Needs information', key: 'needs_info' }, { icon: CheckCircle2, title: 'Confirmed', key: 'confirmed' }, { icon: XCircle, title: 'Rejected', key: 'rejected' }];
  return <div className="admin-v2"><AdminSidebar/><section className="admin-main"><main className="admin-content">
    <div className="admin-title"><div><p>EXCEPTION MANAGEMENT</p><h1>Reported Orders</h1><span>Customer-submitted missing-order claims and recorded review decisions.</span></div><Link className="add-store" href="/admin/orders">View provider conversions</Link></div>
    {failed && <p className="preview-note" role="alert">Claims could not be loaded. Refresh to retry; the counts below are unavailable.</p>}
    <section className="admin-stats">{stats.map(({ icon: Icon, title, key }) => <article key={key}><Icon/><div><small>{title}</small><b>{failed ? '—' : claims.filter(claim => claim.status === key).length}</b><em>Customer claims</em></div></article>)}</section>
    <article className="store-table"><div className="table-head"><div>{tabs.map(([key, title]) => <Link key={key} className={status === key ? 'current' : ''} href={`/admin/reported-orders?status=${key}`}>{title}</Link>)}</div><form action="/admin/reported-orders"><input type="hidden" name="status" value={status}/><input name="q" defaultValue={query.q} aria-label="Search claims" placeholder="Search order or customer"/><button>Search</button></form></div>
      <div className="table-scroll"><table><thead><tr><th>ORDER REFERENCE</th><th>CUSTOMER</th><th>STORE / PRODUCT</th><th>SUBMITTED</th><th>CLAIMED AMOUNT</th><th>EVIDENCE</th><th>STATUS</th><th>REVIEW</th></tr></thead><tbody>{rows.map(claim => <tr key={claim.id}>
        <td><strong>{claim.order_reference}</strong><small>{claim.id.slice(0, 8)}</small></td><td>{claim.profiles?.display_name || 'Customer'}</td><td><strong>{claim.offers?.merchants?.name || 'Store not linked'}</strong><small>{claim.offers?.products?.title || 'Offer not linked'}</small></td><td>{new Date(claim.created_at).toLocaleDateString('en-IN')}</td><td>{claim.claimed_amount === null ? '—' : `₹${Number(claim.claimed_amount).toLocaleString('en-IN')}`}</td><td>{claim.evidence_url ? 'Evidence submitted' : 'No attachment'}{claim.note && <small>{claim.note}</small>}</td><td><em className={claim.status === 'confirmed' ? 'status-active' : 'status-paused'}>{label(claim.status)}</em>{claim.reviewer_note && <small>{claim.reviewer_note}</small>}</td>
        <td>{canReview && ['submitted', 'needs_info'].includes(claim.status) ? <form action={reviewCashbackClaim}><input type="hidden" name="id" value={claim.id}/><button name="decision" value="hold">Needs information</button><button name="decision" value="reject">Reject</button>{claim.conversion_id && Number(claim.risk_score ?? 100) < 60 && <button name="decision" value="confirm">Confirm linked claim</button>}</form> : claim.reviewed_at ? new Date(claim.reviewed_at).toLocaleDateString('en-IN') : 'Owner/Admin review required'}</td>
      </tr>)}{!rows.length && <tr><td colSpan={8}>{failed ? 'Unable to load claims.' : 'No customer claims match this view.'}</td></tr>}</tbody></table></div><footer>Claimed amounts are requests, not wallet credits. Provider confirmation and cashback eligibility remain required.</footer>
    </article>
  </main></section></div>;
}
