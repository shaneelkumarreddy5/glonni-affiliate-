import Link from 'next/link';
import { ChevronDown, Search, SlidersHorizontal, Store } from 'lucide-react';
import { CustomerFilterChips } from '@/components/customer-filter-chips';
import { CustomerSortControl } from '@/components/customer-sort-control';
import { MobileFilterPanelBehavior } from '@/components/mobile-filter-panel-behavior';
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
  const activeFilters = [
    ...(filters.q?.trim() ? [{ label: `Search: ${filters.q.trim()}`, href: storesHref({ ...filters, q: undefined }, filters.category) }] : []),
    ...(selectedCategory ? [{ label: selectedCategory.name, href: storesHref(filters, undefined) }] : []),
    ...(filters.cashback === 'yes' ? [{ label: 'Cashback', href: storesHref({ ...filters, cashback: undefined }, filters.category) }] : []),
  ];
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
      <div className="stores-directory-results">
        <header className="stores-results-heading">
          <div><p className="eyebrow">STORE DIRECTORY</p><h2>Browse stores</h2><p>{visibleStores.length.toLocaleString('en-IN')} {visibleStores.length === 1 ? 'store' : 'stores'} available</p></div>
        </header>
        <div className="customer-filter-controls">
          <MobileFilterPanelBehavior/>
          <details className="category-filter-panel" data-filter-panel>
            <summary><span className="customer-filter-title"><SlidersHorizontal size={19} aria-hidden="true"/>Filters{activeFilters.length > 0 && <b className="customer-filter-count">{activeFilters.length}</b>}</span><ChevronDown size={18} className="category-filter-summary-mark" aria-hidden="true"/></summary>
            <form action="/stores" method="get">
              <input type="hidden" name="sort" value={filters.sort ?? 'featured'}/>
              <label className="category-filter-search"><span>Search stores</span><span><Search size={15}/><input type="search" name="q" defaultValue={filters.q} placeholder="Search stores"/></span></label>
              <fieldset>
                <legend>Category</legend>
                <div className="category-filter-options">
                  <label><input type="radio" name="category" value="" defaultChecked={!selectedCategory}/><span>All stores</span></label>
                  {topCategories.map((category) => <label key={category.id}>
                    <input type="radio" name="category" value={category.slug} defaultChecked={selectedCategory?.id === category.id}/>
                    <span>{category.name}</span>
                  </label>)}
                </div>
              </fieldset>
              <fieldset>
                <legend>Cashback eligible</legend>
                <div className="category-filter-options">
                  <label><input type="checkbox" name="cashback" value="yes" defaultChecked={filters.cashback === 'yes'}/><span>Show stores with eligible offers</span></label>
                </div>
              </fieldset>
              <button className="category-filter-submit" type="submit">Apply filters</button>
            </form>
          </details>
          <CustomerSortControl action="/stores" value={filters.sort ?? 'featured'} params={filters} options={[{ value: 'featured', label: 'Featured' }, { value: 'name-asc', label: 'A–Z' }, { value: 'name-desc', label: 'Z–A' }]}/>
        </div>
        <CustomerFilterChips chips={activeFilters}/>
        {visibleStores.length ? <div className="store-directory-grid">
          {visibleStores.map((store) => <StoreCard key={store.id} href={`/store/${store.slug}?from=${encodeURIComponent('/stores')}`} name={store.name} logoUrl={store.logo_url} className="directory-store-card"/>)}
        </div> : <div className="empty-state store-directory-empty"><Store size={30}/><h2>No stores match these filters</h2><p>Try another store name or category.</p><Link href="/stores" className="primary">Show all stores</Link></div>}
      </div>
    </section>
    <CmsManagedSections pageKey="stores" slot="page_end"/>
  </main></>;
}
