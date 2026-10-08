import Link from 'next/link';
import { ArrowRight, ChevronRight, RotateCcw, Search, Store } from 'lucide-react';
import { notFound } from 'next/navigation';
import { Header } from '@/components/header';
import { OfferGrid } from '@/components/offer-grid';
import { ScrollRail } from '@/components/scroll-rail';
import { StoreCard } from '@/components/store-card';
import { getCatalogOffers, getCategories, getStores, type CatalogOffer } from '@/lib/catalog';
import { categoryBranchIds } from '@/lib/category-tree';
import { hasCashback } from '@/lib/rewards';
import { CmsManagedSections } from '@/components/cms-managed-sections';

export const dynamic = 'force-dynamic';

type CategoryFilters = {
  q?: string;
  store?: string | string[];
  subcategory?: string | string[];
  cashback?: string;
  price?: string;
  sort?: string;
  collection?: string;
};

function values(value?: string | string[]) {
  return (Array.isArray(value) ? value : value ? [value] : []).filter(Boolean);
}

function categoryLink(slug: string, filters: CategoryFilters, changes: Partial<CategoryFilters>) {
  const params = new URLSearchParams();
  const next = { ...filters, ...changes };
  Object.entries(next).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach((item) => item && params.append(key, item));
    else if (value) params.set(key, value);
  });
  const query = params.toString();
  return `/category/${slug}${query ? `?${query}` : ''}`;
}

function uniqueOffers(offers: CatalogOffer[]) {
  const byProduct = new Map<string, CatalogOffer>();
  for (const offer of offers) {
    const productId = offer.products?.id;
    if (!productId) continue;
    const existing = byProduct.get(productId);
    const effectivePrice = (item: CatalogOffer) => (item.current_price ?? Infinity) - (item.cashback_amount ?? 0);
    if (!existing || effectivePrice(offer) < effectivePrice(existing)) byProduct.set(productId, offer);
  }
  return [...byProduct.values()];
}

