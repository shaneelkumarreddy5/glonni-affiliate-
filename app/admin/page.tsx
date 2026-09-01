import { AdminSidebar } from "@/components/admin-sidebar";
import { createClient } from '@/lib/supabase/server';
import { Bell, Boxes, Menu, Package, Search, Store, Tag } from 'lucide-react';
import { createStore } from './actions';

export const dynamic = 'force-dynamic';

export default async function Admin() {
  const supabase = await createClient();
  const [stores, products, offers, categories] = await Promise.all([
    supabase.from('merchants').select('id,name,slug,storefront_url,is_active,approval_status,homepage_position').order('homepage_position'),
    supabase.from('products').select('id'),
    supabase.from('offers').select('id,merchant_id,reward_type,cashback_amount,cashback_percent').order('created_at', { ascending: false }),
    supabase.from('categories').select('id'),
  ]);
  const rows = stores.data ?? [];
  const offerRows = offers.data ?? [];
  const active = rows.filter((store) => store.is_active).length;

  return <main className="admin-v2">
    <AdminSidebar/>
    <section className="admin-main">
      <header className="admin-top">
        <Menu size={21} /><b>Shop &amp; Earn</b>
        <form><Search size={16} /><input placeholder="Search anything…" /></form>
        <Bell size={19} /><span className="avatar">SR</span>
        <div><b>Shaneel Reddy</b><small>Read-only preview</small></div>
      </header>
      <main className="admin-content">
        <div className="admin-title">
          <div><p>SHOP &amp; EARN</p><h1>Stores &amp; Brands</h1><span>Review stores, brands, product offers and affiliate partnerships.</span></div>
          <a className="add-store" href="#new-store">＋ Add store</a>
        </div>
        <p className="preview-note">Store operations are protected by the admin session. New stores start as drafts; only an Owner or Admin can approve public visibility.</p>
        <section className="admin-stats">
          <article><Store /><div><small>Total stores</small><b>{rows.length}</b><em>Configured in Glonni</em></div></article>
          <article><Store /><div><small>Active stores</small><b>{active}</b><em>Visible on storefront</em></div></article>
          <article><Package /><div><small>Products</small><b>{products.data?.length ?? 0}</b><em>Normalized catalogue</em></div></article>
          <article><Tag /><div><small>Active offers</small><b>{offerRows.length}</b><em>Across all stores</em></div></article>
          <article><Boxes /><div><small>Categories</small><b>{categories.data?.length ?? 0}</b><em>Shopping discovery</em></div></article>
        </section>
        <section className="admin-grid">
          <article className="store-table">
            <div className="table-head"><div><a className="current">All Stores</a><a>Active</a><a>Pending</a><a>Paused</a></div><form><Search size={15} /><input placeholder="Search store or brand…" /></form></div>
            <div className="table-scroll"><table>
              <thead><tr><th>STORE / BRAND</th><th>STORE URL</th><th>OFFERS</th><th>CUSTOMER BENEFIT</th><th>STATUS</th><th>ACTIONS</th></tr></thead>
              <tbody>{rows.map((store) => {
                const storeOffers = offerRows.filter((offer) => offer.merchant_id === store.id);
                const reward = storeOffers[0];
                const benefit = reward?.reward_type === 'fixed_cashback'
                  ? `₹${reward.cashback_amount ?? 0} cashback`
                  : reward?.reward_type === 'percentage_cashback'
                    ? `Up to ${reward.cashback_percent ?? 0}% cashback`
                    : reward?.reward_type === 'coupon' ? 'Coupon available' : 'Best price';
                return <tr key={store.id}>
                  <td><b className="store-initial">{store.name[0]}</b><span><strong>{store.name}</strong><small>{store.slug}.in</small></span></td>
                  <td>{store.storefront_url ? 'Configured' : 'Not set'}</td><td>{storeOffers.length}</td><td>{benefit}</td>
                  <td><em className={store.is_active ? 'status-active' : 'status-paused'}>{store.approval_status ?? (store.is_active ? 'approved' : 'paused')}</em></td>
                  <td><a href={`/admin/stores/${store.slug}`}>Manage</a><a href={`/store/${store.slug}`}>View</a></td>
                </tr>;
              })}</tbody>
            </table></div>
            <footer>Showing {rows.length} configured stores <span>Secured read-only preview</span></footer>
          </article>
          <aside className="admin-right">
            <article><h2>Store Status Overview</h2><div className="donut"><b>{rows.length}<small>Total</small></b></div><p><i className="dot active" />Active <span>{active}</span></p><p><i className="dot pending" />Pending setup <span>{rows.length - active}</span></p></article>
            <article><h2>Top Performing Stores</h2>{rows.slice(0, 5).map((store, index) => <p className="ranking" key={store.id}><b>{index + 1}</b><span>{store.name}<small>Mock performance</small></span><em>{38 - index * 5} clicks</em></p>)}<a href="/admin/analytics">View analytics →</a></article>
            <article><h2>Security state</h2><p className="activity">Public catalogue reads enabled<small>Only approved, active stores appear to shoppers.</small></p><p className="activity">Changes are audited<small>Every workflow action records its actor and time.</small></p></article>
          </aside>
        </section>
        <section id="new-store" className="quick-add"><div><p>STORE SETUP</p><h2>Add a new store or brand</h2><span>Creates a draft only. It will not appear on the public website until approved.</span></div><form action={createStore}><input name="name" required placeholder="Store name"/><input name="url" type="url" required placeholder="https://store.example"/><input name="homepagePosition" type="number" min="1" placeholder="Homepage order"/><button>Add draft store</button></form></section>
      </main>
    </section>
  </main>;
}
