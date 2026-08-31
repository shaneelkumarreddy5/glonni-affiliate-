import { createClient } from '@/lib/supabase/server';
import { BadgeIndianRupee, Bell, CheckCircle2, Clock3, Globe2, Package, Store, Tags } from 'lucide-react';

export const dynamic = 'force-dynamic';

type StoreDetailProps = { params: Promise<{ slug: string }> };

export default async function StoreDetail({ params }: StoreDetailProps) {
  const supabase = await createClient();
  const slug = (await params).slug;
  const { data: store } = await supabase
    .from('merchants')
    .select('id,name,slug,storefront_url,is_active')
    .eq('slug', slug)
    .maybeSingle();

  if (!store) {
    return <main className="admin-v2"><section className="admin-main"><main className="admin-content"><h1>Store not found</h1><a href="/admin">Back to Stores &amp; Brands</a></main></section></main>;
  }

  const { data: offerData } = await supabase
    .from('offers')
    .select('id,current_price,reward_type,cashback_amount,products(title)')
    .eq('merchant_id', store.id);
  const offers = offerData ?? [];
  const cashbackOfferCount = offers.filter((offer) => ['fixed_cashback', 'percentage_cashback'].includes(offer.reward_type ?? '')).length;

  return (
    <main className="admin-v2">
      <aside className="admin-side">
        <a className="admin-brand" href="/"><b>Glonn<i>i</i></b><span>Admin Panel</span></a>
        <section><p>SHOP &amp; EARN</p><a className="selected" href="/admin"><Store size={16} />Stores &amp; Brands</a><a href="#"><Package size={16} />Products</a><a href="#"><Tags size={16} />Deals &amp; Banners</a></section>
        <section><p>PROVIDERS</p><a href="#"><Globe2 size={16} />Affiliate Providers</a></section>
      </aside>
      <section className="admin-main">
        <header className="admin-top"><Store size={21} /><b>Store details</b><span className="dashboard-date">Preview management workspace</span><Bell size={19} /><span className="avatar">SR</span></header>
        <main className="admin-content">
          <a className="admin-link" href="/admin">← Back to Stores &amp; Brands</a>
          <div className="admin-title"><div><p>STORE / MERCHANT</p><h1>{store.name}</h1><span>{store.storefront_url || 'Storefront URL not configured'} · {store.is_active ? 'Active on storefront' : 'Paused'}</span></div><div><button className="secondary" disabled>Pause store</button>{' '}<button className="add-store" disabled>Approve changes</button></div></div>
          <p className="preview-note">Preview controls only. Store actions will be enabled when secure admin roles are added.</p>
          <section className="admin-stats">
            <article><Package /><div><small>Store offers</small><b>{offers.length}</b><em>Catalogue offers</em></div></article>
            <article><BadgeIndianRupee /><div><small>Cashback offers</small><b>{cashbackOfferCount}</b><em>Only eligible offers</em></div></article>
            <article><Globe2 /><div><small>Affiliate source</small><b>Manual</b><em>No live provider linked</em></div></article>
            <article><CheckCircle2 /><div><small>Homepage status</small><b>{store.is_active ? 'Live' : 'Paused'}</b><em>Configurable placement</em></div></article>
            <article><Clock3 /><div><small>Approval status</small><b>Approved</b><em>Preview status</em></div></article>
          </section>
          <section className="admin-grid">
            <article className="store-table"><div className="table-head"><div><a className="current">Store profile</a><a>Offers</a><a>Rules</a></div></div><div className="admin-detail">
              <section><p>STORE INFORMATION</p><h2>Merchant settings</h2><dl><div><dt>Display name</dt><dd>{store.name}</dd></div><div><dt>Storefront URL</dt><dd>{store.storefront_url || 'Not configured'}</dd></div><div><dt>Store status</dt><dd>{store.is_active ? 'Active' : 'Paused'}</dd></div><div><dt>Homepage placement</dt><dd>Shop by Store · configurable</dd></div></dl></section>
              <section><p>COMMERCIAL &amp; REWARD RULES</p><h2>Customer benefit guardrails</h2><dl><div><dt>Commission</dt><dd>Not connected</dd></div><div><dt>Cashback to customer</dt><dd>Only on eligible offers</dd></div><div><dt>Reward funding</dt><dd>Provider / merchant / Glonni</dd></div><div><dt>Approval mode</dt><dd>Approval required</dd></div></dl></section>
              <section><p>OFFER INVENTORY</p><h2>{offers.length} offers under {store.name}</h2>{offers.length ? offers.map((offer) => <p className="activity" key={offer.id}>{(offer.products as { title?: string } | null)?.title ?? 'Product'}<small>₹{offer.current_price} · {offer.reward_type?.replaceAll('_', ' ') || 'best price'}</small></p>) : <p className="activity">No catalogue offers yet<small>Add products and approved offers to show them here.</small></p>}</section>
            </div></article>
            <aside className="admin-right"><article><h2>Category coverage</h2><p>Electronics <span>Primary</span></p><p>Fashion <span>Available</span></p><p>Beauty <span>Available</span></p></article><article><h2>Provider readiness</h2><p className="activity">No credentials stored<small>Safe manual/mock mode</small></p><p className="activity">Postback status<small>Not connected</small></p></article><article><h2>Store actions</h2><p className="activity">Pause / resume store<small>Secure roles required at launch</small></p><p className="activity">Approve modifications<small>Approval workflow ready for activation</small></p></article></aside>
          </section>
        </main>
      </section>
    </main>
  );
}
