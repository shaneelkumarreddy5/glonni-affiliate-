import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowRight,
  Baby,
  BadgePercent,
  BookOpen,
  ChevronDown,
  Dumbbell,
  House,
  Lamp,
  Laptop,
  Search,
  Shirt,
  SlidersHorizontal,
  Sparkles,
  Tag,
} from 'lucide-react';
import { MobileFilterPanelBehavior } from '@/components/mobile-filter-panel-behavior';
import { CustomerFilterChips } from '@/components/customer-filter-chips';
import { CustomerSortControl } from '@/components/customer-sort-control';
import { Header } from '@/components/header';
import { BrowseNav } from '@/components/browse-nav';
import { OfferGrid } from '@/components/offer-grid';
import { ScrollRail } from '@/components/scroll-rail';
import { CmsManagedSections } from '@/components/cms-managed-sections';
import { getPublishedWebsiteLayout } from '@/components/cms-managed-sections';
import { categoryBranchIds, orderCategoryTree } from '@/lib/category-tree';
import { CatalogOffer, getCatalogOffers, getCategories, getStores } from '@/lib/catalog';
import { hasCashback } from '@/lib/rewards';
import { resolveWebsiteSectionOrder, type WebsiteCoreContent } from '@/lib/website-layout';
import { renderWebsiteRichText } from '@/lib/website-rich-text';

export const dynamic = 'force-dynamic';

type ParamValue = string | string[] | undefined;
type Params = { q?: string; store?: ParamValue; category?: ParamValue; cashback?: string; price?: string; stock?: string; sort?: string; page?: string; collection?: string };
const PAGE_SIZE = 12;

function values(value: ParamValue) {
  return (Array.isArray(value) ? value : value ? [value] : []).filter(Boolean);
}

function dealsLink(filters: Params, changes: Params) {
  const params = new URLSearchParams();
  Object.entries({ ...filters, ...changes }).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach((item) => item && params.append(key, item));
    else if (value) params.set(key, value);
  });
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

function CategoryIcon({ name }: { name: string }) {
  const value = name.toLowerCase();
  const iconProps = { size: 18, strokeWidth: 1.8, 'aria-hidden': true as const };
  if (value.includes('electronic') || value.includes('laptop') || value.includes('mobile')) return <Laptop {...iconProps}/>;
  if (value.includes('home') || value.includes('kitchen') || value.includes('furnish')) return <House {...iconProps}/>;
  if (value.includes('fashion') || value.includes('cloth')) return <Shirt {...iconProps}/>;
  if (value.includes('beauty') || value.includes('personal') || value.includes('wellness')) return <Sparkles {...iconProps}/>;
  if (value.includes('sport') || value.includes('fitness')) return <Dumbbell {...iconProps}/>;
  if (value.includes('book') || value.includes('media')) return <BookOpen {...iconProps}/>;
  if (value.includes('toy') || value.includes('baby') || value.includes('kids')) return <Baby {...iconProps}/>;
  if (value.includes('decor') || value.includes('light')) return <Lamp {...iconProps}/>;
  return <Tag {...iconProps}/>;
}

