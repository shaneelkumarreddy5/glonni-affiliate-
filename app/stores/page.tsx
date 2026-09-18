import Link from 'next/link';
import { Search, Store } from 'lucide-react';
import { Header } from '@/components/header';
import { BrowseNav } from '@/components/browse-nav';
import { CmsManagedSections } from '@/components/cms-managed-sections';
import { categoryBranchIds } from '@/lib/category-tree';
import { getCatalogOffers, getCategories, getStores } from '@/lib/catalog';

export const dynamic = 'force-dynamic';
type StoreFilters = { q?: string; category?: string };

export default async function StoresPage({ searchParams }: { searchParams: Promise<StoreFilters> }) {
  const filters = await searchParams;
  const [stores, offers, categories] = await Promise.all([getStores(), getCatalogOffers(), getCategories()]);
  const selectedCategory = categories.find((category) => category.slug === filters.category);
  const categoryIds = selectedCategory ? categoryBranchIds(categories, selectedCategory.id) : null;
  const categoryOffers = categoryIds ? offers.filter((offer) => offer.products?.categories?.id && categoryIds.has(offer.products.categories.id)) : offers;
  const availableStoreSlugs = new Set(categoryOffers.map((offer) => offer.merchants?.slug).filter(Boolean));
  const query = filters.q?.trim().toLowerCase();
  const visibleStores = stores.filter((store) => availableStoreSlugs.has(store.slug) && (!query || store.name.toLowerCase().includes(query)));
  const topCategories = categories.filter((category) => category.parent_id === null).sort((a, b) => a.display_order - b.display_order);
  const hasFilters = Boolean(filters.q || filters.category);

  return <><Header/><main className="vertical-page stores-browse-page">
    <BrowseNav items={[{ label: 'Stores' }]} fallback="/"/>
    <section className="vertical-hero"><div><p className="eyebrow">SHOP BY STORE</p><h1>Stores on Glonni</h1><p>Choose a connected store to browse its products, compare available offers, and see cashback only where the exact offer is eligible.</p></div><aside><span><b>{stores.length}</b><small>active stores</small></span><span><b>{offers.length}</b><small>offers</small></span></aside></section>
    <CmsManagedSections pageKey="stores" slot="after_heading"/>

    <section className="vertical-section">
      <div className="section-title"><div><p className="eyebrow">FIND A STORE</p><h2>Choose where to shop</h2></div>{hasFilters && <Link href="/stores">Clear filters</Link>}</div>
      <form className="store-directory-search" action="/stores"><Search size={18}/><input name="q" defaultValue={filters.q} aria-label="Search stores" placeholder="Search stores by name"/>{filters.category && <input type="hidden" name="category" value={filters.category}/>}<button type="submit">Search</button></form>
      <div className="store-category-filter"><b>Store category</b><div className="filter-row"><Link className={!filters.category ? 'selected' : ''} href="/stores">All categories</Link>{topCategories.map((category) => <Link className={filters.category === category.slug ? 'selected' : ''} href={`/stores?category=${encodeURIComponent(category.slug)}`} key={category.id}>{category.name}</Link>)}</div></div>

      {visibleStores.length ? <><div className="store-directory-summary"><b>{visibleStores.length} {visibleStores.length === 1 ? 'store' : 'stores'}</b><span>{selectedCategory ? `with offers in ${selectedCategory.name}` : 'available to browse'}</span></div><div className="vertical-store-grid store-directory-grid">{visibleStores.map((store) => {
        const storeOffers = categoryOffers.filter((offer) => offer.merchants?.slug === store.slug);
        const productCount = new Set(storeOffers.map((offer) => offer.products?.id).filter(Boolean)).size;
        return <Link href={`/store/${store.slug}?from=${encodeURIComponent('/stores')}`} key={store.id}>{store.logo_url ? <span className="directory-store-logo"><img src={store.logo_url} alt=""/></span> : <span>{store.name.slice(0, 1)}</span>}<div><b>{store.name}</b><small>{productCount} {productCount === 1 ? 'product' : 'products'} · {storeOffers.length} {storeOffers.length === 1 ? 'offer' : 'offers'}</small></div><Store size={17}/></Link>;
      })}</div></> : <div className="empty-state store-directory-empty"><Store size={30}/><h2>No stores match your filters</h2><p>Try another name or browse all store categories.</p><Link href="/stores" className="primary">Show all stores</Link></div>}
    </section>
    <CmsManagedSections pageKey="stores" slot="page_end"/>
  </main></>;
}
