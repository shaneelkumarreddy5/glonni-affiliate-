import { Header } from '@/components/header';
import { BrowseNav } from '@/components/browse-nav';
import { OfferGrid } from '@/components/offer-grid';
import { getCatalogOffers, getStores } from '@/lib/catalog';
import { hasCashback } from '@/lib/rewards';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ContextualFaqs } from '@/components/contextual-faqs';
import { safeReturnPath } from '@/lib/navigation';

export const dynamic = 'force-dynamic';

export default async function StorePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ from?: string }> }) {
  const slug = (await params).slug;
  const parent = safeReturnPath((await searchParams).from, '/stores');
  const [stores, offers] = await Promise.all([getStores(), getCatalogOffers({ store: slug })]);
  const store = stores.find((item) => item.slug === slug);
  if (!store) notFound();
  const supabase = await createClient();
  const { data: faqs } = await supabase.from('support_faqs').select('id,question,answer,scope').eq('merchant_id', store.id).eq('is_active', true).order('display_order');
  const rewards = offers.filter(hasCashback).length;

  return <><Header/><main>
    <BrowseNav items={[{ label: parent.startsWith('/category/') ? 'Category' : 'Stores', href: parent }, { label: store.name }]} fallback={parent}/>
    <section className="store-hero"><p className="eyebrow">SHOP BY STORE</p><div><span>{store.name.slice(0, 1)}</span><section><h1>{store.name} on Glonni</h1><p>Browse {offers.length} configured mock offers from {store.name}, compare them with other stores, and see customer rewards only where eligible.</p></section></div><aside><b>{offers.length}</b><small>offers to explore</small><b>{rewards}</b><small>cashback-eligible</small></aside>{store.storefront_url && <a className="secondary" href={store.storefront_url}>Visit mock {store.name} storefront →</a>}</section>
    <section className="section-title"><div><p className="eyebrow">{store.name.toUpperCase()} DEALS</p><h2>Offers from this store</h2></div></section>
    <OfferGrid offers={offers} contextHref={`/store/${store.slug}?from=${encodeURIComponent(parent)}`}/>
    <ContextualFaqs title={`${store.name} cashback rules & FAQs`} faqs={(faqs ?? []) as { id: string; question: string; answer: string; scope: string }[]}/>
    <section className="store-note"><b>Before you continue to {store.name}</b><p>Glonni does not sell these products. Price, payment, delivery, returns and final offer terms are handled by {store.name}. Cashback appears only when the selected offer is eligible.</p></section>
    {!offers.length && <div className="empty-state"><h2>No offers for this store yet</h2><a href={parent} className="primary">Return to previous page</a></div>}
  </main></>;
}
