import { AdminSidebar } from '@/components/admin-sidebar';
import { Bell, CircleDollarSign, Search, ShieldCheck, TicketCheck, Users } from 'lucide-react';

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
        <article id="user-profile"><header><div><h2>Selected user preview</h2><p>Open the complete customer record</p></div><a href="#user-profile">Open full profile →</a></header><div className="selected-user"><span><b>Ananya Sharma</b><small>Hyderabad · verified shopper</small></span><span><b>₹620</b><small>Wallet balance</small></span><span><b>Low</b><small>Risk level</small></span><span><b>1</b><small>Open support case</small></span></div></article>
      </section>
    </main>
  </section></main>;
}
