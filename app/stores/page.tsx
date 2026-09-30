import Link from 'next/link';
import { Search, Store } from 'lucide-react';
import { Header } from '@/components/header';
import { BrowseNav } from '@/components/browse-nav';
import { ScrollRail } from '@/components/scroll-rail';
import { CmsManagedSections } from '@/components/cms-managed-sections';
import { StoreCard } from '@/components/store-card';
import { categoryBranchIds } from '@/lib/category-tree';
import { getCatalogOffers, getCategories, getStores } from '@/lib/catalog';
import { hasCashback } from '@/lib/rewards';

export const dynamic = 'force-dynamic';
type StoreFilters = { q?: string; category?: string; cashback?: string; sort?: string };

function storesHref(filters: StoreFilters, category?: string) {
  const params = new URLSearchParams();
  if (filters.q?.trim()) params.set('q', filters.q.trim());
  if (category) params.set('category', category);
  if (filters.cashback === 'yes') params.set('cashback', 'yes');
  if (filters.sort && filters.sort !== 'featured') params.set('sort', filters.sort);
  const query = params.toString();
  return `/stores${query ? `?${query}` : ''}`;
}

export default async function StoresPage({ searchParams }: { searchParams: Promise<StoreFilters> }) {
  const filters = await searchParams;
  const [stores, offers, categories] = await Promise.all([getStores(), getCatalogOffers(), getCategories()]);
  const selectedCategory = categories.find((category) => category.slug === filters.category);
  const categoryIds = selectedCategory ? categoryBranchIds(categories, selectedCategory.id) : null;
  const matchingOffers = categoryIds
    ? offers.filter((offer) => offer.products?.categories?.id && categoryIds.has(offer.products.categories.id))
    : offers;
  const categoryStoreSlugs = new Set(matchingOffers.map((offer) => offer.merchants?.slug).filter(Boolean));
  const cashbackStoreSlugs = new Set(matchingOffers.filter(hasCashback).map((offer) => offer.merchants?.slug).filter(Boolean));
  const query = filters.q?.trim().toLowerCase();
  const visibleStores = stores
    .filter((store) => (!selectedCategory || categoryStoreSlugs.has(store.slug))
      && (filters.cashback !== 'yes' || cashbackStoreSlugs.has(store.slug))
      && (!query || store.name.toLowerCase().includes(query)))
    .sort((a, b) => filters.sort === 'name-asc'
      ? a.name.localeCompare(b.name)
      : filters.sort === 'name-desc'
        ? b.name.localeCompare(a.name)
        : 0);
  const topCategories = categories.filter((category) => category.parent_id === null).sort((a, b) => a.display_order - b.display_order);
  const hasFilters = Boolean(filters.q || filters.category || filters.cashback === 'yes' || (filters.sort && filters.sort !== 'featured'));
  const heroStores = stores.filter((store) => store.logo_url).slice(0, 8);

  return <><Header/><main className="vertical-page stores-browse-page">
    <BrowseNav items={[{ label: 'Stores' }]} fallback="/"/>
    <section className="stores-directory-hero" aria-labelledby="stores-title">
      <div className="stores-directory-hero-copy">
        <p className="eyebrow">SHOP BY STORE</p>
        <h1 id="stores-title">Find your favourite stores</h1>
        <p>Discover top brands, great deals and earn cashback on all your purchases.</p>
      </div>
      {heroStores.length > 0 && <div className="stores-directory-brand-collage" aria-hidden="true">
        {heroStores.map((store) => <span key={store.id}><img src={store.logo_url!} alt="" loading="lazy"/></span>)}
      </div>}
    </section>
    <CmsManagedSections pageKey="stores" slot="after_heading"/>

    <nav className="stores-category-shortcuts" aria-label="Browse stores by category">
      <ScrollRail className="stores-category-shortcuts-rail" label="Store categories">
        <Link href={storesHref(filters, undefined)} className={!selectedCategory ? 'active' : ''}><Store size={17}/>All stores</Link>
        {topCategories.map((category) => <Link href={storesHref(filters, category.slug)} className={selectedCategory?.id === category.id ? 'active' : ''} key={category.id}>
          <Store size={16}/>{category.name}
        </Link>)}
      </ScrollRail>
    </nav>

    <section className="stores-directory-layout" aria-label="Store directory">
      <aside className="stores-filter-panel">
        <form action="/stores" method="get">
          <header><h2>Filters</h2>{hasFilters && <Link href="/stores">Clear all</Link>}</header>
          {filters.q && <input type="hidden" name="q" value={filters.q}/>}
          <fieldset>
            <legend>Category</legend>
            <div className="stores-filter-options">
              <label><input type="radio" name="category" value="" defaultChecked={!selectedCategory}/><span>All stores</span></label>
              {topCategories.map((category) => <label key={category.id}>
                <input type="radio" name="category" value={category.slug} defaultChecked={selectedCategory?.id === category.id}/>
                <span>{category.name}</span>
              </label>)}
            </div>
          </fieldset>
          <fieldset>
            <legend>Cashback eligible</legend>
            <div className="stores-filter-options">
              <label><input type="checkbox" name="cashback" value="yes" defaultChecked={filters.cashback === 'yes'}/><span>Show stores with eligible offers</span></label>
            </div>
          </fieldset>
          <label className="stores-sort-control"><span>Sort by</span><select name="sort" defaultValue={filters.sort ?? 'featured'}>
            <option value="featured">Featured</option><option value="name-asc">A–Z (Store name)</option><option value="name-desc">Z–A (Store name)</option>
          </select></label>
          <button type="submit">Apply filters</button>
        </form>
      </aside>

      <div className="stores-directory-results">
        <header className="stores-results-heading">
          <div><p className="eyebrow">STORE DIRECTORY</p><h2>Browse stores</h2></div>
          <form className="store-directory-search" action="/stores" method="get">
            <Search size={18}/><input type="search" name="q" defaultValue={filters.q} aria-label="Search stores" placeholder="Search stores…"/>
            {filters.category && <input type="hidden" name="category" value={filters.category}/>}
            {filters.cashback === 'yes' && <input type="hidden" name="cashback" value="yes"/>}
            {filters.sort && <input type="hidden" name="sort" value={filters.sort}/>}
          </form>
        </header>
        {visibleStores.length ? <div className="store-directory-grid">
          {visibleStores.map((store) => <StoreCard key={store.id} href={`/store/${store.slug}?from=${encodeURIComponent('/stores')}`} name={store.name} logoUrl={store.logo_url} className="directory-store-card"/>)}
        </div> : <div className="empty-state store-directory-empty"><Store size={30}/><h2>No stores match your filters</h2><p>Try another store name or category.</p><Link href="/stores" className="primary">Show all stores</Link></div>}
      </div>
    </section>
    <CmsManagedSections pageKey="stores" slot="page_end"/>
  </main></>;
}
