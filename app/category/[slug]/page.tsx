import Link from 'next/link';
import { ArrowRight, Store } from 'lucide-react';
import { Header } from '@/components/header';
import { BrowseNav } from '@/components/browse-nav';
import { OfferGrid } from '@/components/offer-grid';
import { getCatalogOffers, getCategories, getStores } from '@/lib/catalog';
import { hasCashback } from '@/lib/rewards';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const [categories, offers, stores] = await Promise.all([getCategories(), getCatalogOffers({ category: slug }), getStores()]);
  const category = categories.find((item) => item.slug === slug);
  if (!category) notFound();

  const seen = new Set<string>();
  const products = offers.filter((offer) => {
    const key = offer.products?.slug;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const storeSlugs = new Set(offers.map((offer) => offer.merchants?.slug).filter(Boolean));
  const verticalStores = stores.filter((store) => storeSlugs.has(store.slug));
  const cashbackCount = offers.filter(hasCashback).length;

  return <><Header/><main className="vertical-page">
    <BrowseNav items={[{ label: 'Categories', href: '/deals' }, { label: category.name }]} fallback="/deals"/>
    <section className="vertical-hero">
      <div><p className="eyebrow">SHOP BY CATEGORY</p><h1>{category.name}</h1><p>Explore the brands and products currently available in this category. Compare merchant offers and see cashback only where that individual offer is eligible.</p></div>
      <aside><span><b>{products.length}</b><small>products</small></span><span><b>{verticalStores.length}</b><small>brands</small></span><span><b>{cashbackCount}</b><small>eligible offers</small></span></aside>
    </section>
    <section className="vertical-section">
      <div className="section-title"><div><p className="eyebrow">BRANDS IN {category.name.toUpperCase()}</p><h2>Shop this category by store</h2></div><Link href={`/deals?category=${category.slug}`}>See all offers <ArrowRight size={15}/></Link></div>
      {verticalStores.length ? <div className="vertical-store-grid">{verticalStores.map((store) => <Link href={`/store/${store.slug}`} key={store.id}><span>{store.name.slice(0, 1)}</span><div><b>{store.name}</b><small>{offers.filter((offer) => offer.merchants?.slug === store.slug).length} offers in {category.name}</small></div><Store size={17}/></Link>)}</div> : <div className="empty-state"><h2>Brands are being added</h2><p>Once a merchant has approved offers in {category.name}, it will appear here.</p></div>}
    </section>
    <section className="vertical-section">
      <div className="section-title"><div><p className="eyebrow">{category.name.toUpperCase()} PRODUCTS</p><h2>Products to compare</h2></div><Link href={`/deals?category=${category.slug}`}>View all category offers <ArrowRight size={15}/></Link></div>
      {products.length ? <OfferGrid offers={products}/> : <div className="empty-state"><h2>No products in this category yet</h2><p>Products added by the Glonni catalogue team will appear here automatically.</p><Link href="/deals" className="primary">Explore all deals</Link></div>}
    </section>
  </main></>;
}
