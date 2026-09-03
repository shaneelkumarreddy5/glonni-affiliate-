import Link from 'next/link';
import { ArrowUpRight, CalendarDays, CircleAlert, Clock3, Landmark, Search, ShieldCheck, WalletCards } from 'lucide-react';
import { Header } from '@/components/header';
import { createClient } from '@/lib/supabase/server';
import { requestWithdrawal } from './actions';
import { SimpleCaptcha } from '@/components/simple-captcha';
import { ReferralShare } from './referral-share';
import './wallet.css';
import './referral.css';

type Props = { searchParams: Promise<{ error?: string; success?: string; tab?: string; q?: string }> };
type Claim = { id: string; order_reference: string; claimed_amount: number | null; purchase_amount: number | null; status: string; created_at: string; offers: { merchants: { name: string } | null } | null };
type Entry = { id: string; amount: number; entry_type: string; note: string | null; created_at: string };
type Withdrawal = { id: string; amount: number; status: string; upi_id: string; created_at: string; reviewer_note: string | null };
type ReferralCode = { code: string };
type Referral = { id: string; status: string; reward_amount: number | null; created_at: string; qualified_at: string | null };
const money = (value: number) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const outstanding = ['requested', 'on_hold', 'approved'];
const tabValues = ['transactions', 'withdrawals', 'referrals'] as const;

export default async function WalletPage({ searchParams }: Props) {
  const params = await searchParams;
  const tab = tabValues.includes(params.tab as typeof tabValues[number]) ? params.tab as typeof tabValues[number] : 'transactions';
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: rawClaims }, { data: rawEntries }, { data: rawWithdrawals }, { data: rawReferralCode }, { data: rawReferrals }] = await Promise.all([
    supabase.from('cashback_claims').select('id,order_reference,claimed_amount,purchase_amount,status,created_at,offers(merchants(name))').order('created_at', { ascending: false }).limit(100),
    supabase.from('wallet_entries').select('id,amount,entry_type,note,created_at').order('created_at', { ascending: false }).limit(100),
    supabase.from('withdrawal_requests').select('id,amount,status,upi_id,created_at,reviewer_note').order('created_at', { ascending: false }).limit(100),
    supabase.from('customer_referral_codes').select('code').maybeSingle(),
    supabase.from('customer_referrals').select('id,status,reward_amount,created_at,qualified_at').eq('referrer_profile_id', user.id).order('created_at', { ascending: false }).limit(100),
  ]);
  const claims = (rawClaims ?? []) as unknown as Claim[];
  const entries = (rawEntries ?? []) as Entry[];
  const withdrawals = (rawWithdrawals ?? []) as Withdrawal[];
  const referralCode = (rawReferralCode as ReferralCode | null)?.code || null;
  const referrals = (rawReferrals ?? []) as Referral[];
  const ledger = entries.reduce((total, entry) => total + Number(entry.amount), 0);
  const reserved = withdrawals.filter((item) => outstanding.includes(item.status)).reduce((total, item) => total + Number(item.amount), 0);
  const available = Math.max(0, ledger - reserved);
  const pending = claims.filter((item) => ['submitted', 'needs_info'].includes(item.status)).reduce((total, item) => total + Number(item.claimed_amount ?? 0), 0);
  const lifetime = entries.filter((item) => item.entry_type === 'cashback_confirmed').reduce((total, item) => total + Math.max(0, Number(item.amount)), 0);
  const query = params.q?.trim().toLowerCase() || '';
  const filteredClaims = claims.filter((item) => !query || `${item.order_reference} ${item.offers?.merchants?.name ?? ''} ${item.status}`.toLowerCase().includes(query));

  return <><Header/><main className="wallet-page">
    <nav className="wallet-crumb"><Link href="/">Home</Link><span>›</span><Link href="/account?section=wallet">Profile</Link><span>›</span><b>Wallet &amp; Payouts</b></nav>
    <header className="wallet-heading"><p>GLONNI REWARDS</p><h1>Wallet &amp; Payouts</h1><span>See cashback progress, request a payout when eligible, and keep every reward record in one place.</span></header>
    {params.error && <p className="auth-notice error">{params.error}</p>}{params.success && <p className="auth-notice success">{params.success}</p>}
    <section className="wallet-summary">
      <article className="withdrawable-card"><WalletCards/><div><small>Available to withdraw</small><b>{money(available)}</b><span>Confirmed cashback after payout holds</span></div><a href="#request-payout">Request payout <ArrowUpRight size={15}/></a></article>
      <article><Clock3/><div><small>Pending cashback</small><b>{money(pending)}</b><span>Awaiting merchant confirmation</span></div></article>
      <article><Landmark/><div><small>Lifetime earnings</small><b>{money(lifetime)}</b><span>Confirmed cashback credits</span></div></article>
    </section>
    <p className="wallet-rule"><ShieldCheck/>Only cashback confirmed by the merchant and cleared for payout is withdrawable.</p>
    <section className="wallet-history">
      <header className="history-top"><div className="history-tabs"><Link href="/wallet?tab=transactions" className={tab === 'transactions' ? 'active' : ''}>Transaction history</Link><Link href="/wallet?tab=withdrawals" className={tab === 'withdrawals' ? 'active' : ''}>Withdrawal history</Link><Link href="/wallet?tab=referrals" className={tab === 'referrals' ? 'active' : ''}>Referral history</Link></div>{tab === 'transactions' && <form className="wallet-search" action="/wallet"><input type="hidden" name="tab" value="transactions"/><Search size={16}/><input name="q" defaultValue={params.q || ''} placeholder="Search order or store"/><button>Search</button></form>}</header>
      {tab === 'transactions' && <Transactions claims={filteredClaims}/>} {tab === 'withdrawals' && <Withdrawals withdrawals={withdrawals}/>} {tab === 'referrals' && <Referrals code={referralCode} referrals={referrals}/>}
    </section>
    <section id="request-payout" className="payout-request"><div><p>REQUEST A PAYOUT</p><h2>Withdraw confirmed cashback</h2><span>KYC and a verified payout method will be required before live payout execution is switched on.</span></div><form action={requestWithdrawal}><label>Amount<input name="amount" type="number" min="100" max={available} step="0.01" required placeholder="Minimum ₹100"/></label><label>UPI ID<input name="upiId" required maxLength={100} placeholder="name@bank"/></label><SimpleCaptcha/><button type="submit" className="primary">Request payout</button></form></section>
  </main></>;
}

