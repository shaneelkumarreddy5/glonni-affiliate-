import Link from 'next/link';
import { Store } from 'lucide-react';
import { Header } from '@/components/header';
import { BrowseNav } from '@/components/browse-nav';
import { getCatalogOffers, getStores } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export default async function StoresPage() {
  const [stores, offers] = await Promise.all([getStores(), getCatalogOffers()]);
  return <><Header/><main className="vertical-page">
    <BrowseNav items={[{ label: 'Stores' }]} fallback="/"/>
    <section className="vertical-hero"><div><p className="eyebrow">SHOP BY STORE</p><h1>Brands and stores</h1><p>Choose a store to browse its configured products, compare offers, and see cashback only where each offer is eligible.</p></div><aside><span><b>{stores.length}</b><small>stores</small></span><span><b>{offers.length}</b><small>offers</small></span></aside></section>
    <section className="vertical-section"><div className="section-title"><div><p className="eyebrow">ALL STORES</p><h2>Choose where to shop</h2></div></div><div className="vertical-store-grid">{stores.map((store) => <Link href={`/store/${store.slug}?from=/stores`} key={store.id}><span>{store.name.slice(0, 1)}</span><div><b>{store.name}</b><small>{offers.filter((offer) => offer.merchants?.slug === store.slug).length} configured offers</small></div><Store size={17}/></Link>)}</div></section>
  </main></>;
}
