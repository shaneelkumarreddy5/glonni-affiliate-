import Link from 'next/link';
import { RotateCcw, Search, Store } from 'lucide-react';
import { notFound } from 'next/navigation';
import { Header } from '@/components/header';
import { BrowseNav } from '@/components/browse-nav';
import { OfferGrid } from '@/components/offer-grid';
import { ContextualFaqs } from '@/components/contextual-faqs';
import { categoryBranchIds, orderCategoryTree } from '@/lib/category-tree';
import { getCatalogOffers, getCategories, getStores } from '@/lib/catalog';
import { safeReturnPath } from '@/lib/navigation';
import { hasCashback } from '@/lib/rewards';
import { createClient } from '@/lib/supabase/server';

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
  const activeTerms = [...new Set(allOffers.map((offer) => offer.reward_terms).filter((term): term is string => Boolean(term)))].slice(0, 4);
  let policyData: Record<string,string> = {};
  try { policyData = JSON.parse(store.review_notes || '{}').policies || {}; } catch { policyData = {}; }
  const hasFilters = Boolean(filters.q || filters.category || filters.cashback || filters.price);

  return <><Header/><main className="store-detail-page">
    <BrowseNav items={[{ label: returnPath.startsWith('/category/') ? 'Category' : 'Stores', href: returnPath }, { label: store.name }]} fallback={returnPath}/>
    <section className="store-hero store-profile-hero"><p className="eyebrow">SHOP BY STORE</p><div>{store.logo_url ? <span className="store-hero-logo"><img src={store.logo_url} alt=""/></span> : <span>{store.name.slice(0, 1)}</span>}<section><h1>{store.name} on Glonni</h1><p>Browse products available from {store.name}, then open a product to compare this store with every other connected seller.</p></section></div><aside><b>{new Set(allOffers.map((offer) => offer.products?.id).filter(Boolean)).size}</b><small>products</small><b>{allOffers.length}</b><small>offers</small><b>{rewards}</b><small>cashback-eligible</small></aside></section>

    <section className="vertical-section store-products-section">
      <div className="section-title"><div><p className="eyebrow">{store.name.toUpperCase()} PRODUCTS</p><h2>Browse and compare</h2></div>{hasFilters && <Link className="clear-category-filters" href={`/store/${store.slug}?from=${encodeURIComponent(returnPath)}`}><RotateCcw size={14}/>Clear filters</Link>}</div>
      <form className="category-search" action={`/store/${store.slug}`}><Search size={18}/><input name="q" defaultValue={filters.q} aria-label={`Search ${store.name} products`} placeholder={`Search products and brands at ${store.name}`}/><input type="hidden" name="from" value={returnPath}/><button type="submit">Search</button></form>

      {storeCategories.length > 0 && <div className="store-category-select"><label htmlFor="store-category">Category</label><div><select id="store-category" name="category" defaultValue={filters.category ?? ''} form="store-filter-submit"><option value="">All categories</option>{storeCategories.map((category) => <option value={category.slug} key={category.id}>{`${'  '.repeat(category.treeDepth)}${category.treeDepth ? '↳ ' : ''}${category.name}`}</option>)}</select><form id="store-filter-submit" action={`/store/${store.slug}`}><input type="hidden" name="from" value={returnPath}/><button type="submit">Apply category</button></form></div></div>}
      <div className="category-filter-columns">
        <div className="category-filter-group"><b>Customer benefit</b><div className="filter-row"><Link className={filters.cashback !== 'yes' ? 'selected' : ''} href={storeLink(store.slug, filters, { cashback: '' })}>All offers</Link><Link className={filters.cashback === 'yes' ? 'selected' : ''} href={storeLink(store.slug, filters, { cashback: 'yes' })}>Cashback eligible</Link></div></div>
        <div className="category-filter-group"><b>Price</b><div className="filter-row"><Link className={!filters.price ? 'selected' : ''} href={storeLink(store.slug, filters, { price: '' })}>Any price</Link><Link className={filters.price === 'under-1000' ? 'selected' : ''} href={storeLink(store.slug, filters, { price: 'under-1000' })}>Under ₹1,000</Link><Link className={filters.price === 'under-5000' ? 'selected' : ''} href={storeLink(store.slug, filters, { price: 'under-5000' })}>Under ₹5,000</Link><Link className={filters.price === 'over-5000' ? 'selected' : ''} href={storeLink(store.slug, filters, { price: 'over-5000' })}>₹5,000+</Link></div></div>
      </div>
      <div className="category-result-summary"><b>{products.length} {products.length === 1 ? 'product' : 'products'}</b><span>{hasFilters ? 'matching your filters' : `available from ${store.name}`}</span></div>
      {products.length ? <OfferGrid offers={products} contextHref={storeLink(store.slug, filters, {})}/> : <div className="empty-state store-products-empty"><Store size={30}/><h2>{hasFilters ? 'No products match these filters' : `No offers from ${store.name} yet`}</h2><p>{hasFilters ? 'Clear the filters or try a broader search.' : 'Approved products will appear here when they become available.'}</p>{hasFilters ? <Link href={`/store/${store.slug}?from=${encodeURIComponent(returnPath)}`} className="primary">Clear all filters</Link> : <Link href="/stores" className="primary">Browse other stores</Link>}</div>}
    </section>

    <section className="store-terms"><div><p className="eyebrow">IMPORTANT BEFORE SHOPPING</p><h2>{store.name} offer and cashback terms</h2><p>{policyData.customerNotice || `Price, availability, bank offers, coupons, delivery and returns are controlled by ${store.name}. Glonni cashback applies only when the exact selected offer is marked eligible and tracking completes successfully.`}</p></div>{activeTerms.length > 0 && <ul>{activeTerms.map((term) => <li key={term}>{term}</li>)}</ul>}</section>
    {(policyData.cashbackRules||policyData.termsConditions||policyData.returnsPolicy||policyData.privacyPolicy)&&<section className="store-policy-content"><p className="eyebrow">STORE POLICIES</p><h2>Shopping with {store.name}</h2><div>{policyData.cashbackRules&&<details open><summary>Cashback rules</summary><p>{policyData.cashbackRules}</p></details>}{policyData.termsConditions&&<details><summary>Terms &amp; conditions</summary><p>{policyData.termsConditions}</p></details>}{policyData.returnsPolicy&&<details><summary>Returns, cancellations &amp; exclusions</summary><p>{policyData.returnsPolicy}</p></details>}{policyData.privacyPolicy&&<details><summary>Privacy policy</summary><p>{policyData.privacyPolicy}</p></details>}</div></section>}
    <ContextualFaqs title={`${store.name} cashback rules & FAQs`} faqs={(faqs ?? []) as { id: string; question: string; answer: string; scope: string }[]}/>
  </main></>;
}
