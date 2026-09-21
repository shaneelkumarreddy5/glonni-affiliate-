import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminSidebar } from '@/components/admin-sidebar';
import { Activity, ArrowLeft, Headphones, WalletCards } from 'lucide-react';
import { customerRecord, money, when } from '@/lib/admin-customers';

export default async function UserSectionPage({ params }: { params: Promise<{ userId: string; section: string }> }) {
  const { userId, section } = await params;
  if (!['activity', 'wallet', 'support'].includes(section)) notFound();
  const customer = await customerRecord(userId);
  const name = customer.profile.display_name?.trim() || 'Unnamed customer';
  const config = section === 'activity'
    ? { title: 'Customer activity', subtitle: 'Recorded actions by this customer.', icon: Activity, headings: ['TIME', 'ACTION', 'SURFACE', 'PAGE', 'STATUS'], rows: customer.activity.map(row => [when(row.occurred_at), row.event_type.replaceAll('_', ' '), row.surface, row.endpoint || '—', row.request_status ? String(row.request_status) : 'Recorded']) }
    : section === 'wallet'
      ? { title: 'Wallet and payouts', subtitle: 'This customer’s wallet ledger and payout requests.', icon: WalletCards, headings: ['DATE', 'ENTRY', 'REFERENCE', 'AMOUNT', 'STATUS'], rows: [...customer.entries.map(row => ({ date: row.created_at, cells: [when(row.created_at), row.entry_type.replaceAll('_', ' '), row.note || 'Wallet ledger', money(Number(row.amount)), 'Recorded'] })), ...customer.withdrawals.map(row => ({ date: row.created_at, cells: [when(row.created_at), 'Withdrawal request', row.id, money(Number(row.amount)), row.status.replaceAll('_', ' ')] }))].sort((a, b) => b.date.localeCompare(a.date)).map(row => row.cells) }
      : { title: 'Support history', subtitle: 'Cases belonging to this customer.', icon: Headphones, headings: ['CASE', 'SUBJECT', 'CATEGORY', 'STATUS', 'UPDATED'], rows: customer.tickets.map(row => [`#${row.ticket_number}`, row.subject, row.category, row.status.replaceAll('_', ' '), when(row.updated_at)]) };
  const Icon = config.icon;
  return <main className="admin-v2"><AdminSidebar/><section className="admin-main"><main className="admin-content user-section-page">
    <div className="user-section-nav"><Link href={`/admin/users/${userId}`}><ArrowLeft/>Back to {name}</Link><span>{name} · {userId}</span></div>
    <div className="admin-title"><div><p>CUSTOMER RECORD</p><h1>{config.title}</h1><span>{config.subtitle}</span></div><Icon/></div>
    <nav className="user-record-tabs" aria-label="Customer record sections"><Link href={`/admin/users/${userId}`}>Overview</Link><Link className={section === 'activity' ? 'current' : ''} href={`/admin/users/${userId}/activity`}>Activity</Link><Link className={section === 'wallet' ? 'current' : ''} href={`/admin/users/${userId}/wallet`}>Wallet &amp; payouts</Link><Link className={section === 'support' ? 'current' : ''} href={`/admin/users/${userId}/support`}>Support</Link></nav>
    {section === 'wallet' && !customer.walletUnavailable && <div className="profile-money-grid"><p><small>Available</small><b>{money(customer.wallet.available)}</b></p><p><small>Pending cashback</small><b>{money(customer.wallet.pending)}</b></p><p><small>Lifetime confirmed</small><b>{money(customer.wallet.lifetime)}</b></p><p><small>Total withdrawn</small><b>{money(customer.wallet.withdrawn)}</b></p></div>}
    <article className="store-table"><div className="table-head"><div><span className="current">{config.rows.length} recorded items</span></div></div><div className="table-scroll"><table><thead><tr>{config.headings.map(heading => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{(section === 'wallet' && customer.walletUnavailable) || (section === 'activity' && customer.activityUnavailable) || (section === 'support' && customer.supportUnavailable) ? <tr><td colSpan={5}>These {section} records could not be loaded.</td></tr> : config.rows.length ? config.rows.map((row, index) => <tr key={`${row[0]}-${index}`}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>) : <tr><td colSpan={5}>No {section} records are available for this customer.</td></tr>}</tbody></table></div><footer>Only records linked to {name} are shown. Up to 100 recent activity or support records are displayed.</footer></article>
  </main></section></main>;
}
