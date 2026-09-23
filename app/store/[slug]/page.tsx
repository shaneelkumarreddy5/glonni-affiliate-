import { Fragment, type ReactNode } from 'react';
import Link from 'next/link';
import { RotateCcw, Search, Store } from 'lucide-react';
import { notFound } from 'next/navigation';
import { Header } from '@/components/header';
import { BrowseNav } from '@/components/browse-nav';
import { OfferGrid } from '@/components/offer-grid';
import { ContextualFaqs } from '@/components/contextual-faqs';
import { CmsManagedSections, getPublishedWebsiteLayout } from '@/components/cms-managed-sections';
import { CustomerPolicyAccordions, parseCustomerPolicy } from '@/components/customer-policy-accordions';
import { categoryBranchIds, orderCategoryTree } from '@/lib/category-tree';
import { getCatalogOffers, getCategories, getStores } from '@/lib/catalog';
import { safeReturnPath } from '@/lib/navigation';
import { hasCashback } from '@/lib/rewards';
import { createClient } from '@/lib/supabase/server';
import { resolveWebsiteSectionOrder } from '@/lib/website-layout';
import { renderWebsiteRichText } from '@/lib/website-rich-text';

export const dynamic = 'force-dynamic';
type StoreFilters = { from?: string; q?: string; category?: string; cashback?: string; price?: string };

function storeLink(slug: string, filters: StoreFilters, changes: StoreFilters) {
  const params = new URLSearchParams();
  Object.entries({ ...filters, ...changes }).forEach(([key, value]) => { if (value) params.set(key, value); });
  const query = params.toString();
  return `/store/${slug}${query ? `?${query}` : ''}`;
}

