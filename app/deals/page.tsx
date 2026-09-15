import { Header } from '@/components/header';
import { BrowseNav } from '@/components/browse-nav';
import { OfferGrid } from '@/components/offer-grid';
import { getCatalogOffers, getCategories, getStores } from '@/lib/catalog';
import { hasCashback } from '@/lib/rewards';

export const dynamic = 'force-dynamic';
type Params = { q?: string; store?: string; category?: string; cashback?: string; price?: string; sort?: string };

const filterLink = (filters: Params, changes: Params) => {
  const params = new URLSearchParams();
  Object.entries({ ...filters, ...changes }).forEach(([key, value]) => { if (value) params.set(key, value); });
  return `/deals?${params.toString()}`;
};

export default async function DealsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const filters = await searchParams;
  const [baseOffers, stores, categories] = await Promise.all([
    getCatalogOffers({ store: filters.store, category: filters.category }),
    getStores(),
    getCategories(),
  ]);
  const topCategories = categories.filter((category) => category.parent_id === null).sort((a, b) => a.display_order - b.display_order);
  const query = filters.q?.trim().toLowerCase();
  let offers = baseOffers.filter((offer) => !query || `${offer.products?.title ?? ''} ${offer.products?.brand ?? ''} ${offer.merchants?.name ?? ''} ${offer.products?.categories?.name ?? ''}`.toLowerCase().includes(query));
  if (filters.cashback === 'yes') offers = offers.filter(hasCashback);
  if (filters.price === 'under-1000') offers = offers.filter((offer) => (offer.current_price ?? Infinity) < 1000);
  if (filters.price === 'under-5000') offers = offers.filter((offer) => (offer.current_price ?? Infinity) < 5000);
  if (filters.price === 'over-5000') offers = offers.filter((offer) => (offer.current_price ?? 0) >= 5000);
  if (filters.sort === 'trending') offers.sort((a, b) => ((b.customer_rating ?? 0) * (b.rating_count ?? 0)) - ((a.customer_rating ?? 0) * (a.rating_count ?? 0)));
  if (filters.sort === 'price-drop') offers.sort((a, b) => ((b.list_price ?? b.current_price ?? 0) - (b.current_price ?? 0)) - ((a.list_price ?? a.current_price ?? 0) - (a.current_price ?? 0)));
  if (filters.sort === 'best') offers.sort((a, b) => ((a.current_price ?? Infinity) - (a.cashback_amount ?? 0)) - ((b.current_price ?? Infinity) - (b.cashback_amount ?? 0)));

  const title = filters.q ? `Results for “${filters.q}”`
    : filters.store ? `Deals from ${stores.find((store) => store.slug === filters.store)?.name ?? 'this store'}`
    : filters.category ? `${categories.find((category) => category.slug === filters.category)?.name ?? 'Category'} deals`
    : filters.sort === 'trending' ? 'Trending deals'
    : filters.sort === 'price-drop' ? 'Biggest price drops'
    : filters.sort === 'best' ? 'Best deals right now'
    : 'Deals worth a closer look';

  return <><Header/><main>
    <BrowseNav items={[{ label: 'Deals' }]}/>
    <section className="catalog-head deals-head"><p className="eyebrow">SMART DEAL DISCOVERY</p><h1>{title}</h1><p>{offers.length} matching mock offers. Search products, brands, stores or categories, then compare price and cashback eligibility.</p></section>
    <form className="catalog-search" action="/deals"><input name="q" defaultValue={filters.q} placeholder="Search products, brands, stores or categories"/><button className="primary">Search</button></form>
    {!filters.q && <div className="search-suggestions"><span>Popular searches</span>{['Smartphones', 'Beauty', 'Running shoes', 'Myntra', 'Amazon'].map((item) => <a href={`/deals?q=${encodeURIComponent(item)}`} key={item}>{item}</a>)}</div>}
    <div className="filter-block"><span>Categories</span><div className="filter-row"><a className={!filters.category ? 'selected' : ''} href={filterLink(filters, { category: '' })}>All deals</a>{topCategories.map((category) => <a href={`/category/${category.slug}`} key={category.id}>{category.name}</a>)}</div></div>
    <div className="filter-block"><span>Customer benefit</span><div className="filter-row"><a className={filters.cashback !== 'yes' ? 'selected' : ''} href={filterLink(filters, { cashback: '' })}>All offers</a><a className={filters.cashback === 'yes' ? 'selected cashback-filter' : ''} href={filterLink(filters, { cashback: 'yes' })}>Cashback eligible</a></div></div>
    <div className="filter-block"><span>Price range</span><div className="filter-row"><a className={!filters.price ? 'selected' : ''} href={filterLink(filters, { price: '' })}>Any price</a><a className={filters.price === 'under-1000' ? 'selected' : ''} href={filterLink(filters, { price: 'under-1000' })}>Under ₹1,000</a><a className={filters.price === 'under-5000' ? 'selected' : ''} href={filterLink(filters, { price: 'under-5000' })}>Under ₹5,000</a><a className={filters.price === 'over-5000' ? 'selected' : ''} href={filterLink(filters, { price: 'over-5000' })}>₹5,000+</a></div></div>
    <div className="filter-row store-filters"><span>Shop by store</span>{stores.map((store) => <a className={filters.store === store.slug ? 'selected' : ''} href={`/store/${store.slug}`} key={store.id}>{store.name}</a>)}</div>
    {offers.length ? <OfferGrid offers={offers}/> : <div className="empty-state"><h2>No matching mock offers</h2><p>Try a different product, brand, store, category or filter.</p><a href="/deals" className="primary">Clear all filters</a></div>}
  </main></>;
}
