import Link from 'next/link';
import { Header } from '@/components/header';
import { createClient } from '@/lib/supabase/server';
import { requestWithdrawal } from './actions';
import { SimpleCaptcha } from '@/components/simple-captcha';

type Props = { searchParams: Promise<{ error?: string; success?: string }> };
const money = (value: number) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function WalletPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: claims }, { data: entries }, { data: withdrawals }] = await Promise.all([
    supabase.from('cashback_claims').select('id,order_reference,claimed_amount,status,created_at').order('created_at', { ascending: false }),
    supabase.from('wallet_entries').select('id,amount,entry_type,note,created_at').order('created_at', { ascending: false }),
    supabase.from('withdrawal_requests').select('id,amount,status,upi_id,created_at').order('created_at', { ascending: false }),
  ]);
  const ledger = (entries ?? []).reduce((total, entry) => total + Number(entry.amount), 0);
  const reserved = (withdrawals ?? []).filter((withdrawal) => ['requested', 'on_hold', 'approved'].includes(withdrawal.status)).reduce((total, withdrawal) => total + Number(withdrawal.amount), 0);
  const available = Math.max(0, ledger - reserved);
  const pendingClaims = (claims ?? []).filter((claim) => ['submitted', 'needs_info'].includes(claim.status)).reduce((total, claim) => total + Number(claim.claimed_amount ?? 0), 0);

  return <><Header/><main className="info-page"><section className="info-hero"><p className="eyebrow">MY SPACE · CASHBACK &amp; WALLET</p><h1>Your Glonni Wallet</h1><p>Only provider-confirmed cashback is available to withdraw. Requests are manually reviewed; no automatic money transfer is active.</p></section>
    {params.error && <p className="auth-notice error">{params.error}</p>}{params.success && <p className="auth-notice success">{params.success}</p>}
    <section className="wallet-card"><div><p className="eyebrow">LIVE WALLET</p><h2>{money(available)}</h2><p>Available confirmed cashback</p></div><div className="wallet-balances"><article><small>In review</small><b>{money(pendingClaims)}</b><span>Merchant eligibility pending</span></article><article><small>Reserved for withdrawal</small><b>{money(reserved)}</b><span>Requests under review</span></article><article><small>Wallet ledger</small><b>{money(ledger)}</b><span>Confirmed credits minus reversals</span></article></div></section>
    <section className="info-content"><h2>Request a withdrawal</h2><form action={requestWithdrawal} className="support-form"><label>Amount available to withdraw<input name="amount" type="number" min="100" max={available} step="0.01" required placeholder="Minimum ₹100"/></label><label>UPI ID<input name="upiId" required maxLength={100} placeholder="name@bank"/></label><small>We verify payout details during manual review. Your request does not move money automatically.</small><SimpleCaptcha/><button className="primary" type="submit">Request withdrawal</button></form>
      <h2>Cashback claims</h2>{(claims ?? []).length === 0 ? <p>You have no cashback claims yet. <Link href="/cashback-claim">Report missing cashback</Link> only where an eligible offer showed Glonni Cashback.</p> : <ul>{(claims ?? []).map((claim) => <li key={claim.id}><b>{money(Number(claim.claimed_amount ?? 0))}</b> · Order {claim.order_reference} · <strong>{claim.status.replace('_', ' ')}</strong></li>)}</ul>}
      <h2>Withdrawal history</h2>{(withdrawals ?? []).length === 0 ? <p>No withdrawal requests yet.</p> : <ul>{(withdrawals ?? []).map((withdrawal) => <li key={withdrawal.id}><b>{money(Number(withdrawal.amount))}</b> · {withdrawal.status.replace('_', ' ')} · UPI ending in {withdrawal.upi_id.slice(-4)}</li>)}</ul>}
      <h2>Wallet activity</h2>{(entries ?? []).length === 0 ? <p>No confirmed wallet credits yet.</p> : <ul>{(entries ?? []).map((entry) => <li key={entry.id}><b>{money(Number(entry.amount))}</b> · {entry.note || entry.entry_type.replaceAll('_', ' ')}</li>)}</ul>}
      <p><Link href="/account">← Back to Profile</Link> · <Link href="/cashback-guide">Cashback guide</Link></p>
    </section></main></>;
}
