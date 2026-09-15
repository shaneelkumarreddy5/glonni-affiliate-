import Link from 'next/link';
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react';
import { Header } from '@/components/header';
import { BrowseNav } from '@/components/browse-nav';
import { OfferGrid } from '@/components/offer-grid';
import { categoryBranchIds, orderCategoryTree } from '@/lib/category-tree';
import { CatalogOffer, getCatalogOffers, getCategories, getStores } from '@/lib/catalog';
import { hasCashback } from '@/lib/rewards';

export const dynamic = 'force-dynamic';
type Params = { q?: string; store?: string; category?: string; cashback?: string; price?: string; stock?: string; sort?: string; page?: string };
const PAGE_SIZE = 12;

function dealsLink(filters: Params, changes: Params) {
  const params = new URLSearchParams();
  Object.entries({ ...filters, ...changes }).forEach(([key, value]) => { if (value) params.set(key, value); });
  const query = params.toString();
  return `/deals${query ? `?${query}` : ''}`;
}

function cashbackValue(offer: CatalogOffer) {
  if (offer.reward_type === 'fixed_cashback') return offer.cashback_amount ?? 0;
  if (offer.reward_type === 'percentage_cashback' && offer.current_price) {
    const calculated = offer.current_price * ((offer.cashback_percent ?? 0) / 100);
    return offer.cashback_cap ? Math.min(calculated, offer.cashback_cap) : calculated;
  }
  return 0;
}

function effectivePrice(offer: CatalogOffer) {
  return (offer.current_price ?? Infinity) - cashbackValue(offer);
}

function discountPercent(offer: CatalogOffer) {
  return offer.current_price && offer.list_price ? (offer.list_price - offer.current_price) / offer.list_price : 0;
}

function isInStock(offer: CatalogOffer) {
  const status = offer.stock_status?.toLowerCase().replaceAll('_', ' ') ?? '';
  return status === 'in stock' || status === 'available' || status === 'limited stock';
}

