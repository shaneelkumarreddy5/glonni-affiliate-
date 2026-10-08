import { Fragment, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, ChevronDown, Clock3, ExternalLink, Search, ShoppingBag, SlidersHorizontal, Store, WalletCards } from 'lucide-react';
import { notFound } from 'next/navigation';
import { CustomerFilterChips } from '@/components/customer-filter-chips';
import { CustomerSortControl } from '@/components/customer-sort-control';

import { MobileFilterPanelBehavior } from '@/components/mobile-filter-panel-behavior';
import { Header } from '@/components/header';
import { BrowseNav } from '@/components/browse-nav';
import { OfferGrid } from '@/components/offer-grid';
import { ContextualFaqs } from '@/components/contextual-faqs';
import { CmsManagedSections, getPublishedWebsiteLayout } from '@/components/cms-managed-sections';
import { CustomerPolicyAccordions, parseCustomerPolicy } from '@/components/customer-policy-accordions';
import { CategoryCard } from '@/components/category-card';
import { ScrollRail } from '@/components/scroll-rail';
import { categoryBranchIds, orderCategoryTree } from '@/lib/category-tree';
import { getCatalogOffers, getCategories, getStores, type CatalogOffer } from '@/lib/catalog';
import { safeReturnPath } from '@/lib/navigation';
import { hasCashback } from '@/lib/rewards';
import { createClient } from '@/lib/supabase/server';
import { ensureStorePolicyBeforeFaq, resolveWebsiteSectionOrder, type WebsiteCoreContent } from '@/lib/website-layout';
import { renderWebsiteRichText } from '@/lib/website-rich-text';
import styles from './store-page.module.css';

export const dynamic = 'force-dynamic';
type StoreFilters = { from?: string; q?: string; category?: string | string[]; price?: string; cashback?: string; sort?: string; collection?: string };

function values(value?: string | string[]) {
  return (Array.isArray(value) ? value : value ? [value] : []).filter(Boolean);
}

function storeFilterPath(slug: string, filters: StoreFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach((item) => item && params.append(key, item));
    else if (value) params.set(key, value);
  });
  const query = params.toString();
  return `/store/${encodeURIComponent(slug)}${query ? `?${query}` : ''}`;
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

function TrackingLink({ href, label, className }: { href: string; label: string; className: string }) {
  if (href.startsWith('/') && !href.startsWith('//') && !href.includes('\\')) return <Link className={className} href={href}>{label}<ArrowRight size={16}/></Link>;
  try { if (new URL(href).protocol !== 'https:') return null; } catch { return null; }
  return <a className={className} href={href} target="_blank" rel="sponsored noopener noreferrer">{label}<ExternalLink size={15}/></a>;
}

