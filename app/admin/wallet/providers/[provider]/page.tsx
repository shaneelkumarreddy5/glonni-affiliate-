import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminSidebar } from '@/components/admin-sidebar';
import { customerAdminClient } from '@/lib/admin-customers';
import { getProviderCommissionReport } from '@/lib/provider-commission-report';

export default async function ProviderStatement({ params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const supabase = await customerAdminClient();
  const key = /^[0-9a-f-]{36}$/i.test(provider) ? 'id' : 'adapter_key';
  const { data: record, error } = await supabase.from('affiliate_providers').select('id,name,adapter_key').eq(key, provider).maybeSingle();
  if (error) throw new Error('Provider could not be loaded. Please retry.');
  if (!record) notFound();
  const report = await getProviderCommissionReport();
  const rows = report.summaries.filter(row => row.providerId === record.id);
  const money = (value: number, currency: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(value);
  return <div className="admin-v2"><AdminSidebar/><section className="admin-main"><main className="admin-content wallet-admin-page">
    <Link className="profile-back" href="/admin/wallet#provider-payments">← Back to provider reports</Link>
    <header className="wallet-page-heading"><div><p>PROVIDER COMMISSION REPORT</p><h1>{record.name}</h1><span>Recorded conversion commissions; no payment receipt is inferred.</span></div></header>
    <article className="wallet-table-card"><header><h3>Commission validation by currency</h3></header><div className="wallet-table-scroll"><table><thead><tr><th>CURRENCY</th><th>ORDERS</th><th>REPORTED</th><th>VALIDATED</th><th>AWAITING VALIDATION</th><th>HELD</th><th>REJECTED / CANCELLED</th></tr></thead><tbody>{rows.map(row => <tr key={row.currency}><td>{row.currency}</td><td>{row.orders}{row.unpricedOrders > 0 && <small>{row.unpricedOrders} missing commission amount</small>}</td><td>{row.unpricedOrders ? '—' : money(row.reported, row.currency)}</td><td>{row.unpricedOrders ? '—' : money(row.approved, row.currency)}</td><td>{row.unpricedOrders ? '—' : money(row.pending, row.currency)}</td><td>{row.unpricedOrders ? '—' : money(row.held, row.currency)}</td><td>{row.unpricedOrders ? '—' : money(row.rejected, row.currency)}</td></tr>)}{!rows.length && <tr><td colSpan={7}>{report.failed ? 'Commission records could not be loaded. Refresh to retry.' : 'No conversions have been reported for this provider.'}</td></tr>}</tbody></table></div><footer>Dashes indicate incomplete commission amounts. Bank receipts, settlement periods and due dates require a real statement source.</footer></article>
    <Link href="/admin/reconciliation">Open financial validation →</Link>
  </main></section></div>;
}
