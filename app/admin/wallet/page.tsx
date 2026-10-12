import Link from 'next/link';
import { AlertTriangle, ArrowRight, BadgeCheck, Banknote, CircleDollarSign, Clock3, Download, ReceiptText, Search, WalletCards } from 'lucide-react';
import { AdminSidebar } from '@/components/admin-sidebar';
import { createClient } from '@/lib/supabase/server';
import { readOperationalRows } from '@/lib/admin-operational-data';
import { summarizeWallet, type ConversionBalance } from '@/lib/wallet-balances';
import { getProviderCommissionReport } from '@/lib/provider-commission-report';
import type { CommissionSummary } from '@/lib/admin-finance';

export const dynamic = 'force-dynamic';
type Identity = { profile_id: string; profiles: { display_name: string | null } | null };
type Entry = Identity & { id: string; amount: number | string; entry_type: string; note: string | null; created_at: string };
type Withdrawal = Identity & { id: string; amount: number | string; status: string; risk_level: string | null; created_at: string };
type Award = Identity & { id: string; conversion_id: string; amount: number | string; status: string; currency: string };
type Conversion = Identity & ConversionBalance & { currency: string };
const money = (n: number, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);
const commissionAmount = (row: CommissionSummary, value: number) => row.unpricedOrders ? '—' : money(value, row.currency);
function Metric({ label, value, note, icon: Icon = WalletCards }: { label: string; value: string; note: string; icon?: typeof WalletCards }) {
  return <article className="wallet-metric blue"><div><Icon/></div><span>{label}</span><b>{value}</b><small>{note}</small></article>;
}

