import { Fragment, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Clock3, ExternalLink, Search, ShoppingBag, WalletCards } from 'lucide-react';
import { notFound } from 'next/navigation';
import { Header } from '@/components/header';
import { BrowseNav } from '@/components/browse-nav';
import { OfferGrid } from '@/components/offer-grid';
import { ContextualFaqs } from '@/components/contextual-faqs';
import { CmsManagedSections, getPublishedWebsiteLayout } from '@/components/cms-managed-sections';
import { CustomerPolicyAccordions, parseCustomerPolicy } from '@/components/customer-policy-accordions';
import { CategoryCard } from '@/components/category-card';
import { HomeOfferRail } from '@/components/home-offer-rail';
import { ScrollRail } from '@/components/scroll-rail';
import { categoryBranchIds, orderCategoryTree } from '@/lib/category-tree';
import { getCatalogOffers, getCategories, getStores, type CatalogOffer } from '@/lib/catalog';
import { safeReturnPath } from '@/lib/navigation';
import { hasCashback } from '@/lib/rewards';
import { createClient } from '@/lib/supabase/server';
import { resolveWebsiteSectionOrder, type WebsiteCoreContent } from '@/lib/website-layout';
import { renderWebsiteRichText } from '@/lib/website-rich-text';
import styles from './store-page.module.css';

export const dynamic = 'force-dynamic';
type StoreFilters = { from?: string; q?: string; category?: string; cashback?: string; price?: string };

function storeLink(slug: string, filters: StoreFilters, changes: StoreFilters) {
  const params = new URLSearchParams();
  Object.entries({ ...filters, ...changes }).forEach(([key, value]) => { if (value) params.set(key, value); });
  const query = params.toString();
  return `/store/${slug}${query ? `?${query}` : ''}`;
}

function uniqueOffers(offers: CatalogOffer[]) {
  const byProduct = new Map<string, CatalogOffer>();
  for (const offer of offers) {
    const id = offer.products?.id;
    if (!id) continue;
    const current = byProduct.get(id);
    const effective = (row: CatalogOffer) => (row.current_price ?? Infinity) - (hasCashback(row) ? row.cashback_amount ?? 0 : 0);
    if (!current || effective(offer) < effective(current)) byProduct.set(id, offer);
  }
  return [...byProduct.values()];
}

function TrackingLink({ href, label, className }: { href: string; label: string; className: string }) {
  if (href.startsWith('/') && !href.startsWith('//') && !href.includes('\\')) return <Link className={className} href={href}>{label}<ArrowRight size={16}/></Link>;
  try { if (new URL(href).protocol !== 'https:') return null; } catch { return null; }
  return <a className={className} href={href} target="_blank" rel="sponsored noopener noreferrer">{label}<ExternalLink size={15}/></a>;
}

function HowItWorks({ storeName, href, ctaLabel }: { storeName: string; href?: string; ctaLabel: string }) {
  const steps = [
    { icon: <Search/>, title: 'Browse deals on Glonni', detail: 'Choose an active offer and review its cashback terms.' },
    { icon: <ShoppingBag/>, title: `Shop on ${storeName}`, detail: 'Continue through the configured store destination.' },
    { icon: <WalletCards/>, title: 'Earn cashback', detail: 'Eligible cashback appears after provider confirmation and validation.' },
  ];
  return <section className={styles.processSection} aria-labelledby="store-how-title">
    <header className={styles.sectionHeading}><h2 id="store-how-title">How It Works</h2></header>
    <div className={styles.processCard}>
      {steps.map((step, index) => <Fragment key={step.title}>
        <article className={styles.processStep}><span>{step.icon}</span><b>{step.title}</b><small>{step.detail}</small></article>
        {index < steps.length - 1 && <ArrowRight className={styles.processArrow} aria-hidden="true"/>}
      </Fragment>)}
      {href && <TrackingLink className={styles.shopButton} href={href} label={ctaLabel}/>}
    </div>
  </section>;
}