export default async function StorePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<StoreFilters> }) {
  const slug = (await params).slug;
  const filters = await searchParams;
  const returnPath = safeReturnPath(filters.from, '/stores');
  const [stores, allOffers, categories] = await Promise.all([getStores(), getCatalogOffers({ store: slug }), getCategories()]);
  const store = stores.find((item) => item.slug === slug);
  if (!store) notFound();

  const supabase = await createClient();
  const { data: faqs } = await supabase.from('support_faqs').select('id,question,answer,scope').eq('merchant_id', store.id).eq('is_active', true).order('display_order');
  const selectedCategory = categories.find((category) => category.slug === filters.category);
  const categoryIds = selectedCategory ? categoryBranchIds(categories, selectedCategory.id) : null;
  const query = filters.q?.trim().toLowerCase();
  let filteredOffers = allOffers.filter((offer) => !query || `${offer.products?.title ?? ''} ${offer.products?.brand ?? ''} ${offer.products?.categories?.name ?? ''}`.toLowerCase().includes(query));
  if (categoryIds) filteredOffers = filteredOffers.filter((offer) => offer.products?.categories?.id && categoryIds.has(offer.products.categories.id));
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
  const directCategoryIds = new Set(allOffers.map((offer) => offer.products?.categories?.id).filter(Boolean));
  const relevantIds = new Set<string>();
  for (const category of categories) if (directCategoryIds.has(category.id)) {
    let current: typeof category | undefined = category;
    while (current) {
      relevantIds.add(current.id);
      current = current.parent_id ? categories.find((item) => item.id === current?.parent_id) : undefined;
    }
  }
  const storeCategories = orderCategoryTree(categories).filter((category) => relevantIds.has(category.id));
  const rewards = allOffers.filter(hasCashback).length;
  const policyData = parseCustomerPolicy(store.review_notes);
  const hasFilters = Boolean(filters.q || filters.category || filters.cashback || filters.price);
  const layout = await getPublishedWebsiteLayout('stores');
  const sectionOrder = resolveWebsiteSectionOrder('stores', layout.blocks, layout.section_order);
  const coreContent = layout.core_content ?? {};

  const storeSections: Record<string, ReactNode> = {
    'core:store_intro': <section className="store-hero store-profile-hero"><p className="eyebrow">SHOP BY STORE</p><div>{store.logo_url ? <span className="store-hero-logo"><img src={store.logo_url} alt=""/></span> : <span>{store.name.slice(0, 1)}</span>}<section><h1>{coreContent.store_intro?.title || `${store.name} on Glonni`}</h1><p>{coreContent.store_intro?.body ? renderWebsiteRichText(coreContent.store_intro.body) : `Browse products available from ${store.name}, then open a product to compare this store with every other connected seller.`}</p></section></div><aside><b>{new Set(allOffers.map((offer) => offer.products?.id).filter(Boolean)).size}</b><small>products</small><b>{allOffers.length}</b><small>offers</small><b>{rewards}</b><small>cashback-eligible</small></aside></section>,
    'core:store_products': <section className="vertical-section store-products-section">
      <div className="section-title"><div><p className="eyebrow">{store.name.toUpperCase()} PRODUCTS</p><h2>{coreContent.store_products?.title || 'Browse and compare'}</h2>{coreContent.store_products?.body && <span>{renderWebsiteRichText(coreContent.store_products.body)}</span>}</div>{hasFilters && <Link className="clear-category-filters" href={`/store/${store.slug}?from=${encodeURIComponent(returnPath)}`}><RotateCcw size={14}/>Clear filters</Link>}</div>
      <form className="category-search" action={`/store/${store.slug}`}><Search size={18}/><input name="q" defaultValue={filters.q} aria-label={`Search ${store.name} products`} placeholder={`Search products and brands at ${store.name}`}/><input type="hidden" name="from" value={returnPath}/><button type="submit">Search</button></form>
      {storeCategories.length > 0 && <div className="store-category-select"><label htmlFor="store-category">Category</label><div><select id="store-category" name="category" defaultValue={filters.category ?? ''} form="store-filter-submit"><option value="">All categories</option>{storeCategories.map((category) => <option value={category.slug} key={category.id}>{`${'  '.repeat(category.treeDepth)}${category.treeDepth ? '↳ ' : ''}${category.name}`}</option>)}</select><form id="store-filter-submit" action={`/store/${store.slug}`}><input type="hidden" name="from" value={returnPath}/><button type="submit">Apply category</button></form></div></div>}
      <div className="category-filter-columns">
        <div className="category-filter-group"><b>Customer benefit</b><div className="filter-row"><Link className={filters.cashback !== 'yes' ? 'selected' : ''} href={storeLink(store.slug, filters, { cashback: '' })}>All offers</Link><Link className={filters.cashback === 'yes' ? 'selected' : ''} href={storeLink(store.slug, filters, { cashback: 'yes' })}>Cashback eligible</Link></div></div>
        <div className="category-filter-group"><b>Price</b><div className="filter-row"><Link className={!filters.price ? 'selected' : ''} href={storeLink(store.slug, filters, { price: '' })}>Any price</Link><Link className={filters.price === 'under-1000' ? 'selected' : ''} href={storeLink(store.slug, filters, { price: 'under-1000' })}>Under ₹1,000</Link><Link className={filters.price === 'under-5000' ? 'selected' : ''} href={storeLink(store.slug, filters, { price: 'under-5000' })}>Under ₹5,000</Link><Link className={filters.price === 'over-5000' ? 'selected' : ''} href={storeLink(store.slug, filters, { price: 'over-5000' })}>₹5,000+</Link></div></div>
      </div>
      <div className="category-result-summary"><b>{products.length} {products.length === 1 ? 'product' : 'products'}</b><span>{hasFilters ? 'matching your filters' : `available from ${store.name}`}</span></div>
      {products.length ? <OfferGrid offers={products} contextHref={storeLink(store.slug, filters, {})}/> : <div className="empty-state store-products-empty"><Store size={30}/><h2>{hasFilters ? 'No products match these filters' : `No offers from ${store.name} yet`}</h2><p>{hasFilters ? 'Clear the filters or try a broader search.' : 'Approved products will appear here when they become available.'}</p>{hasFilters ? <Link href={`/store/${store.slug}?from=${encodeURIComponent(returnPath)}`} className="primary">Clear all filters</Link> : <Link href="/stores" className="primary">Browse other stores</Link>}</div>}
    </section>,
    'core:store_policies': <CustomerPolicyAccordions storeName={store.name} policy={policyData} heading={coreContent.store_policies?.title} intro={coreContent.store_policies?.body}/>,
    'core:store_faqs': <ContextualFaqs title={coreContent.store_faqs?.title || `${store.name} cashback rules & FAQs`} faqs={(faqs ?? []) as { id: string; question: string; answer: string; scope: string }[]}/>,
  };

  return <><Header/><main className="store-detail-page">
    <BrowseNav items={[{ label: returnPath.startsWith('/category/') ? 'Category' : 'Stores', href: returnPath }, { label: store.name }]} fallback={returnPath}/>
    {sectionOrder.map((token) => <Fragment key={token}>{token.startsWith('core:') ? storeSections[token] : <CmsManagedSections pageKey="stores" blockIds={[token.slice(6)]} storeSlug={store.slug} offers={allOffers}/>}</Fragment>)}
  </main></>;
}
