import Link from 'next/link';
import { ArrowRight, Clock3, Gift, Search, TrendingUp, WalletCards } from 'lucide-react';
import { redirect } from 'next/navigation';
import { Header } from '@/components/header';
import { createClient } from '@/lib/supabase/server';
import { requestWithdrawal } from './actions';
import { SimpleCaptcha } from '@/components/simple-captcha';
import { CmsManagedSections } from '@/components/cms-managed-sections';
import { estimateTrackedCashback, summarizeWallet } from '@/lib/wallet-balances';
import { allPages } from '@/lib/supabase/paginate';
import './wallet.css';
import './wallet-figma.css';
import './wallet-redesign.css';

type Props = { searchParams: Promise<{ error?: string; success?: string; tab?: string; q?: string }> };
type Withdrawal = { id: string; amount: number; status: string; upi_id: string; created_at: string };
type Award = { id: string; conversion_id: string; amount: number; status: string; created_at: string; referral_conversions: { provider_order_reference: string | null; merchants: { name: string } | null } | null };
type PointAward = { id: string; conversion_id: string; points: number; status: string; created_at: string; referral_conversions: { provider_order_reference: string | null; merchants: { name: string } | null } | null };
type Conversion = { id: string; status: string; reward_type_snapshot: string | null; reward_points_snapshot: number | null; cashback_amount: number | null; cashback_fixed_snapshot: number | null; cashback_percent_snapshot: number | null; cashback_cap_snapshot: number | null; order_value: number | null; created_at: string; provider_order_reference: string | null; merchants: { name: string } | null };
type Claim = { id: string; conversion_id: string | null; order_reference: string; claimed_amount: number | null; status: string; created_at: string; offers: { merchants: { name: string } | null } | null };
type Activity = { id: string; kind: 'cashback' | 'rewards' | 'payouts'; name: string; reference: string; amount: string; status: string; created_at: string };
const money = (value: number) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const points = (value: number) => `${value.toLocaleString('en-IN')} points`;
const tabs = ['all', 'cashback', 'rewards', 'payouts'] as const;

