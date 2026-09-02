import { AdminSidebar } from "@/components/admin-sidebar";
import { createClient } from '@/lib/supabase/server';
import { BadgeIndianRupee, Bell, CheckCircle2, Clock3, Globe2, Package, Store, Tags } from 'lucide-react';
import { addSupportFaq, changeStoreStatus, updateStore } from '../../actions';

export const dynamic = 'force-dynamic';

type StoreDetailProps = { params: Promise<{ slug: string }> };

export default async function StoreDetail({ params, searchParams }: StoreDetailProps & { searchParams: Promise<{ success?: string }> }) {
  const supabase = await createClient();
  const slug = (await params).slug;
  const { data: store } = await supabase
    .from('merchants')
    .select('id,name,slug,storefront_url,is_active,approval_status,homepage_position,review_notes')
    .eq('slug', slug)
    .maybeSingle();

  if (!store) {
    return <main className="admin-v2"><AdminSidebar/><section className="admin-main"><main className="admin-content"><h1>Store not found</h1><a href="/admin">Back to Stores &amp; Brands</a></main></section></main>;
  }

  const { data: offerData } = await supabase
    .from('offers')
    .select('id,current_price,reward_type,cashback_amount,products(title)')
    .eq('merchant_id', store.id);
  const offers = offerData ?? [];
  const { data: faqs } = await supabase.from('support_faqs').select('id,question,answer,is_active').eq('merchant_id', store.id).order('display_order');
  const cashbackOfferCount = offers.filter((offer) => ['fixed_cashback', 'percentage_cashback'].includes(offer.reward_type ?? '')).length;

  return (
    <main className="admin-v2">
      <AdminSidebar/><section className="admin-main">
        <header className="admin-top"><Store size={21} /><b>Store details</b><span className="dashboard-date">Preview management workspace</span><Bell size={19} /><span className="avatar">SR</span></header>
        <main className="admin-content">
          <a className="admin-link" href="/admin">← Back to Stores &amp; Brands</a>
          <div className="admin-title"><div><p>STORE / MERCHANT</p><h1>{store.name}</h1><span>{store.storefront_url || 'Storefront URL not configured'} · {store.approval_status ?? (store.is_active ? 'approved' : 'paused')}</span></div><div className="store-workflow-actions"><form action={changeStoreStatus}><input type="hidden" name="id" value={store.id}/><input type="hidden" name="slug" value={store.slug}/><input type="hidden" name="action" value={store.is_active ? 'pause' : 'resume'}/><button className="secondary">{store.is_active ? 'Pause store' : 'Resume store'}</button></form>{store.approval_status !== 'approved' && <form action={changeStoreStatus}><input type="hidden" name="id" value={store.id}/><input type="hidden" name="slug" value={store.slug}/><input type="hidden" name="action" value="approve"/><button className="add-store">Approve store</button></form>}</div></div>
          {(await searchParams).success && <p className="preview-note">{(await searchParams).success}</p>}
          <p className="preview-note">Store changes are saved to Glonni, protected by your admin session, and written to the audit history. Approval controls remain role-limited.</p>
          <section className="admin-stats">
            <article><Package /><div><small>Store offers</small><b>{offers.length}</b><em>Catalogue offers</em></div></article>
            <article><BadgeIndianRupee /><div><small>Cashback offers</small><b>{cashbackOfferCount}</b><em>Only eligible offers</em></div></article>
            <article><Globe2 /><div><small>Affiliate source</small><b>Manual</b><em>No live provider linked</em></div></article>
            <article><CheckCircle2 /><div><small>Homepage status</small><b>{store.is_active ? 'Live' : 'Paused'}</b><em>Position {store.homepage_position ?? 'not set'}</em></div></article>
            <article><Clock3 /><div><small>Approval status</small><b>{store.approval_status ?? 'draft'}</b><em>Role-controlled workflow</em></div></article>
          </section>
          <section className="admin-grid">
            <article className="store-table"><div className="table-head"><div><a className="current">Store profile</a><a>Offers</a><a>Rules</a></div></div><div className="admin-detail">
              <section><p>STORE INFORMATION</p><h2>Merchant settings</h2><form action={updateStore} className="store-edit-form"><input type="hidden" name="id" value={store.id}/><input type="hidden" name="slug" value={store.slug}/><label>Display name<input name="name" required defaultValue={store.name}/></label><label>Storefront URL<input name="url" type="url" required defaultValue={store.storefront_url ?? ''}/></label><label>Homepage position<input name="homepagePosition" type="number" min="1" defaultValue={store.homepage_position ?? 99}/></label><label>Internal review notes<textarea name="reviewNotes" defaultValue={store.review_notes ?? ''} placeholder="Provider, reward or publishing notes"/></label><button className="add-store">Save store details</button></form></section>
              <section><p>COMMERCIAL &amp; REWARD RULES</p><h2>Customer benefit guardrails</h2><dl><div><dt>Commission</dt><dd>Not connected</dd></div><div><dt>Cashback to customer</dt><dd>Only on eligible offers</dd></div><div><dt>Reward funding</dt><dd>Provider / merchant / Glonni</dd></div><div><dt>Approval mode</dt><dd>Approval required</dd></div></dl></section>
              <section><p>STORE CASHBACK RULES &amp; FAQ</p><h2>Customer-facing answers</h2>{(faqs??[]).map(f=><p className="activity" key={f.id}><b>{f.question}</b><small>{f.answer}</small></p>)}<form action={addSupportFaq} className="store-edit-form"><input type="hidden" name="scope" value="merchant"/><input type="hidden" name="merchantId" value={store.id}/><label>Customer question<input name="question" required minLength={5} placeholder="What is eligible for cashback?"/></label><label>Approved answer<textarea name="answer" required minLength={10} placeholder="State eligibility, exclusions and timing clearly."/></label><label>Search keywords<input name="keywords" placeholder="cashback, tracking, exclusions"/></label><button className="add-store">Add store FAQ</button></form></section>
              <section><p>OFFER INVENTORY</p><h2>{offers.length} offers under {store.name}</h2>{offers.length ? offers.map((offer) => <p className="activity" key={offer.id}>{(offer.products as { title?: string } | null)?.title ?? 'Product'}<small>₹{offer.current_price} · {offer.reward_type?.replaceAll('_', ' ') || 'best price'}</small></p>) : <p className="activity">No catalogue offers yet<small>Add products and approved offers to show them here.</small></p>}</section>
            </div></article>
            <aside className="admin-right"><article><h2>Category coverage</h2><p>Electronics <span>Primary</span></p><p>Fashion <span>Available</span></p><p>Beauty <span>Available</span></p></article><article><h2>Provider readiness</h2><p className="activity">No credentials stored<small>Safe manual/mock mode</small></p><p className="activity">Postback status<small>Not connected</small></p></article><article><h2>Workflow</h2><p className="activity">Draft → pending → approved<small>Only approved active stores are shown publicly.</small></p><p className="activity">Pause at any time<small>Immediately removes the store from discovery.</small></p></article></aside>
          </section>
        </main>
      </section>
    </main>
  );
}
