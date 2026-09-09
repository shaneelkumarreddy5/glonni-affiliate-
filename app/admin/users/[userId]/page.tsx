import { AdminSidebar } from '@/components/admin-sidebar';
import { Activity, ArrowLeft, CalendarDays, CircleDollarSign, Headphones, Mail, MapPin, Phone, ShieldCheck, ShoppingBag, UserRound, Users, WalletCards } from 'lucide-react';

export default async function AdminUserProfile({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return <main className="admin-v2"><AdminSidebar/><section className="admin-main"><main className="admin-content admin-user-profile">
    <a className="profile-back" href="/admin/users"><ArrowLeft/>Back to users</a>
    <header className="profile-page-head"><span className="profile-page-avatar">A</span><div><p>CUSTOMER PROFILE</p><h1>Ananya Sharma <em>Active</em></h1><span>{userId} · Customer since 12 January 2024</span></div><div className="profile-head-actions"><button>Internal note</button><button>Review account</button></div></header>
    <section className="profile-summary-grid">
      <article><Mail/><span><small>Email</small><b>ananya.demo@glonni.test</b><em>Verified</em></span></article>
      <article><Phone/><span><small>Mobile</small><b>+91 98765 43210</b><em>Verified</em></span></article>
      <article><MapPin/><span><small>Location</small><b>Hyderabad, Telangana</b><em>Profile address</em></span></article>
      <article><ShieldCheck/><span><small>Account risk</small><b>Low risk</b><em>No active restrictions</em></span></article>
    </section>
    <section className="profile-detail-grid">
      <div className="profile-main-column">
        <article className="profile-section-card"><header><div><UserRound/><span><h2>Identity and verification</h2><p>Customer identity and payout readiness</p></span></div></header><div className="profile-data-grid"><p><small>Full name</small><b>Ananya Sharma</b></p><p><small>Email verification</small><b className="verified-text">Verified</b></p><p><small>Mobile verification</small><b className="verified-text">Verified</b></p><p><small>KYC status</small><b className="verified-text">Verified</b></p><p><small>Bank / UPI</small><b>•••• 4321 · Verified</b></p><p><small>Payout eligibility</small><b className="verified-text">Ready</b></p></div></article>
        <article className="profile-section-card"><header><div><WalletCards/><span><h2>Wallet and payouts</h2><p>Cashback balances and withdrawal history</p></span></div><a href="/admin/wallet">Open wallet records →</a></header><div className="profile-money-grid"><p><small>Available</small><b>₹1,090</b></p><p><small>Pending cashback</small><b>₹385</b></p><p><small>Lifetime earnings</small><b>₹12,430</b></p><p><small>Total withdrawn</small><b>₹11,340</b></p></div></article>
        <article className="profile-section-card"><header><div><Activity/><span><h2>Recent customer activity</h2><p>Actions recorded across Glonni</p></span></div><a href={`/admin/activity?user=${userId}`}>View complete activity →</a></header><div className="profile-timeline"><p><i/><span><b>Viewed Electronics offer</b><small>Today, 7:42 PM · Web session</small></span></p><p><i/><span><b>Saved a deal</b><small>Today, 7:39 PM · Product GLN-2491</small></span></p><p><i/><span><b>Signed in successfully</b><small>Today, 7:31 PM · Recognised device</small></span></p></div></article>
      </div>
      <aside className="profile-side-column">
        <article className="profile-section-card"><header><div><CircleDollarSign/><span><h2>Account status</h2><p>Operational readiness</p></span></div></header><div className="profile-status-list"><p><span>Account</span><b>Active</b></p><p><span>KYC</span><b>Verified</b></p><p><span>Wallet</span><b>Ready</b></p><p><span>Risk</span><b>Low</b></p></div></article>
        <article className="profile-section-card"><header><div><ShoppingBag/><span><h2>Shopping summary</h2><p>Customer engagement</p></span></div></header><div className="profile-status-list"><p><span>Saved deals</span><strong>3</strong></p><p><span>Price alerts</span><strong>2</strong></p><p><span>Tracked clicks</span><strong>7</strong></p><p><span>Referrals</span><strong>1</strong></p></div></article>
        <article className="profile-section-card"><header><div><Headphones/><span><h2>Support</h2><p>Cases and assistance</p></span></div></header><div className="profile-status-list"><p><span>Open cases</span><strong>2</strong></p><p><span>Last message</span><strong>1 day ago</strong></p></div><a className="profile-card-link" href="/admin/support">Open support history →</a></article>
        <article className="profile-section-card"><header><div><CalendarDays/><span><h2>Administrative actions</h2><p>Protected and audited</p></span></div></header><div className="profile-admin-actions"><button>Request KYC review</button><button>Restrict withdrawals</button><button className="danger-action">Suspend account</button></div></article>
      </aside>
    </section>
  </main></section></main>;
}
