import Link from 'next/link';
import { AdminSidebar } from '@/components/admin-sidebar';
import { Activity, ArrowLeft, CircleDollarSign, Headphones, MapPin, ShieldCheck, UserRound, WalletCards } from 'lucide-react';
import { customerRecord, money, when } from '@/lib/admin-customers';

export default async function AdminUserProfile({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const customer = await customerRecord(userId);
  const { profile, wallet, activity, tickets } = customer;
  const name = profile.display_name?.trim() || 'Unnamed customer';
  const location = [profile.city, profile.state].filter(Boolean).join(', ') || 'Not provided';
  return <main className="admin-v2"><AdminSidebar/><section className="admin-main"><main className="admin-content admin-user-profile">
    <Link className="profile-back" href="/admin/users"><ArrowLeft/>Back to users</Link>
    <header className="profile-page-head"><span className="profile-page-avatar">{name[0].toUpperCase()}</span><div><p>CUSTOMER PROFILE</p><h1>{name}</h1><span>{profile.id} · Joined {when(profile.created_at)}</span></div></header>
    <section className="profile-summary-grid">
      <article><UserRound/><span><small>Customer</small><b>{name}</b><em>Profile record</em></span></article>
      <article><MapPin/><span><small>Location</small><b>{location}</b><em>Customer-provided</em></span></article>
      <article><Headphones/><span><small>Open support cases</small><b>{customer.supportUnavailable ? 'Unavailable' : customer.openTickets}</b><em>{customer.supportUnavailable ? 'Support records could not be loaded' : customer.lastTicket ? `Last update ${when(customer.lastTicket)}` : 'No cases recorded'}</em></span></article>
      <article><ShieldCheck/><span><small>Verification</small><b>Not available</b><em>No verified KYC or payout record is connected here</em></span></article>
    </section>
    <section className="profile-detail-grid"><div className="profile-main-column">
      <article className="profile-section-card"><header><div><UserRound/><span><h2>Customer details</h2><p>Information present in this customer’s profile</p></span></div></header><div className="profile-data-grid"><p><small>Full name</small><b>{name}</b></p><p><small>Location</small><b>{location}</b></p><p><small>Joined</small><b>{when(profile.created_at)}</b></p><p><small>Customer ID</small><b>{profile.id}</b></p><p><small>Email &amp; mobile</small><b>Not available in admin profile</b></p><p><small>KYC / payout verification</small><b>Not connected</b></p></div></article>
      <article className="profile-section-card"><header><div><WalletCards/><span><h2>Wallet and payouts</h2><p>This customer’s recorded cashback and withdrawals</p></span></div><Link href={`/admin/users/${userId}/wallet`}>Open wallet →</Link></header>{customer.walletUnavailable ? <p>Wallet records could not be loaded.</p> : <div className="profile-money-grid"><p><small>Available</small><b>{money(wallet.available)}</b></p><p><small>Pending cashback</small><b>{money(wallet.pending)}</b></p><p><small>Lifetime confirmed</small><b>{money(wallet.lifetime)}</b></p><p><small>Total withdrawn</small><b>{money(wallet.withdrawn)}</b></p></div>}</article>
      <article className="profile-section-card"><header><div><Activity/><span><h2>Recent customer activity</h2><p>Recorded actions by this customer</p></span></div><Link href={`/admin/users/${userId}/activity`}>View activity →</Link></header><div className="profile-timeline">{customer.activityUnavailable ? <p>Activity records could not be loaded.</p> : activity.slice(0, 3).map(row => <p key={row.id}><i/><span><b>{row.event_type.replaceAll('_', ' ')}</b><small>{when(row.occurred_at)} · {row.surface}</small></span></p>)}{!customer.activityUnavailable && !activity.length && <p>No customer activity recorded yet.</p>}</div></article>
    </div><aside className="profile-side-column">
      <article className="profile-section-card"><header><div><CircleDollarSign/><span><h2>Shopping summary</h2><p>Customer-linked records</p></span></div></header><div className="profile-status-list"><p><span>Saved offers</span><strong>{customer.savedCount ?? 'Unavailable'}</strong></p><p><span>Active price alerts</span><strong>{customer.alertCount ?? 'Unavailable'}</strong></p><p><span>Tracked clicks</span><strong>{customer.clickCount ?? 'Unavailable'}</strong></p></div></article>
      <article className="profile-section-card"><header><div><Headphones/><span><h2>Support</h2><p>Cases and assistance for this customer</p></span></div></header><div className="profile-status-list"><p><span>Open cases</span><strong>{customer.supportUnavailable ? 'Unavailable' : customer.openTickets}</strong></p><p><span>Total cases</span><strong>{customer.supportUnavailable ? 'Unavailable' : tickets.length}</strong></p><p><span>Last update</span><strong>{customer.supportUnavailable ? 'Unavailable' : customer.lastTicket ? when(customer.lastTicket) : 'None'}</strong></p></div><Link className="profile-card-link" href={`/admin/users/${userId}/support`}>Open support history →</Link></article>
    </aside></section>
  </main></section></main>;
}