function Status({ value }: { value: string }) { const label = value.replaceAll('_', ' '); const tone = ['confirmed', 'paid'].includes(value) ? 'confirmed' : ['submitted', 'requested', 'approved'].includes(value) ? 'pending' : value === 'on_hold' ? 'hold' : ['rejected', 'reversed'].includes(value) ? 'rejected' : 'neutral'; return <span className={`wallet-status ${tone}`}>{label}</span>; }
function Transactions({ claims }: { claims: Claim[] }) { return claims.length ? <div className="wallet-table-wrap"><table className="wallet-table"><thead><tr><th>Date</th><th>Store / description</th><th>Order ID</th><th>Purchase amount</th><th>Cashback</th><th>Status</th></tr></thead><tbody>{claims.map((item) => <tr key={item.id}><td>{new Date(item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td><td><b>{item.offers?.merchants?.name || 'Store pending'}</b><small>Cashback claim</small></td><td>{item.order_reference}</td><td>{item.purchase_amount ? money(Number(item.purchase_amount)) : '—'}</td><td className="cashback-amount">{money(Number(item.claimed_amount ?? 0))}</td><td><Status value={item.status}/></td></tr>)}</tbody></table></div> : <Empty icon={<CircleAlert/>} title="No cashback transactions yet" text="Eligible cashback transactions will appear here after you shop through a tracked Glonni offer."/>; }
function Withdrawals({ withdrawals }: { withdrawals: Withdrawal[] }) { return withdrawals.length ? <div className="wallet-table-wrap"><table className="wallet-table"><thead><tr><th>Requested</th><th>Destination</th><th>Amount</th><th>Status</th><th>Review note</th></tr></thead><tbody>{withdrawals.map((item) => <tr key={item.id}><td>{new Date(item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td><td>UPI ••••{item.upi_id.slice(-4)}</td><td className="cashback-amount">{money(Number(item.amount))}</td><td><Status value={item.status}/></td><td>{item.reviewer_note || 'Awaiting review'}</td></tr>)}</tbody></table></div> : <Empty icon={<Landmark/>} title="No payout requests yet" text="When you request a payout, its review and payment status will appear here."/>; }
function Referrals({ code, referrals }: { code: string | null; referrals: Referral[] }) { return <div className="referral-panel">{code ? <section className="referral-share-card"><div><p>YOUR REFERRAL CODE</p><h2>{code}</h2><span>Share your link. A referral is recorded only when a new customer creates an account through it.</span></div><ReferralShare code={code}/></section> : <div className="wallet-empty"><CalendarDays/><div><h2>Preparing your referral link</h2><p>Your personal code will appear here after the referral system is connected to the database.</p></div></div>}<section className="referral-stats"><article><small>Joined</small><b>{referrals.filter((item) => item.status === 'joined').length}</b><span>New members</span></article><article><small>Qualified</small><b>{referrals.filter((item) => ['qualified', 'reward_pending', 'reward_confirmed'].includes(item.status)).length}</b><span>Rules completed</span></article><article><small>Rewards confirmed</small><b>{money(referrals.filter((item) => item.status === 'reward_confirmed').reduce((total, item) => total + Number(item.reward_amount ?? 0), 0))}</b><span>Not auto-credited</span></article></section>{referrals.length ? <div className="wallet-table-wrap"><table className="wallet-table"><thead><tr><th>Joined</th><th>Referral</th><th>Qualification</th><th>Reward status</th></tr></thead><tbody>{referrals.map((item) => <tr key={item.id}><td>{new Date(item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td><td>New Glonni member</td><td>{item.qualified_at ? new Date(item.qualified_at).toLocaleDateString('en-IN') : 'Awaiting programme rules'}</td><td><Status value={item.status}/></td></tr>)}</tbody></table></div> : <p className="referral-empty">No customers have joined through your referral link yet. Referral rewards are assessed only under the approved programme rules.</p>}</div>; }
function Empty({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="wallet-empty">{icon}<div><h2>{title}</h2><p>{text}</p></div></div>; }