export default async function DealsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const filters = await searchParams;
  const [allOffers, stores, categories] = await Promise.all([getCatalogOffers(), getStores(), getCategories()]);
  const orderedCategories = orderCategoryTree(categories);
  const selectedCategory = categories.find((category) => category.slug === filters.category);
  const categoryIds = selectedCategory ? categoryBranchIds(categories, selectedCategory.id) : null;
  const categoryPaths = new Map(orderedCategories.map((category) => [category.id, category.treePath.toLowerCase()]));
  const query = filters.q?.trim().toLowerCase();

  let filteredOffers = allOffers.filter((offer) => !query || `${offer.products?.title ?? ''} ${offer.products?.brand ?? ''} ${offer.merchants?.name ?? ''} ${offer.products?.categories?.name ?? ''} ${offer.products?.categories?.id ? categoryPaths.get(offer.products.categories.id) ?? '' : ''}`.toLowerCase().includes(query));
  if (categoryIds) filteredOffers = filteredOffers.filter((offer) => offer.products?.categories?.id && categoryIds.has(offer.products.categories.id));
  if (filters.store) filteredOffers = filteredOffers.filter((offer) => offer.merchants?.slug === filters.store);
  if (filters.cashback === 'yes') filteredOffers = filteredOffers.filter(hasCashback);
  if (filters.stock === 'in-stock') filteredOffers = filteredOffers.filter(isInStock);
  if (filters.price === 'under-1000') filteredOffers = filteredOffers.filter((offer) => (offer.current_price ?? Infinity) < 1000);
  if (filters.price === '1000-5000') filteredOffers = filteredOffers.filter((offer) => (offer.current_price ?? 0) >= 1000 && (offer.current_price ?? Infinity) < 5000);
  if (filters.price === '5000-25000') filteredOffers = filteredOffers.filter((offer) => (offer.current_price ?? 0) >= 5000 && (offer.current_price ?? Infinity) < 25000);
  if (filters.price === 'over-25000') filteredOffers = filteredOffers.filter((offer) => (offer.current_price ?? 0) >= 25000);

  const groupedOffers = new Map<string, CatalogOffer[]>();
  for (const offer of filteredOffers) {
    const productId = offer.products?.id;
    if (!productId) continue;
    groupedOffers.set(productId, [...(groupedOffers.get(productId) ?? []), offer]);
  }
  let products = [...groupedOffers.values()].map((offers) => [...offers].sort((a, b) => effectivePrice(a) - effectivePrice(b))[0]);
  const sort = filters.sort ?? 'effective-price';
  if (sort === 'discount') products.sort((a, b) => discountPercent(b) - discountPercent(a));
  else if (sort === 'rating') products.sort((a, b) => (b.customer_rating ?? 0) - (a.customer_rating ?? 0));
  else if (sort === 'popular') products.sort((a, b) => (b.rating_count ?? 0) - (a.rating_count ?? 0));
  else products.sort((a, b) => effectivePrice(a) - effectivePrice(b));

  const storeCounts: Record<string, number> = {};
  for (const offer of allOffers) if (offer.products?.id) {
    const storesForProduct = new Set(allOffers.filter((candidate) => candidate.products?.id === offer.products?.id).map((candidate) => candidate.merchants?.slug).filter(Boolean));
    storeCounts[offer.products.id] = storesForProduct.size;
  }
  const requestedPage = Number.parseInt(filters.page ?? '1', 10);
  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const page = Number.isFinite(requestedPage) ? Math.min(Math.max(requestedPage, 1), totalPages) : 1;
  const visibleProducts = products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const activeFilters = [
    filters.q && { label: `Search: ${filters.q}`, clear: { q: '', page: '' } },
    selectedCategory && { label: selectedCategory.name, clear: { category: '', page: '' } },
    filters.store && { label: stores.find((store) => store.slug === filters.store)?.name ?? filters.store, clear: { store: '', page: '' } },
    filters.price && { label: `Price: ${filters.price.replaceAll('-', ' ')}`, clear: { price: '', page: '' } },
    filters.cashback === 'yes' && { label: 'Cashback eligible', clear: { cashback: '', page: '' } },
    filters.stock === 'in-stock' && { label: 'In stock', clear: { stock: '', page: '' } },
  ].filter(Boolean) as { label: string; clear: Params }[];

  const title = filters.q ? `Results for “${filters.q}”` : selectedCategory ? `${selectedCategory.name} deals` : filters.store ? `Deals from ${stores.find((store) => store.slug === filters.store)?.name ?? 'this store'}` : 'Compare the best deals';

  return <><Header/><main className="deals-page">
    <BrowseNav items={[{ label: 'Deals' }]}/>
    <section className="catalog-head deals-head"><p className="eyebrow">PRODUCT-FIRST DEAL DISCOVERY</p><h1>{title}</h1><p>Every product appears once with its best matching offer. Open it to compare prices, rewards and terms across all connected stores.</p></section>

    <form className="deals-search" action="/deals"><Search size={20}/><input name="q" defaultValue={filters.q} aria-label="Search products, brands, stores and categories" placeholder="Search products, brands, stores and categories"/>{filters.category && <input type="hidden" name="category" value={filters.category}/>}<button type="submit">Search deals</button></form>

    <div className="deals-layout">
      <aside className="deals-filter-panel"><header><SlidersHorizontal size={18}/><div><b>Filter deals</b><small>Narrow the products shown</small></div>{activeFilters.length > 0 && <Link href="/deals">Clear all</Link>}</header>
        <form action="/deals" className="deals-filter-form">
          {filters.q && <input type="hidden" name="q" value={filters.q}/>}<input type="hidden" name="sort" value={sort}/>
          <label>Category<select name="category" defaultValue={filters.category ?? ''}><option value="">All categories</option>{orderedCategories.map((category) => <option key={category.id} value={category.slug}>{`${'  '.repeat(category.treeDepth)}${category.treeDepth ? '↳ ' : ''}${category.name}`}</option>)}</select></label>
          <label>Store<select name="store" defaultValue={filters.store ?? ''}><option value="">All stores</option>{stores.map((store) => <option key={store.id} value={store.slug}>{store.name}</option>)}</select></label>
          <label>Price<select name="price" defaultValue={filters.price ?? ''}><option value="">Any price</option><option value="under-1000">Under ₹1,000</option><option value="1000-5000">₹1,000–₹4,999</option><option value="5000-25000">₹5,000–₹24,999</option><option value="over-25000">₹25,000+</option></select></label>
          <label>Availability<select name="stock" defaultValue={filters.stock ?? ''}><option value="">Any availability</option><option value="in-stock">In stock only</option></select></label>
          <label>Customer benefit<select name="cashback" defaultValue={filters.cashback ?? ''}><option value="">All offers</option><option value="yes">Cashback eligible</option></select></label>
          <button type="submit">Apply filters</button>
        </form>
      </aside>

      <section className="deals-results">
        <div className="deals-toolbar"><div><b>{products.length} {products.length === 1 ? 'product' : 'products'}</b><small>Best matching offer shown on each card</small></div><form action="/deals">{Object.entries(filters).filter(([key, value]) => key !== 'sort' && key !== 'page' && value).map(([key, value]) => <input type="hidden" name={key} value={value} key={key}/>)}<label>Sort by<select name="sort" defaultValue={sort}><option value="effective-price">Best effective price</option><option value="discount">Biggest discount</option><option value="rating">Customer rating</option><option value="popular">Popularity</option></select></label><button type="submit">Sort</button></form></div>
        {activeFilters.length > 0 && <div className="active-deal-filters">{activeFilters.map((filter) => <Link href={dealsLink(filters, filter.clear)} key={filter.label}>{filter.label}<X size={12}/></Link>)}</div>}
        {visibleProducts.length ? <OfferGrid offers={visibleProducts} contextHref={dealsLink(filters, {})} storeCounts={storeCounts} dealMode/> : <div className="empty-state deals-empty"><Search size={31}/><h2>No products match these filters</h2><p>Try a broader search, another category, or clear the current filters.</p><Link href="/deals" className="primary">Clear all filters</Link></div>}
        {products.length > PAGE_SIZE && <nav className="deals-pagination" aria-label="Deals pages">{page > 1 ? <Link href={dealsLink(filters, { page: String(page - 1) })}><ChevronLeft size={15}/>Previous</Link> : <span><ChevronLeft size={15}/>Previous</span>}<b>Page {page} of {totalPages}</b>{page < totalPages ? <Link href={dealsLink(filters, { page: String(page + 1) })}>Next<ChevronRight size={15}/></Link> : <span>Next<ChevronRight size={15}/></span>}</nav>}
      </section>
    </div>
  </main></>;
}
