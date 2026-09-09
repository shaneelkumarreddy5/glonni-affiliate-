import { AdminSidebar } from '@/components/admin-sidebar';
import { Activity, Bell, CalendarDays, CircleDollarSign, Clock3, Copy, ExternalLink, Headphones, Mail, MapPin, Phone, Search, ShieldCheck, TicketCheck, Users, WalletCards, X } from 'lucide-react';

const people = [
  ['Ananya Sharma', 'Hyderabad, Telangana', 'Active', '₹620', '2 alerts', 'ananya.demo@glonni.test'],
  ['Rohan Mehta', 'Mumbai, Maharashtra', 'Active', '₹145', '1 alert', 'rohan.demo@glonni.test'],
  ['Priya Nair', 'Bengaluru, Karnataka', 'Active', '₹0', '3 alerts', 'priya.demo@glonni.test'],
  ['Arjun Kapoor', 'Delhi NCR', 'Paused', '₹85', '0 alerts', 'arjun.demo@glonni.test'],
  ['Sneha Iyer', 'Chennai, Tamil Nadu', 'Active', '₹240', '2 alerts', 'sneha.demo@glonni.test'],
];

const registrations = [
  ['Karan Malhotra', '2 minutes ago'], ['Isha Verma', '12 minutes ago'],
  ['Aditya Rao', '28 minutes ago'], ['Neha Gupta', '1 hour ago'],
];

export default function AdminUsers() {
  return <main className="admin-v2"><AdminSidebar/><section className="admin-main">
    <header className="admin-top"><Users size={21}/><b>Users</b><span className="dashboard-date">Customer workspace · preview data</span><Bell size={19}/><span className="avatar">SR</span></header>
    <main className="admin-content users-page">
      <div className="admin-title"><div><p>CUSTOMER MANAGEMENT</p><h1>Users</h1><span>Understand customer engagement, cashback readiness and support context.</span></div></div>
      <section className="admin-stats">
        <article><Users/><div><small>Total shoppers</small><b>235,000+</b><em>Mock growth metric</em></div></article>
        <article><ShieldCheck/><div><small>Active accounts</small><b>98.4%</b><em>Preview metric</em></div></article>
        <article><CircleDollarSign/><div><small>Wallet activity</small><b>₹1,090</b><em>Demo customer balance</em></div></article>
        <article><Bell/><div><small>Active alerts</small><b>8</b><em>Across preview users</em></div></article>
        <article><TicketCheck/><div><small>Open tickets</small><b>1</b><em>Mock support queue</em></div></article>
      </section>
      <article className="store-table users-directory">
        <div className="table-head"><div><a className="current">All users</a><a>Active</a><a>Paused</a><a>Wallet activity</a></div><form><Search size={15}/><input placeholder="Search name, email or city…"/></form></div>
        <div className="table-scroll"><table><thead><tr><th>SHOPPER</th><th>LOCATION</th><th>WALLET</th><th>ALERTS</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{people.map((person) => <tr key={person[0]}><td><b className="store-initial">{person[0][0]}</b><span><strong>{person[0]}</strong><small>{person[5]}</small></span></td><td>{person[1]}</td><td>{person[3]}</td><td>{person[4]}</td><td><em className={person[2] === 'Active' ? 'status-active' : 'status-paused'}>{person[2]}</em></td><td><a href="#user-profile">View</a><a href="#user-profile">•••</a></td></tr>)}</tbody></table></div>
        <footer>Showing 5 realistic preview shoppers <span>Personal data is mock only</span></footer>
      </article>
      <section className="users-below" aria-label="User insights">
        <article><header><div><h2>Customer health</h2><p>Verification and payout readiness</p></div><a href="/admin/users">View details →</a></header><div className="health-row"><span><i className="dot active"/><small>Verified users</small><b>215,000</b></span><span><i className="dot active"/><small>KYC-ready users</small><b>152,000</b></span><span><i className="dot active"/><small>Payout-ready users</small><b>148,500</b></span><span><i className="dot pending"/><small>Support needed</small><b>12</b></span></div></article>
        <article><header><div><h2>Recent registrations</h2><p>Newest customer accounts</p></div><a href="/admin/activity">View all registrations →</a></header><div className="registration-row">{registrations.map(([name, time]) => <span key={name}><i>{name[0]}</i><b>{name}</b><small>{time}</small></span>)}</div></article>
      </section>
    </main>
    <a className="user-drawer-backdrop" href="#" aria-label="Close user profile"/>
    <aside id="user-profile" className="user-profile-drawer" aria-label="Customer profile">
      <header><span className="profile-avatar">A</span><a href="#" aria-label="Close user profile"><X/></a><h2>Ananya Sharma <em>Active</em></h2><p>USR0015823 <button aria-label="Copy user ID"><Copy/></button></p><span><Mail/> ananya.demo@glonni.test</span><span><Phone/> +91 98765 43210</span><div><b><Mail/>Email verified</b><b><Phone/>Mobile verified</b></div></header>
      <section className="profile-facts"><p><MapPin/><span><small>Location</small>Hyderabad, Telangana</span></p><p><CalendarDays/><span><small>Joined</small>12 Jan 2024</span></p><p><Clock3/><span><small>Last active</small>2 hours ago</span></p></section>
      <section className="profile-status"><p><ShieldCheck/><span>KYC status</span><b>Verified</b></p><p><WalletCards/><span>Wallet status</span><b>Ready</b></p><p><Activity/><span>Risk level</span><b>Low</b></p></section>
      <section><h3><WalletCards/>Wallet summary</h3><p className="profile-value"><span>Available balance</span><b>₹1,090</b></p><p className="profile-value"><span>Total earnings</span><b>₹12,430</b></p><p className="profile-value"><span>Total withdrawals</span><b>₹11,340</b></p></section>
      <section><h3><Clock3/>Latest activity</h3><p className="profile-note">Viewed offer: Electronics<small>2 hours ago</small></p></section>
      <section><h3><Headphones/>Support cases</h3><p className="profile-note">2 open cases<small>Last message 1 day ago</small></p></section>
      <a className="open-profile" href="/admin/users/USR0015823"><ExternalLink/>Open full profile</a>
    </aside>
  </section></main>;
}
