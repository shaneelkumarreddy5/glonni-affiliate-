import { notFound } from 'next/navigation';
import { AdminSidebar } from '@/components/admin-sidebar';
import { Activity, ArrowLeft, Headphones, WalletCards } from 'lucide-react';

const activityRows = [
  ['Today, 7:42 PM', 'Viewed Electronics offer', 'Product GLN-2491', 'Web session', 'Successful'],
  ['Today, 7:39 PM', 'Saved a deal', 'Product GLN-2491', 'Web session', 'Successful'],
  ['Today, 7:31 PM', 'Signed in successfully', 'Account authentication', 'Recognised device', 'Successful'],
  ['Yesterday, 6:18 PM', 'Created a price alert', 'Target ₹1,499', 'Mobile session', 'Active'],
];
const walletRows = [
  ['08 Sep 2026', 'Cashback confirmed', 'Myntra order GLN-8321', '+₹125', 'Confirmed'],
  ['04 Sep 2026', 'Cashback pending', 'Amazon order GLN-8214', '+₹385', 'Pending'],
  ['28 Aug 2026', 'Withdrawal to bank ••••4321', 'Payout PAY-1049', '−₹800', 'Paid'],
];
const supportRows = [
  ['SUP-1042', 'Missing cashback claim', 'Myntra · Order GLN-8321', 'Open', 'Yesterday'],
  ['SUP-0987', 'Price alert question', 'Electronics offer', 'Resolved', '12 Aug 2026'],
];

export default async function UserSectionPage({ params }: { params: Promise<{ userId: string; section: string }> }) {
  const { userId, section } = await params;
  if (!['activity', 'wallet', 'support'].includes(section)) notFound();
  const config = section === 'activity'
    ? { title: 'Customer activity', subtitle: 'Actions performed by this customer across Glonni.', icon: Activity, headings: ['TIME', 'ACTION', 'CONTEXT', 'SESSION', 'STATUS'], rows: activityRows }
    : section === 'wallet'
      ? { title: 'Wallet and payouts', subtitle: 'This customer’s cashback ledger and payout history.', icon: WalletCards, headings: ['DATE', 'ENTRY', 'REFERENCE', 'AMOUNT', 'STATUS'], rows: walletRows }
      : { title: 'Support history', subtitle: 'Cases and conversations belonging to this customer.', icon: Headphones, headings: ['CASE', 'SUBJECT', 'CONTEXT', 'STATUS', 'UPDATED'], rows: supportRows };
  const Icon = config.icon;
  return <main className="admin-v2"><AdminSidebar/><section className="admin-main"><main className="admin-content user-section-page">
    <div className="user-section-nav"><a href={`/admin/users/${userId}`}><ArrowLeft/>Back to Ananya Sharma</a><span>Ananya Sharma · {userId}</span></div>
    <div className="admin-title"><div><p>CUSTOMER RECORD</p><h1>{config.title}</h1><span>{config.subtitle}</span></div><Icon/></div>
    <nav className="user-record-tabs" aria-label="Customer record sections"><a href={`/admin/users/${userId}`}>Overview</a><a className={section === 'activity' ? 'current' : ''} href={`/admin/users/${userId}/activity`}>Activity</a><a className={section === 'wallet' ? 'current' : ''} href={`/admin/users/${userId}/wallet`}>Wallet &amp; payouts</a><a className={section === 'support' ? 'current' : ''} href={`/admin/users/${userId}/support`}>Support</a></nav>
    <article className="store-table"><div className="table-head"><div><a className="current">All records</a></div></div><div className="table-scroll"><table><thead><tr>{config.headings.map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{config.rows.map((row, index) => <tr key={`${row[0]}-${index}`}>{row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`}>{cellIndex === row.length - 1 ? <em className={['Successful', 'Active', 'Confirmed', 'Paid', 'Resolved'].includes(cell) ? 'status-active' : 'status-paused'}>{cell}</em> : cell}</td>)}</tr>)}</tbody></table></div><footer>Showing records for {userId} only. Platform-wide audit events remain in Activity &amp; Audit Log.</footer></article>
  </main></section></main>;
}