export default async function WalletPage({ searchParams }: Props) {
  const params = await searchParams;
  if (params.tab === 'referrals') redirect('/account?section=referral');
  const tab = tabs.includes(params.tab as typeof tabs[number]) ? params.tab as typeof tabs[number] : 'all';
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/wallet');
  const [entryResult, withdrawalResult, cashbackResult, pointsResult, conversionResult, claimsResult] = await Promise.all([
    allPages((from, to) => supabase.from('wallet_entries').select('amount,entry_type').order('created_at').range(from, to)),
    allPages((from, to) => supabase.from('withdrawal_requests').select('id,amount,status,upi_id,created_at').order('created_at', { ascending: false }).range(from, to)),
    allPages((from, to) => supabase.from('cashback_awards').select('id,conversion_id,amount,status,created_at,referral_conversions(provider_order_reference,merchants(name))').order('created_at', { ascending: false }).range(from, to)),
    allPages((from, to) => supabase.from('reward_point_awards').select('id,conversion_id,points,status,created_at,referral_conversions(provider_order_reference,merchants(name))').order('created_at', { ascending: false }).range(from, to)),
    allPages((from, to) => supabase.from('referral_conversions').select('id,status,reward_type_snapshot,reward_points_snapshot,cashback_amount,cashback_fixed_snapshot,cashback_percent_snapshot,cashback_cap_snapshot,order_value,created_at,provider_order_reference,merchants(name)').eq('match_status', 'matched').order('created_at', { ascending: false }).range(from, to)),
    supabase.from('cashback_claims').select('id,conversion_id,order_reference,claimed_amount,status,created_at,offers(merchants(name))').order('created_at', { ascending: false }).limit(100),
  ]);
  const entries = entryResult.data ?? [];
  const withdrawals = (withdrawalResult.data ?? []) as Withdrawal[];
  const cashbackAwards = (cashbackResult.data ?? []) as unknown as Award[];
  const pointAwards = (pointsResult.data ?? []) as unknown as PointAward[];
  const conversions = (conversionResult.data ?? []) as unknown as Conversion[];
  const claims = (claimsResult.data ?? []) as unknown as Claim[];
  const { availableCashback, pendingCashback, redeemablePoints, pendingPoints, trackingCashback, trackingPoints, tracking } = summarizeWallet(entries, withdrawals, cashbackAwards, pointAwards, conversions.filter(item => Boolean(item.provider_order_reference)));
  const cashbackAwardConversions = new Set(cashbackAwards.map(item => item.conversion_id));
  const activity: Activity[] = [
    ...cashbackAwards.map(item => ({ id: `cashback-${item.id}`, kind: 'cashback' as const, name: item.referral_conversions?.merchants?.name || 'Affiliate purchase', reference: item.referral_conversions?.provider_order_reference || 'Tracked order', amount: money(Number(item.amount)), status: item.status === 'confirmed' ? 'Available' : item.status === 'pending' ? 'Pending confirmation' : item.status, created_at: item.created_at })),
    ...pointAwards.map(item => ({ id: `points-${item.id}`, kind: 'rewards' as const, name: item.referral_conversions?.merchants?.name || 'Affiliate purchase', reference: item.referral_conversions?.provider_order_reference || 'Tracked order', amount: points(Number(item.points)), status: item.status === 'confirmed' ? 'Available' : item.status === 'pending' ? 'Pending confirmation' : item.status, created_at: item.created_at })),
    ...tracking.map(item => ({ id: `tracking-${item.id}`, kind: (item.reward_type_snapshot === 'points' ? 'rewards' : 'cashback') as Activity['kind'], name: item.merchants?.name || 'Affiliate purchase', reference: item.provider_order_reference || 'Tracking purchase', amount: item.reward_type_snapshot === 'points' ? points(Number(item.reward_points_snapshot ?? 0)) : money(estimateTrackedCashback(item)), status: 'Tracking', created_at: item.created_at })).filter(item => item.amount !== '₹0' && item.amount !== '0 points'),
    ...withdrawals.map(item => ({ id: `payout-${item.id}`, kind: 'payouts' as const, name: `UPI ••••${item.upi_id.slice(-4)}`, reference: 'Cashback payout', amount: money(Number(item.amount)), status: item.status, created_at: item.created_at })),
    ...claims.filter(item => !item.conversion_id || !cashbackAwardConversions.has(item.conversion_id)).map(item => ({ id: `claim-${item.id}`, kind: 'cashback' as const, name: item.offers?.merchants?.name || 'Missing cashback claim', reference: item.order_reference, amount: item.claimed_amount ? money(Number(item.claimed_amount)) : '—', status: ['submitted', 'needs_info'].includes(item.status) ? 'Claim under review' : item.status, created_at: item.created_at })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const needle = params.q?.trim().toLowerCase() || '';
  const visibleActivity = activity.filter(item => (tab === 'all' || item.kind === tab) && (!needle || `${item.name} ${item.reference} ${item.status}`.toLowerCase().includes(needle)));

  return <><Header/><main className="wallet-page wallet-redesign">
    <nav className="wallet-crumb"><Link href="/">Home</Link><span>›</span><b>My Wallet</b></nav>
    <header className="wallet-heading"><h1>My Wallet</h1></header>
    <CmsManagedSections pageKey="wallet" slot="after_heading"/>
    {params.error && <p className="auth-notice error" role="alert">{params.error}</p>}{params.success && <p className="auth-notice success" role="status">{params.success}</p>}
    {(entryResult.error || withdrawalResult.error || cashbackResult.error || pointsResult.error || conversionResult.error) && <p className="auth-notice error" role="alert">Some wallet balances could not be loaded. Please try again later; do not rely on the figures below until this message clears.</p>}
    <section className="wallet-balance-section" aria-labelledby="cashback-title"><h2 id="cashback-title">Cashback</h2><div className="wallet-balance-grid">
      <article><WalletCards/><div><small>Available to withdraw</small><b>{money(availableCashback)}</b></div><a href="#request-payout">Withdraw <ArrowRight size={16}/></a></article>
      <article><Clock3/><div><small>Pending confirmation</small><b>{money(pendingCashback)}</b></div></article>
      <article><TrendingUp/><div><small>Tracking</small><b>{money(trackingCashback)}</b></div></article>
    </div></section>
    <section className="wallet-balance-section" aria-labelledby="rewards-title"><h2 id="rewards-title">Rewards</h2><div className="wallet-balance-grid rewards-grid">
      <article><Gift/><div><small>Redeemable points</small><b>{points(redeemablePoints)}</b></div><button className="wallet-redeem-disabled" type="button" disabled title="Rewards redemption is not available yet">Redeem <ArrowRight size={16}/></button><span className="wallet-coming-soon">Coming soon</span></article>
      <article><Clock3/><div><small>Pending confirmation</small><b>{points(pendingPoints)}</b></div></article>
      <article><TrendingUp/><div><small>Tracking</small><b>{points(trackingPoints)}</b></div></article>
    </div></section>
    <section className="wallet-history" aria-labelledby="activity-title"><header className="wallet-activity-heading"><h2 id="activity-title">Recent activity</h2><Link href="/cashback-claim">Missing cashback?</Link></header><div className="history-top"><nav className="history-tabs" aria-label="Activity type">{tabs.map(value => <Link key={value} href={`/wallet?tab=${value}`} className={tab === value ? 'active' : ''} aria-current={tab === value ? 'page' : undefined}>{value === 'all' ? 'All' : value === 'payouts' ? 'Payouts' : value === 'rewards' ? 'Rewards' : 'Cashback'}</Link>)}</nav><form className="wallet-search" action="/wallet"><input type="hidden" name="tab" value={tab}/><Search size={16}/><input name="q" defaultValue={params.q || ''} placeholder="Search activity" aria-label="Search activity"/><button>Search</button></form></div>
      {visibleActivity.length ? <div className="wallet-activity-list">{visibleActivity.slice(0, 30).map(item => <div className="wallet-activity-row" key={item.id}><span className={`wallet-activity-icon ${item.kind}`}>{item.kind === 'rewards' ? <Gift/> : item.kind === 'payouts' ? <ArrowRight/> : <WalletCards/>}</span><span className="wallet-activity-name"><b>{item.name}</b><small>{new Date(item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} · {item.reference}</small></span><span className="wallet-activity-type">{item.kind === 'rewards' ? 'Rewards' : item.kind === 'payouts' ? 'Payout' : 'Cashback'}</span><strong>{item.amount}</strong><span className={`wallet-status ${['available','paid','confirmed'].includes(item.status.toLowerCase()) ? 'confirmed' : ['rejected','reversed','failed'].includes(item.status.toLowerCase()) ? 'rejected' : 'pending'}`}>{item.status.replaceAll('_', ' ')}</span></div>)}</div> : <div className="wallet-activity-empty">No {tab === 'all' ? '' : `${tab} `}activity yet.</div>}
    </section>
    <section id="request-payout" className="payout-request"><div><p>REQUEST A PAYOUT</p><h2>Withdraw confirmed cashback</h2><span>Only available cashback can be requested. A verified payout method and approval are required.</span></div><form action={requestWithdrawal}><label>Amount<input name="amount" type="number" min="100" max={availableCashback} step="0.01" required disabled={availableCashback < 100} placeholder="Minimum ₹100"/></label><label>UPI ID<input name="upiId" required maxLength={100} disabled={availableCashback < 100} placeholder="name@bank"/></label>{availableCashback >= 100 && <SimpleCaptcha/>}<button type="submit" className="primary" disabled={availableCashback < 100}>{availableCashback < 100 ? 'Minimum ₹100 required' : 'Request payout'}</button></form></section>
    <CmsManagedSections pageKey="wallet" slot="page_end"/>
  </main></>;
}
