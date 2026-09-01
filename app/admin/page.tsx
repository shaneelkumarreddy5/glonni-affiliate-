import { AdminSidebar } from "@/components/admin-sidebar";
import { createClient } from '@/lib/supabase/server';
import { Bell, Boxes, Menu, Package, Search, Store, Tag } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function Admin() {
  const supabase = await createClient();
  const [stores, products, offers, categories] = await Promise.all([
    supabase.from('merchants').select('id,name,slug,storefront_url,is_active').order('homepage_position'),
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
          <button className="add-store" disabled>Read-only workspace</button>
        </div>
        <p className="preview-note">Catalogue changes are locked until secure owner authentication is restored. Customer discovery and affiliate redirects remain available.</p>
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
                  <td><em className={store.is_active ? 'status-active' : 'status-paused'}>{store.is_active ? 'Active' : 'Paused'}</em></td>
                  <td><a href={`/store/${store.slug}`}>View</a><span>Read only</span></td>
                </tr>;
              })}</tbody>
            </table></div>
            <footer>Showing {rows.length} configured stores <span>Secured read-only preview</span></footer>
          </article>
          <aside className="admin-right">
            <article><h2>Store Status Overview</h2><div className="donut"><b>{rows.length}<small>Total</small></b></div><p><i className="dot active" />Active <span>{active}</span></p><p><i className="dot pending" />Pending setup <span>{rows.length - active}</span></p></article>
            <article><h2>Top Performing Stores</h2>{rows.slice(0, 5).map((store, index) => <p className="ranking" key={store.id}><b>{index + 1}</b><span>{store.name}<small>Mock performance</small></span><em>{38 - index * 5} clicks</em></p>)}<a href="/admin/analytics">View analytics →</a></article>
            <article><h2>Security state</h2><p className="activity">Public catalogue reads enabled<small>Active customer-facing rows only.</small></p><p className="activity">Anonymous writes locked<small>Owner authentication required to restore editing.</small></p></article>
          </aside>
        </section>
        <section className="quick-add"><div><p>SECURE PREVIEW</p><h2>Catalogue editing is temporarily locked</h2><span>The current data remains available while Glonni’s owner access and approval controls are prepared.</span></div><button disabled>Changes locked</button></section>
      </main>
    </section>
  </main>;
}
