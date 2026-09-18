import Link from 'next/link';
import { RotateCcw, Search, Store } from 'lucide-react';
import { notFound } from 'next/navigation';
import { Header } from '@/components/header';
import { BrowseNav } from '@/components/browse-nav';
import { OfferGrid } from '@/components/offer-grid';
import { getCatalogOffers, getCategories, getStores } from '@/lib/catalog';
import { categoryBranchIds } from '@/lib/category-tree';
import { hasCashback } from '@/lib/rewards';
import { CmsManagedSections } from '@/components/cms-managed-sections';

export const dynamic = 'force-dynamic';

type CategoryFilters = { q?: string; store?: string; cashback?: string; price?: string };

function categoryLink(slug: string, filters: CategoryFilters, changes: CategoryFilters) {
  const params = new URLSearchParams();
  Object.entries({ ...filters, ...changes }).forEach(([key, value]) => { if (value) params.set(key, value); });
  const query = params.toString();
  return `/category/${slug}${query ? `?${query}` : ''}`;
}

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<CategoryFilters> }) {
  const slug = (await params).slug;
  const filters = await searchParams;
  const [categories, stores] = await Promise.all([getCategories(), getStores()]);
  const category = categories.find((item) => item.slug === slug);
  if (!category) notFound();

  const branchIds = [...categoryBranchIds(categories, category.id)];
  const allOffers = await getCatalogOffers({ categoryIds: branchIds });
  const children = categories.filter((item) => item.parent_id === category.id).sort((a, b) => a.display_order - b.display_order);
  const parent = category.parent_id ? categories.find((item) => item.id === category.parent_id) : null;
  const ancestors: typeof categories = [];
  let current = parent;
  while (current) {
    ancestors.unshift(current);
    current = current.parent_id ? categories.find((item) => item.id === current?.parent_id) : undefined;
  }

  const availableStoreSlugs = new Set(allOffers.map((offer) => offer.merchants?.slug).filter(Boolean));
  const categoryStores = stores.filter((store) => availableStoreSlugs.has(store.slug));
  const query = filters.q?.trim().toLowerCase();
  let filteredOffers = allOffers.filter((offer) => !query || `${offer.products?.title ?? ''} ${offer.products?.brand ?? ''} ${offer.products?.categories?.name ?? ''} ${offer.merchants?.name ?? ''}`.toLowerCase().includes(query));
  if (filters.store) filteredOffers = filteredOffers.filter((offer) => offer.merchants?.slug === filters.store);
  if (filters.cashback === 'yes') filteredOffers = filteredOffers.filter(hasCashback);
  if (filters.price === 'under-1000') filteredOffers = filteredOffers.filter((offer) => (offer.current_price ?? Infinity) < 1000);
  if (filters.price === 'under-5000') filteredOffers = filteredOffers.filter((offer) => (offer.current_price ?? Infinity) < 5000);
  if (filters.price === 'over-5000') filteredOffers = filteredOffers.filter((offer) => (offer.current_price ?? 0) >= 5000);

  const seenProducts = new Set<string>();
  const products = filteredOffers.filter((offer) => {
    const productId = offer.products?.id;
    if (!productId || seenProducts.has(productId)) return false;
    seenProducts.add(productId);
    return true;
  });
  const allProductIds = new Set(allOffers.map((offer) => offer.products?.id).filter(Boolean));
  const cashbackCount = allOffers.filter(hasCashback).length;
  const hasFilters = Boolean(filters.q || filters.store || filters.cashback || filters.price);

  return <><Header/><main className="vertical-page category-browse-page">
    <BrowseNav items={[{ label: 'Categories', href: '/#categories' }, ...ancestors.map((item) => ({ label: item.name, href: `/category/${item.slug}` })), { label: category.name }]} fallback={parent ? `/category/${parent.slug}` : '/#categories'}/>

    <section className="vertical-hero category-hero">
      <div><p className="eyebrow">SHOP BY CATEGORY</p><h1>{category.name}</h1><p>{category.short_description || category.description || `Explore ${category.name}, open its subcategories, and compare available store offers.`}</p></div>
      <aside><span><b>{allProductIds.size}</b><small>products</small></span><span><b>{categoryStores.length}</b><small>stores</small></span><span><b>{cashbackCount}</b><small>eligible offers</small></span></aside>
    </section>
    <CmsManagedSections pageKey="category" slot="after_heading"/>

    {children.length > 0 && <section className="vertical-section category-children"><div className="section-title"><div><p className="eyebrow">ONE LEVEL AT A TIME</p><h2>Explore {category.name}</h2></div><small>Select a subcategory to open its next level</small></div><div className="category-grid">{children.map((child) => <Link href={`/category/${child.slug}`} key={child.id}><span className="category-icon">{child.image_url ? <img src={child.image_url} alt=""/> : '›'}</span><span><b>{child.name}</b><small>Open category</small></span></Link>)}</div></section>}

    <CmsManagedSections pageKey="category" slot="before_results"/>
    <section className="vertical-section category-results">
      <div className="section-title"><div><p className="eyebrow">PRODUCTS IN THIS BRANCH</p><h2>Browse and compare</h2></div>{hasFilters && <Link className="clear-category-filters" href={`/category/${category.slug}`}><RotateCcw size={14}/>Clear filters</Link>}</div>
      <form className="category-search" action={`/category/${category.slug}`}><Search size={18}/><input name="q" defaultValue={filters.q} aria-label={`Search in ${category.name}`} placeholder={`Search products and brands in ${category.name}`}/><button type="submit">Search</button></form>

      {categoryStores.length > 0 && <div className="category-filter-group"><b>Store</b><div className="filter-row"><Link className={!filters.store ? 'selected' : ''} href={categoryLink(category.slug, filters, { store: '' })}>All stores</Link>{categoryStores.map((store) => <Link className={filters.store === store.slug ? 'selected' : ''} href={categoryLink(category.slug, filters, { store: store.slug })} key={store.id}>{store.logo_url && <img src={store.logo_url} alt=""/>}{store.name}</Link>)}</div></div>}
      <div className="category-filter-columns">
        <div className="category-filter-group"><b>Customer benefit</b><div className="filter-row"><Link className={filters.cashback !== 'yes' ? 'selected' : ''} href={categoryLink(category.slug, filters, { cashback: '' })}>All offers</Link><Link className={filters.cashback === 'yes' ? 'selected' : ''} href={categoryLink(category.slug, filters, { cashback: 'yes' })}>Cashback eligible</Link></div></div>
        <div className="category-filter-group"><b>Price</b><div className="filter-row"><Link className={!filters.price ? 'selected' : ''} href={categoryLink(category.slug, filters, { price: '' })}>Any price</Link><Link className={filters.price === 'under-1000' ? 'selected' : ''} href={categoryLink(category.slug, filters, { price: 'under-1000' })}>Under ₹1,000</Link><Link className={filters.price === 'under-5000' ? 'selected' : ''} href={categoryLink(category.slug, filters, { price: 'under-5000' })}>Under ₹5,000</Link><Link className={filters.price === 'over-5000' ? 'selected' : ''} href={categoryLink(category.slug, filters, { price: 'over-5000' })}>₹5,000+</Link></div></div>
      </div>

      <div className="category-result-summary"><b>{products.length} {products.length === 1 ? 'product' : 'products'}</b><span>{hasFilters ? `matching your filters in ${category.name}` : `available across ${category.name} and its subcategories`}</span></div>
      {products.length ? <OfferGrid offers={products} contextHref={categoryLink(category.slug, filters, {})}/> : <div className="empty-state category-empty"><Store size={30}/><h2>{hasFilters ? 'No products match these filters' : `No products in ${category.name} yet`}</h2><p>{hasFilters ? 'Clear the filters or try a broader search.' : `Products assigned to ${category.name} or its subcategories will appear here automatically.`}</p>{hasFilters ? <Link href={`/category/${category.slug}`} className="primary">Clear all filters</Link> : parent ? <Link href={`/category/${parent.slug}`} className="primary">Return to {parent.name}</Link> : <Link href="/#categories" className="primary">Explore other categories</Link>}</div>}
    </section>
    <CmsManagedSections pageKey="category" slot="page_end"/>
  </main></>;
}