function CashbackTimeline({ tracking, confirmation, credit }: { tracking: string; confirmation: string; credit: string }) {
  const steps = [
    { icon: <ShoppingBag/>, title: 'Purchase tracking', note: tracking, tone: 'blue' },
    { icon: <Clock3/>, title: 'Cashback confirmation', note: confirmation, tone: 'amber' },
    { icon: <CheckCircle2/>, title: 'Cashback credited', note: credit, tone: 'green' },
  ];
  return <section className={styles.timelineSection} aria-labelledby="cashback-timeline-title">
    <header className={styles.sectionHeading}><h2 id="cashback-timeline-title">Cashback Timeline</h2></header>
    <div className={styles.timelineCard}>{steps.map((step, index) => <Fragment key={step.title}>
      <article className={styles.timelineStep}>
        <span className={styles[`timeline_${step.tone}`]}>{step.icon}</span>
        <b>{step.title}</b><small>{step.note}</small>
      </article>
      {index < steps.length - 1 && <span className={styles.timelineConnector} aria-hidden="true"/>}
    </Fragment>)}</div>
  </section>;
}

export default async function StorePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<StoreFilters> }) {
  const slug = (await params).slug;
  const filters = await searchParams;
  const returnPath = safeReturnPath(filters.from, '/stores');
  const [stores, allOffers, categories] = await Promise.all([getStores(), getCatalogOffers({ store: slug }), getCategories()]);
  const store = stores.find((item) => item.slug === slug);
  if (!store) notFound();

  const supabase = await createClient();
  const { data: faqRows } = await supabase.from('support_faqs').select('id,question,answer,scope').eq('merchant_id', store.id).eq('is_active', true).order('display_order');
  const faqs = (faqRows ?? []) as { id: string; question: string; answer: string; scope: string }[];
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
  const directCategoryIds = new Set(allOffers.map((offer) => offer.products?.categories?.id).filter((id): id is string => Boolean(id)));
  const relevantIds = new Set<string>();
  for (const category of categories) if (directCategoryIds.has(category.id)) {
    let current: typeof category | undefined = category;
    const ancestors = new Set<string>();
    while (current && !ancestors.has(current.id)) {
      ancestors.add(current.id);
      relevantIds.add(current.id);
      current = current.parent_id ? categories.find((item) => item.id === current?.parent_id) : undefined;
    }
  }
  const allStoreCategories = orderCategoryTree(categories).filter((category) => relevantIds.has(category.id));
  const layout = await getPublishedWebsiteLayout('stores');
  const sectionOrder = resolveWebsiteSectionOrder('stores', layout.blocks, layout.section_order);
  const coreContent = { ...(layout.core_content ?? {}), ...(layout.store_content?.[slug] ?? {}) } as Record<string, WebsiteCoreContent>;
  const heroContent = coreContent.store_intro ?? {};
  const productContent = coreContent.store_products ?? {};
  const cashbackOffers = allOffers.filter(hasCashback);
  const confirmationDays = [...new Set(cashbackOffers.map((offer) => offer.cashback_confirmation_days).filter((days): days is number => days != null && days > 0))];
  const defaultConfirmation = confirmationDays.length === 1 ? `Within ${confirmationDays[0]} days, as configured for eligible offers.` : confirmationDays.length > 1 ? 'Timing varies by eligible offer.' : 'Confirmation timing is not configured for these offers.';
  const timeline = {
    tracking: heroContent.tracking_note?.trim() || 'Tracking begins after you open an eligible offer from Glonni and complete your purchase as directed.',
    confirmation: heroContent.confirmation_note?.trim() || defaultConfirmation,
    credit: heroContent.credit_note?.trim() || 'Credited to your Glonni wallet after provider confirmation and Glonni validation.',
  };
  // A merchant homepage is not necessarily an affiliate destination. Keep the
  // CTA hidden until an admin configures the approved campaign URL in Website.
  const configuredHref = heroContent.cta_href?.trim() || '';
  const configuredCtaLabel = heroContent.cta_label?.trim() || 'Shop Now';
  const selectedCategoryIds = productContent.category_ids ?? [];
  const storeCategories = (selectedCategoryIds.length ? allStoreCategories.filter((category) => selectedCategoryIds.includes(category.id)) : allStoreCategories).slice(0, 12);
  const byEffectivePrice = uniqueOffers(allOffers).sort((a, b) => {
    const price = (offer: CatalogOffer) => (offer.current_price ?? Infinity) - (hasCashback(offer) ? offer.cashback_amount ?? 0 : 0);
    return price(a) - price(b);
  });
  const selectedProductIds = productContent.product_ids ?? [];
  const rankedDeals = selectedProductIds.length
    ? uniqueOffers(allOffers.filter((offer) => offer.products && selectedProductIds.includes(offer.products.id))).sort((a, b) => selectedProductIds.indexOf(a.products?.id ?? '') - selectedProductIds.indexOf(b.products?.id ?? ''))
    : byEffectivePrice;
  const topDeals = rankedDeals.slice(0, Math.max(1, Math.min(50, productContent.count ?? 10)));
  const policyData = parseCustomerPolicy(store.review_notes);
  const hasFilters = Boolean(filters.q || filters.category || filters.cashback || filters.price);
  const coreSections: Record<string, ReactNode> = {
    'core:store_intro': <>
      <section className={styles.storeHero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>SHOP ON {store.name.toUpperCase()}</p>
          <h1>{renderWebsiteRichText(heroContent.title || `${store.name} deals & cashback`)}</h1>
          <p className={styles.heroDescription}>{heroContent.body ? renderWebsiteRichText(heroContent.body) : `Browse active ${store.name} offers on Glonni. Cashback is shown only where the individual offer is eligible.`}</p>
        </div>
        {heroContent.image_url ? <div className={styles.heroImage}><img src={heroContent.image_url} alt={`${store.name} promotion`}/></div> : <div className={styles.heroImagePlaceholder} aria-label={`${store.name} banner image can be added in Website Builder`}><span>{store.logo_url ? <img src={store.logo_url} alt=""/> : store.name.slice(0, 1)}</span></div>}
      </section>
      <HowItWorks storeName={store.name} href={configuredHref || undefined} ctaLabel={configuredCtaLabel}/>
      <CashbackTimeline tracking={timeline.tracking} confirmation={timeline.confirmation} credit={timeline.credit}/>
    </>,
    'core:store_products': <section className={styles.storeDiscovery} id="store-products">
      {storeCategories.length > 0 && <section className={styles.categorySection} aria-labelledby="store-category-title">
        <header className={styles.sectionHeading}><div><h2 id="store-category-title">Shop {store.name} by Category</h2><p>Browse categories with active offers from this store.</p></div></header>
        <ScrollRail className={styles.categoryRail} label={`${store.name} categories`}>
          {storeCategories.map((category) => {
            const count = new Set(allOffers.filter((offer) => offer.products?.categories?.id && categoryBranchIds(categories, category.id).has(offer.products.categories.id)).map((offer) => offer.products?.id).filter(Boolean)).size;
            return <CategoryCard key={category.id} href={`/store/${store.slug}?category=${encodeURIComponent(category.slug)}`} name={category.name} imageUrl={category.image_url} subtitle={`${count} ${count === 1 ? 'deal' : 'deals'}`}/>;
          })}
        </ScrollRail>
      </section>}
      {topDeals.length > 0 && <section className={styles.dealsSection} aria-labelledby="top-store-deals-title">
        <header className={styles.sectionHeading}><div><h2 id="top-store-deals-title">Top Deals on {store.name}</h2><p>Active approved offers from this store. Cashback appears only when the offer is eligible.</p></div><a href="#all-store-offers">View all <ArrowRight size={15}/></a></header>
        <HomeOfferRail offers={topDeals}/>
      </section>}
      <section className={`vertical-section store-products-section ${styles.allOffers}`} id="all-store-offers">
        <div className="section-title"><div><p className="eyebrow">{store.name.toUpperCase()} OFFERS</p><h2>{renderWebsiteRichText(productContent.title || 'Browse all deals')}</h2>{productContent.body && <span>{renderWebsiteRichText(productContent.body)}</span>}</div>{hasFilters && <Link className="clear-category-filters" href={`/store/${store.slug}?from=${encodeURIComponent(returnPath)}`}>Clear filters</Link>}</div>
        <form className="category-search" action={`/store/${store.slug}`}><Search size={18}/><input name="q" defaultValue={filters.q} aria-label={`Search ${store.name} products`} placeholder={`Search products and brands at ${store.name}`}/><input type="hidden" name="from" value={returnPath}/><button type="submit">Search</button></form>
        {storeCategories.length > 0 && <div className="store-category-select"><label htmlFor="store-category">Category</label><div><select id="store-category" name="category" defaultValue={filters.category ?? ''} form="store-filter-submit"><option value="">All categories</option>{storeCategories.map((category) => <option value={category.slug} key={category.id}>{`${'  '.repeat(category.treeDepth)}${category.treeDepth ? '↳ ' : ''}${category.name}`}</option>)}</select><form id="store-filter-submit" action={`/store/${store.slug}`}><input type="hidden" name="from" value={returnPath}/><button type="submit">Apply category</button></form></div></div>}
        <div className="category-filter-columns"><div className="category-filter-group"><b>Customer benefit</b><div className="filter-row"><Link className={filters.cashback !== 'yes' ? 'selected' : ''} href={storeLink(store.slug, filters, { cashback: '' })}>All offers</Link><Link className={filters.cashback === 'yes' ? 'selected' : ''} href={storeLink(store.slug, filters, { cashback: 'yes' })}>Cashback eligible</Link></div></div><div className="category-filter-group"><b>Price</b><div className="filter-row"><Link className={!filters.price ? 'selected' : ''} href={storeLink(store.slug, filters, { price: '' })}>Any price</Link><Link className={filters.price === 'under-1000' ? 'selected' : ''} href={storeLink(store.slug, filters, { price: 'under-1000' })}>Under ₹1,000</Link><Link className={filters.price === 'under-5000' ? 'selected' : ''} href={storeLink(store.slug, filters, { price: 'under-5000' })}>Under ₹5,000</Link><Link className={filters.price === 'over-5000' ? 'selected' : ''} href={storeLink(store.slug, filters, { price: 'over-5000' })}>₹5,000+</Link></div></div></div>
        <div className="category-result-summary"><b>{products.length} {products.length === 1 ? 'product' : 'products'}</b><span>{hasFilters ? 'matching your filters' : `available from ${store.name}`}</span></div>
        {products.length ? <OfferGrid offers={products} contextHref={storeLink(store.slug, filters, {})}/> : <div className="empty-state store-products-empty"><ShoppingBag size={30}/><h2>{hasFilters ? 'No products match these filters' : `No approved offers from ${store.name} yet`}</h2><p>{hasFilters ? 'Clear the filters or try a broader search.' : 'Approved offers will appear here when they are available in the catalogue.'}</p>{hasFilters ? <Link href={`/store/${store.slug}?from=${encodeURIComponent(returnPath)}`} className="primary">Clear all filters</Link> : <Link href="/stores" className="primary">Browse other stores</Link>}</div>}
      </section>
    </section>,
    'core:store_policies': <CustomerPolicyAccordions storeName={store.name} policy={policyData} heading={coreContent.store_policies?.title || 'Terms & Conditions'} intro={coreContent.store_policies?.body || `Cashback rules and conditions specific to ${store.name}.`} openFirst={false}/>,
    'core:store_faqs': <ContextualFaqs title={coreContent.store_faqs?.title || `${store.name} Frequently Asked Questions`} eyebrow="FREQUENTLY ASKED QUESTIONS" intro={`Common questions about shopping with ${store.name} through Glonni.`} faqs={faqs} maxItems={8}/>,
  };

  return <><Header/><main className={`store-detail-page ${styles.page}`}>
    <BrowseNav items={[{ label: returnPath.startsWith('/category/') ? 'Category' : 'Stores', href: returnPath }, { label: store.name }]} fallback={returnPath}/>
    {sectionOrder.map((token) => <Fragment key={token}>{token.startsWith('core:') ? coreSections[token] : <CmsManagedSections pageKey="stores" blockIds={[token.slice(6)]} storeSlug={store.slug} offers={allOffers}/>}</Fragment>)}
  </main></>;
}