export default async function DealsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const filters = await searchParams;
  const [allOffers, stores, categories, layout] = await Promise.all([getCatalogOffers(), getStores(), getCategories(), getPublishedWebsiteLayout('deals')]);
  const coreContent = (layout.core_content ?? {}) as Record<string, WebsiteCoreContent>;
  const visibleTabs = coreContent.deals_tabs?.tab_keys ?? ['trending', 'discount', 'cashback', 'top25', 'top50'];
  const orderedCategories = orderCategoryTree(categories);
  const topCategories = orderedCategories.filter((category) => !category.parent_id);
  const selectedCategorySlugs = values(filters.category);
  const selectedStoreSlugs = values(filters.store);
  const selectedCategories = categories.filter((category) => selectedCategorySlugs.includes(category.slug));
  const categoryIds = new Set(selectedCategories.flatMap((category) => [...categoryBranchIds(categories, category.id)]));
  const categoryPaths = new Map(orderedCategories.map((category) => [category.id, category.treePath.toLowerCase()]));
  const query = filters.q?.trim().toLowerCase();

  let filteredOffers = allOffers.filter((offer) => !query || `${offer.products?.title ?? ''} ${offer.products?.brand ?? ''} ${offer.merchants?.name ?? ''} ${offer.products?.categories?.name ?? ''} ${offer.products?.categories?.id ? categoryPaths.get(offer.products.categories.id) ?? '' : ''}`.toLowerCase().includes(query));
  if (selectedCategorySlugs.length) filteredOffers = filteredOffers.filter((offer) => offer.products?.categories?.id && categoryIds.has(offer.products.categories.id));
  if (selectedStoreSlugs.length) filteredOffers = filteredOffers.filter((offer) => selectedStoreSlugs.includes(offer.merchants?.slug ?? ''));
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
  const sort = filters.sort ?? 'effective-price';
  let products = [...groupedOffers.values()].map((offers) => [...offers].sort((a, b) => sort === 'cashback' ? cashbackValue(b) - cashbackValue(a) : effectivePrice(a) - effectivePrice(b))[0]);
  if (sort === 'discount') products.sort((a, b) => discountPercent(b) - discountPercent(a));
  else if (sort === 'rating') products.sort((a, b) => (b.customer_rating ?? 0) - (a.customer_rating ?? 0));
  else if (sort === 'popular' || sort === 'trending') products.sort((a, b) => (b.rating_count ?? 0) - (a.rating_count ?? 0));
  else if (sort === 'cashback') products.sort((a, b) => cashbackValue(b) - cashbackValue(a));
  else products.sort((a, b) => effectivePrice(a) - effectivePrice(b));

  const storesByProduct = new Map<string, Set<string>>();
  const productsByStore = new Map<string, Set<string>>();
  for (const offer of allOffers) {
    const productId = offer.products?.id;
    const storeSlug = offer.merchants?.slug;
    if (!productId) continue;
    const productStores = storesByProduct.get(productId) ?? new Set<string>();
    if (storeSlug) productStores.add(storeSlug);
    storesByProduct.set(productId, productStores);
    if (storeSlug) {
      const storeProducts = productsByStore.get(storeSlug) ?? new Set<string>();
      storeProducts.add(productId);
      productsByStore.set(storeSlug, storeProducts);
    }
  }
  const storeCounts = Object.fromEntries([...storesByProduct].map(([productId, productStores]) => [productId, productStores.size]));
  const categoryCounts = new Map<string, number>();
  for (const category of orderedCategories) {
    const branch = categoryBranchIds(categories, category.id);
    categoryCounts.set(category.slug, new Set(allOffers.filter((offer) => branch.has(offer.products?.categories?.id ?? '')).map((offer) => offer.products?.id).filter(Boolean)).size);
  }
  const cashbackCount = new Set(allOffers.filter(hasCashback).map((offer) => offer.products?.id).filter(Boolean)).size;

  const requestedPage = Number.parseInt(filters.page ?? '1', 10);
  const requestedCollection = ['top25', 'top50'].includes(filters.collection ?? '') ? filters.collection! : '';
  const collection = visibleTabs.includes(requestedCollection) ? requestedCollection : '';
  const pageSize = collection === 'top25' ? 25 : collection === 'top50' ? 50 : PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(products.length / pageSize));
  const page = Number.isFinite(requestedPage) ? Math.min(Math.max(requestedPage, 1), totalPages) : 1;
  const visibleProducts = products.slice((page - 1) * pageSize, page * pageSize);
  const activeFilters: { label: string; clear: Params }[] = [
    ...(filters.q ? [{ label: `Search: ${filters.q}`, clear: { q: '', page: '' } }] : []),
    ...selectedCategorySlugs.map((slug) => ({ label: categories.find((category) => category.slug === slug)?.name ?? slug, clear: { category: selectedCategorySlugs.filter((value) => value !== slug), page: '' } })),
    ...selectedStoreSlugs.map((slug) => ({ label: stores.find((store) => store.slug === slug)?.name ?? slug, clear: { store: selectedStoreSlugs.filter((value) => value !== slug), page: '' } })),
    ...(filters.price ? [{ label: `Price: ${filters.price.replaceAll('-', ' ')}`, clear: { price: '', page: '' } }] : []),
    ...(filters.cashback === 'yes' ? [{ label: 'Cashback eligible', clear: { cashback: '', page: '' } }] : []),
    ...(filters.stock === 'in-stock' ? [{ label: 'In stock', clear: { stock: '', page: '' } }] : []),
  ];

  const selectedCategory = selectedCategories.length === 1 ? selectedCategories[0] : null;
  const selectedStore = selectedStoreSlugs.length === 1 ? stores.find((store) => store.slug === selectedStoreSlugs[0]) : null;
  const isTrending = sort === 'trending' || sort === 'popular';
  const title = filters.q ? `Results for “${filters.q}”` : selectedCategory ? `${selectedCategory.name} deals` : selectedCategorySlugs.length > 1 ? 'Deals in selected categories' : selectedStore ? `Deals from ${selectedStore.name}` : selectedStoreSlugs.length > 1 ? 'Deals from selected stores' : isTrending ? 'Trending deals' : 'Compare the best deals';
  const intro = filters.q ? 'Explore matching products and offers from connected stores.' : selectedCategory || selectedCategorySlugs.length ? 'Explore popular products and offers in the categories you chose.' : selectedStore || selectedStoreSlugs.length ? 'Compare eligible products and offers from the stores you selected.' : 'Find offers shoppers are exploring across Glonni.';

  const heroProducts = [...new Map(allOffers.filter((offer) => offer.products?.id && offer.products.image_url).map((offer) => [offer.products!.id, offer])).values()].slice(0, 4);
  const sectionOrder = resolveWebsiteSectionOrder('deals', layout.blocks, layout.section_order);
  const introContent = coreContent.deals_intro ?? {};
  const categoriesContent = coreContent.deals_categories ?? {};
  const tabsContent = coreContent.deals_tabs ?? {};
  const resultsContent = coreContent.deals_results ?? {};
  const introSection = <section className="deals-hero" aria-labelledby="deals-title">
    <div className="deals-hero-copy"><p className="eyebrow">DISCOVER ON GLONNI</p><h1 id="deals-title">{introContent.title ? renderWebsiteRichText(introContent.title) : title}</h1><p>{introContent.body ? renderWebsiteRichText(introContent.body) : intro}</p><a className="deals-hero-cta" href={introContent.cta_href || '#deals-results'}>{introContent.cta_label || 'Explore deals'} <ArrowRight size={17}/></a></div>
    {heroProducts.length > 0 && <div className="deals-hero-visual" aria-hidden="true">{heroProducts.map((offer, index) => <div className={`deals-hero-product deals-hero-product-${index + 1}`} key={offer.id}><img src={offer.products?.image_url ?? ''} alt=""/><span>{offer.merchants?.name ?? ''}</span></div>)}</div>}
  </section>;
  const categoriesSection = <section className="deals-categories-section">
    {(categoriesContent.title || categoriesContent.body) && <header><h2>{categoriesContent.title ? renderWebsiteRichText(categoriesContent.title) : 'Shop deals by category'}</h2>{categoriesContent.body && <p>{renderWebsiteRichText(categoriesContent.body)}</p>}</header>}
    <ScrollRail className="deals-category-rail" label="Deal categories">
      <Link href={dealsLink(filters, { category: [], page: '' })} className={!selectedCategorySlugs.length ? 'active' : ''}><BadgePercent size={18} aria-hidden="true"/>All deals</Link>
      {topCategories.slice(0, categoriesContent.count ?? 50).map((category) => <Link href={dealsLink(filters, { category: category.slug, page: '' })} className={selectedCategorySlugs.includes(category.slug) ? 'active' : ''} key={category.id}><CategoryIcon name={category.name}/>{category.name}</Link>)}
    </ScrollRail>
  </section>;
  const dealTabs = [
    { key: 'trending', label: 'Trending', href: dealsLink(filters, { collection: '', sort: 'trending', page: '' }), active: isTrending },
    { key: 'discount', label: 'Biggest discounts', href: dealsLink(filters, { collection: '', sort: 'discount', page: '' }), active: sort === 'discount' },
    { key: 'cashback', label: 'Top cashback', href: dealsLink(filters, { collection: '', sort: 'cashback', page: '' }), active: sort === 'cashback' },
    { key: 'top25', label: 'Top 25', href: dealsLink(filters, { collection: 'top25', sort: 'effective-price', page: '' }), active: collection === 'top25' },
    { key: 'top50', label: 'Top 50', href: dealsLink(filters, { collection: 'top50', sort: 'effective-price', page: '' }), active: collection === 'top50' },
  ].filter((item) => visibleTabs.includes(item.key));
  const tabsSection = <section>{(tabsContent.title || tabsContent.body) && <header><h2>{tabsContent.title ? renderWebsiteRichText(tabsContent.title) : 'Browse deal collections'}</h2>{tabsContent.body && <p>{renderWebsiteRichText(tabsContent.body)}</p>}</header>}<nav className="deals-collection-tabs" aria-label="Deal collections">{dealTabs.map((item) => <Link key={item.key} href={item.href} className={item.active ? 'active' : ''} aria-current={item.active ? 'page' : undefined}>{item.label}</Link>)}</nav></section>;
  const resultsSection = <div className="deals-layout"><section className="deals-results" id="deals-results" aria-labelledby="deals-results-title">
    <div className="deals-toolbar"><div><h2 id="deals-results-title">{resultsContent.title ? renderWebsiteRichText(resultsContent.title) : isTrending ? 'Popular right now' : title}</h2><small>{resultsContent.body ? renderWebsiteRichText(resultsContent.body) : `${products.length.toLocaleString('en-IN')} ${products.length === 1 ? 'product' : 'products'} with available offers`}</small></div></div>
    <div className="customer-filter-controls">
      <MobileFilterPanelBehavior/>
      <details className="deals-filter-panel" data-filter-panel>
        <summary><span className="customer-filter-title"><SlidersHorizontal size={19} aria-hidden="true"/>Filters{activeFilters.length > 0 && <b className="customer-filter-count">{activeFilters.length}</b>}</span><ChevronDown size={18} className="deals-filter-chevron" aria-hidden="true"/></summary>
        <form action="/deals" method="get" className="deals-filter-form"><input type="hidden" name="sort" value={sort}/>{collection && <input type="hidden" name="collection" value={collection}/>}
          <label className="deals-filter-search"><span>Search products</span><span className="deals-filter-search-box"><Search size={16}/><input type="search" name="q" defaultValue={filters.q} placeholder="Search deals"/></span></label>
          <fieldset><legend>Category</legend><div className="deals-filter-options">{orderedCategories.map((category) => <label key={category.id} style={{ paddingInlineStart: `${Math.min(category.treeDepth, 3) * 8}px` }}><input type="checkbox" name="category" value={category.slug} defaultChecked={selectedCategorySlugs.includes(category.slug)}/><span>{category.name}</span><small>{categoryCounts.get(category.slug) ?? 0}</small></label>)}</div></fieldset>
          <fieldset><legend>Store</legend><div className="deals-filter-options">{stores.filter((store) => productsByStore.has(store.slug)).map((store) => <label key={store.id}><input type="checkbox" name="store" value={store.slug} defaultChecked={selectedStoreSlugs.includes(store.slug)}/><span>{store.name}</span><small>{productsByStore.get(store.slug)?.size ?? 0}</small></label>)}</div></fieldset>
          <fieldset><legend>Price</legend><div className="deals-filter-options">{[['', 'Any price'], ['under-1000', 'Under ₹1,000'], ['1000-5000', '₹1,000 – ₹4,999'], ['5000-25000', '₹5,000 – ₹24,999'], ['over-25000', '₹25,000+']].map(([value, label]) => <label key={value || 'any-price'}><input type="radio" name="price" value={value} defaultChecked={(filters.price ?? '') === value}/><span>{label}</span></label>)}</div></fieldset>
          <fieldset><legend>Availability</legend><div className="deals-filter-options"><label><input type="checkbox" name="stock" value="in-stock" defaultChecked={filters.stock === 'in-stock'}/><span>In stock</span></label></div></fieldset>
          <fieldset><legend>Cashback eligible</legend><div className="deals-filter-options"><label><input type="checkbox" name="cashback" value="yes" defaultChecked={filters.cashback === 'yes'}/><span>Show only cashback offers</span><small>{cashbackCount}</small></label></div></fieldset>
          <button type="submit">Apply filters</button>
        </form>
      </details>
      <CustomerSortControl action="/deals" value={sort} params={filters} options={[{ value: 'effective-price', label: 'Relevance' }, { value: 'trending', label: 'Trending' }, { value: 'discount', label: 'Biggest discounts' }, { value: 'cashback', label: 'Top cashback' }, { value: 'rating', label: 'Customer rating' }]}/>
    </div>
    <CustomerFilterChips chips={activeFilters.map((filter) => ({ label: filter.label.startsWith('Price: ') ? ({ 'under-1000': 'Under ₹1,000', '1000-5000': '₹1,000 – ₹4,999', '5000-25000': '₹5,000 – ₹24,999', 'over-25000': '₹25,000+' }[filters.price ?? ''] ?? filter.label) : filter.label === 'Cashback eligible' ? 'Cashback' : filter.label, href: dealsLink(filters, filter.clear) }))}/>
    {visibleProducts.length ? <OfferGrid offers={visibleProducts} contextHref={dealsLink(filters, {})} storeCounts={storeCounts} dealMode/> : <div className="empty-state deals-empty"><Search size={31}/><h2>No products match these filters</h2><p>Try a broader search, another category, or clear the current filters.</p><Link href="/deals" className="primary">Clear all filters</Link></div>}
    {products.length > pageSize && <nav className="deals-pagination" aria-label="Deals pages">{page > 1 ? <Link href={dealsLink(filters, { page: String(page - 1) })}><ArrowRight className="deals-page-previous" size={15}/>Previous</Link> : <span>Previous</span>}<b>Page {page} of {totalPages}</b>{page < totalPages ? <Link href={dealsLink(filters, { page: String(page + 1) })}>Next<ArrowRight size={15}/></Link> : <span>Next</span>}</nav>}
  </section></div>;
  const coreSections: Record<string, ReactNode> = { deals_intro: introSection, deals_categories: categoriesSection, deals_tabs: tabsSection, deals_results: resultsSection };

  return <><Header/><main className="deals-page">
    <BrowseNav items={[{ label: 'Deals' }]}/>
    {sectionOrder.map((token) => token.startsWith('core:') ? <div key={token}>{coreSections[token.slice(5)]}</div> : <CmsManagedSections key={token} pageKey="deals" blockIds={[token.slice(6)]}/>)}
  </main></>;
}