function providerTiming(value: number | null | undefined, unit: 'hour' | 'day') {
  if (value == null) return '';
  if (value === 0) return 'Immediately';
  return `Within ${value} ${unit}${value === 1 ? '' : 's'}`;
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
        <article className={styles.processStep}>
          <span>{step.icon}</span><b>{step.title}</b><small>{step.detail}</small>
          {index === 1 && href && <TrackingLink className={styles.shopButton} href={href} label={ctaLabel}/>}
        </article>
        {index < steps.length - 1 && <ArrowRight className={styles.processArrow} aria-hidden="true"/>}
      </Fragment>)}
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
      {index < steps.length - 1 && <ArrowRight className={styles.timelineConnector} aria-hidden="true"/>}
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
  const selectedCategorySlugs = values(filters.category);
  const selectedBrowseCategoryIds = new Set(allStoreCategories.filter((category) => selectedCategorySlugs.includes(category.slug)).map((category) => category.id));
  const selectedCategoryBranches = new Set<string>();
  selectedBrowseCategoryIds.forEach((id) => categoryBranchIds(categories, id).forEach((childId) => selectedCategoryBranches.add(childId)));
  const storeProductOffers = uniqueOffers(allOffers);
  const storeCategoryCounts = new Map<string, number>();
  allStoreCategories.forEach((category) => {
    const branch = categoryBranchIds(categories, category.id);
    storeCategoryCounts.set(category.slug, new Set(allOffers.filter((offer) => branch.has(offer.products?.categories?.id ?? '')).map((offer) => offer.products?.id).filter(Boolean)).size);
  });
  const cashbackProductCount = new Set(allOffers.filter(hasCashback).map((offer) => offer.products?.id).filter(Boolean)).size;
  const query = filters.q?.trim().toLowerCase();
  const matchingStoreOffers = storeProductOffers.filter((offer) => {
    const searchable = `${offer.products?.title ?? ''} ${offer.products?.brand ?? ''} ${offer.products?.categories?.name ?? ''}`.toLowerCase();
    if (query && !searchable.includes(query)) return false;
    if (selectedCategoryBranches.size && !selectedCategoryBranches.has(offer.products?.categories?.id ?? '')) return false;
    if (filters.cashback === 'yes' && !hasCashback(offer)) return false;
    const price = offer.current_price;
    if (filters.price === 'under-1000' && (price == null || price >= 1000)) return false;
    if (filters.price === '1000-5000' && (price == null || price < 1000 || price >= 5000)) return false;
    if (filters.price === '5000-10000' && (price == null || price < 5000 || price >= 10000)) return false;
    if (filters.price === 'over-10000' && (price == null || price < 10000)) return false;
    return true;
  });
  const filteredStoreOffers = sortOffers(matchingStoreOffers, filters.sort ?? 'relevance');
  const collection = ['top25', 'top-cashback'].includes(filters.collection ?? '') ? filters.collection! : 'top50';
  const hasStoreFilters = Boolean(query || selectedCategorySlugs.length || filters.cashback === 'yes' || filters.price);
  const activeStoreFilterCount = selectedCategorySlugs.length + (filters.q?.trim() ? 1 : 0) + (filters.cashback === 'yes' ? 1 : 0) + (filters.price ? 1 : 0);
  const storePriceLabels: Record<string, string> = { 'under-1000': 'Under ₹1,000', '1000-5000': '₹1,000 – ₹5,000', '5000-10000': '₹5,000 – ₹10,000', 'over-10000': 'Above ₹10,000' };
  const activeStoreFilterChips = [
    ...(filters.q?.trim() ? [{ label: `Search: ${filters.q.trim()}`, href: storeFilterPath(slug, { ...filters, q: '' }) }] : []),
    ...selectedCategorySlugs.map((value) => ({ label: categories.find((item) => item.slug === value)?.name ?? value, href: storeFilterPath(slug, { ...filters, category: selectedCategorySlugs.filter((item) => item !== value) }) })),
    ...(filters.price ? [{ label: storePriceLabels[filters.price] ?? 'Price filter', href: storeFilterPath(slug, { ...filters, price: '' }) }] : []),
    ...(filters.cashback === 'yes' ? [{ label: 'Cashback', href: storeFilterPath(slug, { ...filters, cashback: '' }) }] : []),
  ];
  const storeBrowsePath = storeFilterPath(slug, { ...filters, from: returnPath });
  const clearStoreFiltersPath = storeFilterPath(slug, { from: returnPath });
  const layout = await getPublishedWebsiteLayout('stores');
  const sectionOrder = ensureStorePolicyBeforeFaq(resolveWebsiteSectionOrder('stores', layout.blocks, layout.section_order));
  const coreContent = { ...(layout.core_content ?? {}), ...(layout.store_content?.[slug] ?? {}) } as Record<string, WebsiteCoreContent>;
  const heroContent = coreContent.store_intro ?? {};
  const productContent = coreContent.store_products ?? {};
  const cashbackOffers = allOffers.filter(hasCashback);
  const confirmationDays = [...new Set(cashbackOffers.map((offer) => offer.cashback_confirmation_days).filter((days): days is number => days != null && days >= 0))];
  const offerConfirmation = confirmationDays.length === 1
    ? `${providerTiming(confirmationDays[0], 'day')}, as configured for eligible offers.`
    : confirmationDays.length > 1 ? 'Timing varies by eligible offer.' : '';
  const trackingTiming = providerTiming(store.purchase_tracking_hours, 'hour');
  const confirmationTiming = providerTiming(store.cashback_confirmation_days, 'day') || offerConfirmation;
  const walletTiming = providerTiming(store.wallet_credit_days, 'day');
  const timeline = {
    tracking: trackingTiming || heroContent.tracking_note?.trim() || 'Provider timing not configured for this store.',
    confirmation: confirmationTiming || heroContent.confirmation_note?.trim() || 'Provider timing not configured for this store.',
    credit: walletTiming ? `${walletTiming} to your Glonni wallet` : heroContent.credit_note?.trim() || 'Provider timing not configured for this store.',
  };
  // Prefer an explicitly configured, approved campaign destination. Otherwise
  // use Glonni's tracked offer redirect instead of bypassing affiliate tracking.
  const trackedStoreOffer = cashbackOffers[0] ?? allOffers[0];
  const trackedOfferHref = trackedStoreOffer
    ? `/go/${encodeURIComponent(trackedStoreOffer.id)}?source=store-page&medium=store-journey&placement=how-it-works`
    : '';
  const configuredHref = heroContent.cta_href?.trim() || trackedOfferHref;
  const configuredCtaLabel = heroContent.cta_label?.trim() || 'Shop Now';
  const selectedCategoryIds = productContent.category_ids ?? [];
  const storeCategories = (selectedCategoryIds.length ? allStoreCategories.filter((category) => selectedCategoryIds.includes(category.id)) : allStoreCategories).slice(0, 12);
  const selectedProductIds = productContent.product_ids ?? [];
  const rankedStoreOffers = selectedProductIds.length
    ? [...filteredStoreOffers].sort((a, b) => {
      const rank = (offer: CatalogOffer) => {
        const index = selectedProductIds.indexOf(offer.products?.id ?? '');
        return index < 0 ? Number.MAX_SAFE_INTEGER : index;
      };
      return rank(a) - rank(b);
    })
    : filteredStoreOffers;
  const collectionOffers = collection === 'top-cashback' ? sortOffers(rankedStoreOffers, 'cashback') : rankedStoreOffers;
  const displayedStoreOffers = collectionOffers.slice(0, collection === 'top25' ? 25 : 50);
  const policyData = parseCustomerPolicy(store.review_notes);
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
      <div className={styles.processTimelineRow}>
        <HowItWorks storeName={store.name} href={configuredHref || undefined} ctaLabel={configuredCtaLabel}/>
        <CashbackTimeline tracking={timeline.tracking} confirmation={timeline.confirmation} credit={timeline.credit}/>
      </div>
    </>,
    'core:store_products': <section className={styles.storeDiscovery} id="store-products">
      {storeCategories.length > 0 && <section className={styles.categorySection} aria-labelledby="store-category-title">
        <header className={styles.sectionHeading}><div><h2 id="store-category-title">Shop {store.name} by Category</h2><p>Browse categories with active offers from this store.</p></div></header>
        <ScrollRail className={styles.categoryRail} label={`${store.name} categories`}>
          {storeCategories.map((category) => <CategoryCard key={category.id} href={`/category/${encodeURIComponent(category.slug)}?store=${encodeURIComponent(store.slug)}`} name={category.name} imageUrl={category.image_url}/>)}
        </ScrollRail>
      </section>}
      <section className={styles.catalogSection} id="store-catalog" aria-labelledby="store-catalog-title">
        <div className="category-deals">
          <div className="category-deal-results">
            <header className="category-deal-heading"><div><h2 id="store-catalog-title">{renderWebsiteRichText(productContent.title || `Deals on ${store.name}`)}</h2><p>{productContent.body ? renderWebsiteRichText(productContent.body) : `${filteredStoreOffers.length.toLocaleString('en-IN')} products with active offers from this store.`}</p></div><span>{displayedStoreOffers.length} shown</span></header>
            <div className="customer-filter-controls">
              <MobileFilterPanelBehavior/>
              <details className="category-filter-panel" open data-filter-panel>
            <summary><span className="customer-filter-title"><SlidersHorizontal size={19} aria-hidden="true"/>Filters{activeStoreFilterCount > 0 && <b className="customer-filter-count">{activeStoreFilterCount}</b>}</span><ChevronDown size={18} className="category-filter-summary-mark" aria-hidden="true"/></summary>
            <form action={`/store/${encodeURIComponent(store.slug)}`} method="get">
              <input type="hidden" name="from" value={returnPath}/>
              <input type="hidden" name="collection" value={collection}/><input type="hidden" name="sort" value={filters.sort ?? "relevance"}/>
              <label className="category-filter-search"><span>Search products</span><span><Search size={15}/><input type="search" name="q" defaultValue={filters.q} placeholder={`Search ${store.name}`}/></span></label>
              {allStoreCategories.length > 0 && <fieldset><legend>Category</legend><div className="category-filter-options category-filter-subcategories">{allStoreCategories.map((category) => <label key={category.id} style={{ paddingInlineStart: `${Math.min(category.level, 4) * 8}px` }}><input type="checkbox" name="category" value={category.slug} defaultChecked={selectedCategorySlugs.includes(category.slug)}/><span>{category.name}</span><small>{storeCategoryCounts.get(category.slug) ?? 0}</small></label>)}</div></fieldset>}
              <fieldset><legend>Price</legend><div className="category-filter-options">
                {[['', 'Any price'], ['under-1000', 'Under ₹1,000'], ['1000-5000', '₹1,000 – ₹5,000'], ['5000-10000', '₹5,000 – ₹10,000'], ['over-10000', 'Above ₹10,000']].map(([value, label]) => <label key={value || 'any-price'}><input type="radio" name="price" value={value} defaultChecked={(filters.price ?? '') === value}/><span>{label}</span></label>)}
              </div></fieldset>
              <fieldset><legend>Cashback eligible</legend><div className="category-filter-options"><label><input type="checkbox" name="cashback" value="yes" defaultChecked={filters.cashback === 'yes'}/><span>Show only cashback offers</span><small>{cashbackProductCount}</small></label></div></fieldset>
              <button className="category-filter-submit" type="submit">Apply filters</button>
            </form>
          </details>
              <CustomerSortControl action={`/store/${encodeURIComponent(store.slug)}`} value={filters.sort ?? 'relevance'} params={{ ...filters, from: returnPath, collection }} options={[{ value: 'relevance', label: 'Relevance' }, { value: 'price-low', label: 'Price: low to high' }, { value: 'price-high', label: 'Price: high to low' }, { value: 'cashback', label: 'Highest cashback' }, { value: 'discount', label: 'Biggest discount' }]}/>
            </div>
            <CustomerFilterChips chips={activeStoreFilterChips}/>

            <nav className="category-collections" aria-label={`${store.name} deal collections`}>
              {[
                ['top50', 'Top 50'],
                ['top25', 'Top 25'],
                ['top-cashback', 'Top cashback'],
              ].map(([key, label]) => <Link key={key} href={storeFilterPath(slug, { ...filters, from: returnPath, collection: key })} aria-current={collection === key ? 'page' : undefined} className={collection === key ? 'active' : ''}>{label}</Link>)}
            </nav>
            {displayedStoreOffers.length ? <OfferGrid offers={displayedStoreOffers} contextHref={storeBrowsePath}/> : <div className="empty-state category-empty"><Store size={30}/><h2>{hasStoreFilters ? 'No products match these filters' : `No products from ${store.name} yet`}</h2><p>{hasStoreFilters ? 'Clear a filter or try a broader search.' : `Approved products with active offers from ${store.name} will appear here.`}</p>{hasStoreFilters && <Link href={clearStoreFiltersPath} className="primary">Clear all filters</Link>}</div>}
          </div>
        </div>
      </section>
    </section>,
    'core:store_policies': <CustomerPolicyAccordions className={styles.storePolicy} variant="store-page" storeName={store.name} policy={policyData} heading={coreContent.store_policies?.title || 'Terms & Conditions'} intro={coreContent.store_policies?.body || `Cashback rules and conditions specific to ${store.name}.`} openFirst={false}/>,
    'core:store_faqs': <ContextualFaqs variant="store-page" title={coreContent.store_faqs?.title || 'Frequently Asked Questions'} intro={`Common questions about shopping with ${store.name} through Glonni.`} faqs={faqs} maxItems={8}/>,
  };

  return <><Header/><main className={`store-detail-page ${styles.page}`}>
    <BrowseNav items={[{ label: returnPath.startsWith('/category/') ? 'Category' : 'Stores', href: returnPath }, { label: store.name }]} fallback={returnPath}/>
    {sectionOrder.map((token) => <Fragment key={token}>{token.startsWith('core:') ? coreSections[token] : <CmsManagedSections pageKey="stores" blockIds={[token.slice(6)]} storeSlug={store.slug} offers={allOffers}/>}</Fragment>)}
  </main></>;
}