function sortOffers(offers: CatalogOffer[], sort: string) {
  const sorted = [...offers];
  if (sort === 'price-low') return sorted.sort((a, b) => (a.current_price ?? Infinity) - (b.current_price ?? Infinity));
  if (sort === 'price-high') return sorted.sort((a, b) => (b.current_price ?? 0) - (a.current_price ?? 0));
  if (sort === 'cashback') return sorted.sort((a, b) => (b.cashback_amount ?? 0) - (a.cashback_amount ?? 0));
  if (sort === 'discount') {
    const discount = (offer: CatalogOffer) => offer.current_price && offer.list_price && offer.list_price > offer.current_price
      ? (offer.list_price - offer.current_price) / offer.list_price
      : 0;
    return sorted.sort((a, b) => discount(b) - discount(a));
  }
  return sorted;
}

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<CategoryFilters> }) {
  const slug = (await params).slug;
  const filters = await searchParams;
  const [categories, stores] = await Promise.all([getCategories(), getStores()]);
  const category = categories.find((item) => item.slug === slug);
  if (!category) notFound();

  const branchIds = categoryBranchIds(categories, category.id);
  const allOffers = await getCatalogOffers({ categoryIds: [...branchIds] });
  const parent = category.parent_id ? categories.find((item) => item.id === category.parent_id) : null;
  const ancestors: typeof categories = [];
  let current = parent;
  while (current) {
    ancestors.unshift(current);
    current = current.parent_id ? categories.find((item) => item.id === current?.parent_id) : undefined;
  }

  const storeProducts = new Map<string, Set<string>>();
  for (const offer of allOffers) {
    const storeSlug = offer.merchants?.slug;
    const productId = offer.products?.id;
    if (!storeSlug || !productId) continue;
    const productIds = storeProducts.get(storeSlug) ?? new Set<string>();
    productIds.add(productId);
    storeProducts.set(storeSlug, productIds);
  }
  const categoryStores = stores.filter((store) => storeProducts.has(store.slug));
  const availableProductIds = new Set(allOffers.map((offer) => offer.products?.id).filter(Boolean));
  const selectedStores = values(filters.store);
  const selectedSubcategories = values(filters.subcategory);
  const selectedSubcategoryIds = new Set(categories.filter((item) => selectedSubcategories.includes(item.slug)).map((item) => item.id));
  const selectedSubcategoryBranch = new Set<string>();
  selectedSubcategoryIds.forEach((id) => categoryBranchIds(categories, id).forEach((childId) => selectedSubcategoryBranch.add(childId)));
  const query = filters.q?.trim().toLowerCase();

  let filteredOffers = allOffers.filter((offer) => {
    const searchable = `${offer.products?.title ?? ''} ${offer.products?.brand ?? ''} ${offer.products?.categories?.name ?? ''} ${offer.merchants?.name ?? ''}`.toLowerCase();
    if (query && !searchable.includes(query)) return false;
    if (selectedStores.length && !selectedStores.includes(offer.merchants?.slug ?? '')) return false;
    if (filters.cashback === 'yes' && !hasCashback(offer)) return false;
    if (selectedSubcategoryBranch.size && !selectedSubcategoryBranch.has(offer.products?.categories?.id ?? '')) return false;
    const price = offer.current_price;
    if (filters.price === 'under-1000' && (price == null || price >= 1000)) return false;
    if (filters.price === '1000-5000' && (price == null || price < 1000 || price >= 5000)) return false;
    if (filters.price === '5000-10000' && (price == null || price < 5000 || price >= 10000)) return false;
    if (filters.price === 'over-10000' && (price == null || price < 10000)) return false;
    return true;
  });

  const productOffers = sortOffers(uniqueOffers(filteredOffers), filters.sort ?? 'relevance');
  const cashbackCount = new Set(allOffers.filter(hasCashback).map((offer) => offer.products?.id).filter(Boolean)).size;
  const hasFilters = Boolean(query || selectedStores.length || selectedSubcategories.length || filters.cashback === 'yes' || filters.price);
  const collection = ['top25', 'top-cashback'].includes(filters.collection ?? '') ? filters.collection! : 'top50';
  const displayedOffers = collection === 'top-cashback'
    ? sortOffers(productOffers, 'cashback').slice(0, 50)
    : productOffers.slice(0, collection === 'top25' ? 25 : 50);
  const categoryChildren = categories
    .filter((item) => branchIds.has(item.id) && item.id !== category.id)
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));
  const subcategoryCounts = new Map<string, number>();
  categoryChildren.forEach((item) => {
    const ids = categoryBranchIds(categories, item.id);
    subcategoryCounts.set(item.slug, new Set(allOffers.filter((offer) => ids.has(offer.products?.categories?.id ?? '')).map((offer) => offer.products?.id).filter(Boolean)).size);
  });
  const categoryImage = category.banner_url || category.image_url;
  const categoryDescription = category.short_description || category.description || `Find ${category.name.toLowerCase()} picks, compare available stores, and browse eligible offers on Glonni.`;

  return <><Header/><main className="vertical-page category-browse-page">
    <nav className="category-breadcrumb" aria-label="Breadcrumb">
      <Link href="/">Home</Link><ChevronRight aria-hidden="true" size={14}/>
      {ancestors.map((item) => <span key={item.id}><Link href={`/category/${item.slug}`}>{item.name}</Link><ChevronRight aria-hidden="true" size={14}/></span>)}
      <b aria-current="page">{category.name}</b>
    </nav>

    <section className="category-hero" aria-labelledby="category-title">
      {categoryImage && <picture className="category-hero-media">
        {category.banner_url && category.mobile_banner_url && <source media="(max-width: 700px)" srcSet={category.mobile_banner_url}/>}
        <img src={categoryImage} alt="" fetchPriority="high"/>
      </picture>}
      <div className="category-hero-copy"><p className="eyebrow">SHOP BY CATEGORY</p><h1 id="category-title">{category.name}</h1><p>{categoryDescription}</p><a className="category-hero-cta" href="#category-deals">Explore deals <ArrowRight size={17}/></a></div>
    </section>

    <section className="category-store-section" aria-labelledby="category-store-title">
      <header><div><h2 id="category-store-title">Shop {category.name} stores</h2><p>{categoryStores.length} {categoryStores.length === 1 ? 'store' : 'stores'} available</p></div><Link href={`/stores?category=${encodeURIComponent(category.slug)}`}>View all <ArrowRight size={15}/></Link></header>
      {categoryStores.length ? <ScrollRail className="category-store-rail" label={`${category.name} stores`}>
        {categoryStores.map((store) => <StoreCard key={store.id} href={`/store/${store.slug}?from=${encodeURIComponent(`/category/${category.slug}`)}`} name={store.name} logoUrl={store.logo_url} layout="horizontal" meta={`${storeProducts.get(store.slug)?.size ?? 0} available offers`} className="category-store-card"/>)}
      </ScrollRail> : <div className="category-store-empty"><Store size={18}/><span>Stores with active {category.name.toLowerCase()} offers will appear here.</span></div>}
    </section>

    <CmsManagedSections pageKey="category" slot="after_heading"/>
    <CmsManagedSections pageKey="category" slot="before_results"/>

    <section className="category-deals" id="category-deals" aria-labelledby="category-deals-title">
      <details className="category-filter-panel" open>
        <summary><span>Filters</span><span className="category-filter-summary-mark" aria-hidden="true">⌄</span></summary>
        {hasFilters && <Link className="category-filter-clear" href={`/category/${category.slug}`}><RotateCcw size={13}/>Clear</Link>}
        <form action={`/category/${category.slug}`} method="get">
          <input type="hidden" name="collection" value={collection}/>
          <label className="category-filter-search"><span>Search products</span><span><Search size={15}/><input type="search" name="q" defaultValue={filters.q} placeholder={`Search ${category.name}`}/></span></label>
          {categoryChildren.length > 0 && <fieldset><legend>Category</legend><div className="category-filter-options category-filter-subcategories">{categoryChildren.map((item) => <label key={item.id} style={{ paddingInlineStart: `${Math.min(item.level, 4) * 8}px` }}><input type="checkbox" name="subcategory" value={item.slug} defaultChecked={selectedSubcategories.includes(item.slug)}/><span>{item.name}</span><small>{subcategoryCounts.get(item.slug) ?? 0}</small></label>)}</div></fieldset>}
          {categoryStores.length > 0 && <fieldset><legend>Store</legend><div className="category-filter-options">{categoryStores.map((store) => <label key={store.id}><input type="checkbox" name="store" value={store.slug} defaultChecked={selectedStores.includes(store.slug)}/><span>{store.name}</span><small>{storeProducts.get(store.slug)?.size ?? 0}</small></label>)}</div></fieldset>}
          <fieldset><legend>Price</legend><div className="category-filter-options">
            {[['', 'Any price'], ['under-1000', 'Under ₹1,000'], ['1000-5000', '₹1,000 – ₹5,000'], ['5000-10000', '₹5,000 – ₹10,000'], ['over-10000', 'Above ₹10,000']].map(([value, label]) => <label key={value || 'any-price'}><input type="radio" name="price" value={value} defaultChecked={(filters.price ?? '') === value}/><span>{label}</span></label>)}
          </div></fieldset>
          <fieldset><legend>Cashback eligible</legend><div className="category-filter-options"><label><input type="checkbox" name="cashback" value="yes" defaultChecked={filters.cashback === 'yes'}/><span>Show only cashback offers</span><small>{cashbackCount}</small></label></div></fieldset>
          <label className="category-sort-control"><span>Sort by</span><select name="sort" defaultValue={filters.sort ?? 'relevance'}><option value="relevance">Relevance</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="cashback">Highest cashback</option><option value="discount">Biggest discount</option></select></label>
          <button className="category-filter-submit" type="submit">Apply filters</button>
        </form>
      </details>

      <div className="category-deal-results">
        <header className="category-deal-heading"><div><h2 id="category-deals-title">Top deals in {category.name}</h2><p>{productOffers.length.toLocaleString('en-IN')} products with available offers</p></div><span>{displayedOffers.length} shown</span></header>
        <nav className="category-collections" aria-label="Product collections">
          {[
            ['top50', 'Top 50'],
            ['top25', 'Top 25'],
            ['top-cashback', 'Top cashback'],
          ].map(([key, label]) => <Link key={key} href={categoryLink(category.slug, filters, { collection: key })} aria-current={collection === key ? 'page' : undefined} className={collection === key ? 'active' : ''}>{label}</Link>)}
        </nav>
        {hasFilters && <Link className="category-clear-filters" href={`/category/${category.slug}`}><RotateCcw size={14}/>Clear filters</Link>}
        {displayedOffers.length ? <OfferGrid offers={displayedOffers} contextHref={categoryLink(category.slug, filters, {})}/> : <div className="empty-state category-empty"><Store size={30}/><h2>{hasFilters ? 'No products match these filters' : `No products in ${category.name} yet`}</h2><p>{hasFilters ? 'Clear a filter or try a broader search.' : `Approved products assigned to ${category.name} or its subcategories will appear here automatically.`}</p>{hasFilters && <Link href={`/category/${category.slug}`} className="primary">Clear all filters</Link>}</div>}
      </div>
    </section>
    <CmsManagedSections pageKey="category" slot="page_end"/>
  </main></>;
}