export default async function AdminWalletPage({ searchParams }: { searchParams: Promise<{ q?: string; view?: string }> }) {
  const query = await searchParams;
  const supabase = await createClient();
  const [entryResult, withdrawalResult, awardResult, conversionResult, riskResult, report] = await Promise.all([
    readOperationalRows<Entry>(supabase, 'wallet_entries', 'id,profile_id,amount,entry_type,note,created_at,profiles!profile_id(display_name)'),
    readOperationalRows<Withdrawal>(supabase, 'withdrawal_requests', 'id,profile_id,amount,status,risk_level,created_at,profiles!profile_id(display_name)'),
    readOperationalRows<Award>(supabase, 'cashback_awards', 'id,profile_id,conversion_id,amount,status,currency,profiles!profile_id(display_name)'),
    readOperationalRows<Conversion>(supabase, 'referral_conversions', 'id,profile_id,status,currency,reward_type_snapshot,reward_points_snapshot,cashback_fixed_snapshot,cashback_percent_snapshot,cashback_cap_snapshot,order_value,profiles!profile_id(display_name)'),
    readOperationalRows<{ id: string }>(supabase, 'financial_risk_signals', 'id'),
    getProviderCommissionReport(),
  ]);
  const failed = [entryResult, withdrawalResult, awardResult, conversionResult].some(result => result.failed);
  const entries = entryResult.rows, withdrawals = withdrawalResult.rows;
  const awards = awardResult.rows.filter(row => row.currency === 'INR'), conversions = conversionResult.rows.filter(row => row.currency === 'INR');
  const foreign = awardResult.rows.some(row => row.currency !== 'INR') || conversionResult.rows.some(row => row.currency !== 'INR');
  const summary = summarizeWallet(entries, withdrawals, awards, [], conversions);
  const confirmed = entries.filter(row => row.entry_type === 'cashback_confirmed').reduce((n, row) => n + Number(row.amount), 0);
  const paid = -entries.filter(row => row.entry_type === 'withdrawal_paid').reduce((n, row) => n + Number(row.amount), 0);
  const reserved = withdrawals.filter(row => ['requested', 'on_hold', 'approved', 'batched', 'processing'].includes(row.status)).reduce((n, row) => n + Number(row.amount), 0);
  const profileIds = [...new Set([...entries, ...withdrawals, ...awards, ...conversions].map(row => row.profile_id).filter(Boolean))];
  const wallets = profileIds.map(id => {
    const records = [...entries, ...withdrawals, ...awards, ...conversions].filter(row => row.profile_id === id);
    const accountEntries = entries.filter(row => row.profile_id === id), requests = withdrawals.filter(row => row.profile_id === id);
    return { id, name: records[0]?.profiles?.display_name || 'Customer', ...summarizeWallet(accountEntries, requests, awards.filter(row => row.profile_id === id), [], conversions.filter(row => row.profile_id === id)), reserved: requests.filter(row => ['requested', 'on_hold', 'approved', 'batched', 'processing'].includes(row.status)).reduce((n, row) => n + Number(row.amount), 0) };
  });
  // Availability is summed per customer; a negative ledger never offsets somebody else's wallet.
  const available = wallets.reduce((n, row) => n + row.availableCashback, 0);
  const matches = (value: string) => !query.q || value.toLowerCase().includes(query.q.toLowerCase());
  const shownWallets = wallets.filter(row => matches(row.name + ' ' + row.id));
  const matchingEntries = entries.filter(row => matches(row.id + ' ' + row.profile_id + ' ' + (row.profiles?.display_name ?? '') + ' ' + (row.note ?? ''))).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const transactions = query.view === 'all-transactions' ? matchingEntries : matchingEntries.slice(0, 20);
  const commissions = report.summaries.filter(row => matches(row.name));
  const amount = (value: number) => failed ? '—' : money(value);
  return <main className="admin-v2"><AdminSidebar/><section className="admin-main"><main className="admin-content wallet-admin-page">
    <header className="wallet-page-heading"><div><p>FINANCIAL OPERATIONS</p><h1>Wallets &amp; Payouts</h1><span>Recorded commissions, cashback awards, wallet entries and withdrawal requests.</span></div></header>
    <nav className="wallet-page-tabs"><Link href="#affiliate-receivables">Affiliate reports</Link><Link href="#user-wallets">User wallets</Link><Link href="#payout-operations">Payout requests</Link><Link href="#transactions">Transactions</Link><Link href="/admin/reconciliation">Financial validation</Link><Link href="/admin/reward-points">Reward points</Link></nav>
    {failed && <p className="preview-note" role="alert">Some wallet records could not be loaded. Balance totals are unavailable; refresh to retry.</p>}
    {foreign && <p className="preview-note">Customer cashback figures below are INR only. Other currencies are not converted or combined.</p>}
    <section id="affiliate-receivables" className="wallet-section"><div className="wallet-section-title"><div><h2>Affiliate commission reports</h2><p>Provider-reported commission is separate from customer cashback and does not prove payment receipt.</p></div><Link href="/admin/providers">Manage providers <ArrowRight/></Link></div>
      <article id="provider-payments" className="wallet-table-card"><header><h3>Reported conversions by provider and currency</h3><Link className="wallet-export" href="/admin/wallet/export/providers"><Download/>Export real records</Link></header><div className="wallet-table-scroll"><table><thead><tr><th>PROVIDER</th><th>CURRENCY</th><th>ORDERS</th><th>REPORTED</th><th>VALIDATED</th><th>AWAITING VALIDATION</th><th>HELD</th><th>REJECTED / CANCELLED</th><th>ACTION</th></tr></thead><tbody>{commissions.map(row => <tr key={`${row.providerId}:${row.currency}`}><td><strong>{row.name}</strong></td><td>{row.currency}</td><td>{row.orders}{row.unpricedOrders > 0 && <small>{row.unpricedOrders} missing commission amount</small>}</td><td>{commissionAmount(row, row.reported)}</td><td>{commissionAmount(row, row.approved)}</td><td>{commissionAmount(row, row.pending)}</td><td>{commissionAmount(row, row.held)}</td><td>{commissionAmount(row, row.rejected)}</td><td>{row.providerId ? <Link href={`/admin/wallet/providers/${row.providerId}`}>View report</Link> : <Link href="/admin/orders">Match provider</Link>}</td></tr>)}{!commissions.length && <tr><td colSpan={9}>{report.failed ? 'Commission records could not be loaded.' : 'No provider conversions have been reported yet.'}</td></tr>}</tbody></table></div><footer>Dashes indicate incomplete commission amounts. Bank receipts and payment due dates are not tracked; no received-payment figures are estimated.</footer></article>
    </section>
    <section id="user-wallets" className="wallet-section"><div className="wallet-section-title"><div><h2>Customer cashback wallets</h2><p>Balances calculated from the complete recorded ledger and open withdrawals.</p></div></div>
      <div className="wallet-metrics-grid"><Metric icon={BadgeCheck} label="Cashback credits recorded" value={amount(confirmed)} note="Before reversals and payouts"/><Metric icon={Clock3} label="Pending cashback awards" value={amount(summary.pendingCashback)} note="Pending and held awards"/><Metric label="Available to withdraw" value={amount(available)} note="Net ledger less open withdrawals"/><Metric icon={Banknote} label="Reserved withdrawals" value={amount(reserved)} note="Requested, held or processing"/><Metric icon={ReceiptText} label="Payout debits recorded" value={amount(paid)} note="Recorded withdrawal ledger entries"/><Metric icon={CircleDollarSign} label="Tracking estimate" value={amount(summary.trackingCashback)} note="Not yet a wallet credit"/></div>
      <article className="wallet-table-card"><header><h3>Recorded customer balances</h3><form action="/admin/wallet"><Search/><input name="q" defaultValue={query.q} placeholder="Search customer or transaction" aria-label="Search wallet records"/><button>Search</button></form></header><div className="wallet-table-scroll"><table><thead><tr><th>CUSTOMER</th><th>PENDING AWARDS</th><th>TRACKING ESTIMATE</th><th>AVAILABLE</th><th>RESERVED WITHDRAWALS</th><th>ACTION</th></tr></thead><tbody>{shownWallets.map(row => <tr key={row.id}><td><strong>{row.name}</strong><small>{row.id}</small></td><td>{amount(row.pendingCashback)}</td><td>{amount(row.trackingCashback)}</td><td>{amount(row.availableCashback)}</td><td>{amount(row.reserved)}</td><td><Link href={`/admin/users/${row.id}/wallet`}>Open customer wallet</Link></td></tr>)}{!shownWallets.length && <tr><td colSpan={6}>{failed ? 'Wallet records unavailable.' : 'No wallet records match this view.'}</td></tr>}</tbody></table></div><footer>Reward points are managed separately. Missing-order claim amounts are not included as spendable cashback.</footer></article>
    </section>
    <section id="payout-operations" className="wallet-section"><div className="wallet-section-title"><div><h2>Payout requests &amp; financial review</h2><p>No real transfers are initiated by this overview.</p></div></div><div className="wallet-review-grid"><article><header><h3>Withdrawal queue</h3><Link href="/admin/payout-operations">Open payout operations <ArrowRight/></Link></header>{[['requested', 'Requested'], ['on_hold', 'On hold'], ['processing', 'Processing'], ['failed', 'Failed'], ['paid', 'Paid']].map(([key, title]) => <p key={key}><Clock3/><span><b>{title}</b><small>Recorded withdrawal status</small></span><strong>{withdrawalResult.failed ? '—' : withdrawals.filter(row => row.status === key).length}</strong></p>)}</article><article><header><h3>Review queues</h3></header><p><AlertTriangle/><span><b>Financial risk signals</b><small>Recorded signals, not an open-case count</small></span><strong>{riskResult.failed ? '—' : riskResult.rows.length}</strong></p><Link href="/admin/reconciliation">Review commission and cashback validation <ArrowRight/></Link><br/><Link href="/admin/reported-orders">Review customer claims <ArrowRight/></Link></article></div></section>
    <section id="transactions" className="wallet-section"><article className="wallet-table-card"><header><div><h3>Recent wallet transactions</h3><p>Recorded credits, debits and reversals.</p></div><Link href="?view=all-transactions#transactions">View all transactions</Link></header><div className="wallet-table-scroll"><table><thead><tr><th>TRANSACTION</th><th>CUSTOMER</th><th>TYPE</th><th>REFERENCE</th><th>CREDIT</th><th>DEBIT</th><th>CREATED</th></tr></thead><tbody>{transactions.map(row => <tr key={row.id}><td>{row.id.slice(0, 8)}</td><td>{row.profiles?.display_name || 'Customer'}</td><td>{row.entry_type.replaceAll('_', ' ')}</td><td>{row.note || '—'}</td><td>{Number(row.amount) > 0 ? money(Number(row.amount)) : '—'}</td><td>{Number(row.amount) < 0 ? money(-Number(row.amount)) : '—'}</td><td>{new Date(row.created_at).toLocaleString('en-IN')}</td></tr>)}{!transactions.length && <tr><td colSpan={7}>{entryResult.failed ? 'Transactions could not be loaded.' : 'No wallet transactions match this view.'}</td></tr>}</tbody></table></div><footer>{transactions.length} of {matchingEntries.length} matching entries. Empty records are never replaced with sample transactions.</footer></article></section>
  </main></section></main>;
}
