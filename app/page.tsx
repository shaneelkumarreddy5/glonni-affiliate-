import { Fragment, type ReactNode } from 'react';
import { ArrowRight, BadgeCheck, CircleHelp, ShieldCheck, Sparkles } from 'lucide-react';
import { Header } from '@/components/header';
import { StoreSection } from '@/components/store-section';
import { HomeOfferRail } from '@/components/home-offer-rail';
import { ScrollRail } from '@/components/scroll-rail';
import { CmsManagedSections, getPublishedWebsiteLayout } from '@/components/cms-managed-sections';
import { CatalogOffer, getCatalogOffers, getCategories } from '@/lib/catalog';
import { resolveWebsiteSectionOrder } from '@/lib/website-layout';
import { renderWebsiteRichText } from '@/lib/website-rich-text';
import './home.css';

export const dynamic = 'force-dynamic';
const icons = ['📱', '🎧', '👕', '🏠', '💄', '🏸', '🛒', '⚡', '💻', '🧸', '🧳', '🧴'];

function uniqueProducts(offers: CatalogOffer[]) {
  const seen = new Set<string>();
  return offers.filter((offer) => {
    const id = offer.products?.id;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export default async function Home() {
  const [offers, categories, layout] = await Promise.all([getCatalogOffers(), getCategories(), getPublishedWebsiteLayout('home')]);
  const homeCategories = categories.filter((category) => category.parent_id === null).sort((a, b) => a.display_order - b.display_order);
  const bestDeals = uniqueProducts([...offers].sort((a, b) => ((a.current_price ?? Infinity) - (a.cashback_amount ?? 0)) - ((b.current_price ?? Infinity) - (b.cashback_amount ?? 0))));
  const priceDrops = uniqueProducts([...offers].sort((a, b) => ((b.list_price ?? b.current_price ?? 0) - (b.current_price ?? 0)) - ((a.list_price ?? a.current_price ?? 0) - (a.current_price ?? 0))));
  const trending = uniqueProducts([...offers].sort((a, b) => ((b.customer_rating ?? 0) * (b.rating_count ?? 0)) - ((a.customer_rating ?? 0) * (a.rating_count ?? 0))));

  const sectionOrder = resolveWebsiteSectionOrder('home', layout.blocks, layout.section_order);
  const coreContent = layout.core_content ?? {};
  const categoryContent = coreContent.categories ?? {};
  const selectedCategoryIds = categoryContent.category_ids ?? [];
  const selectedCategoryRank = new Map(selectedCategoryIds.map((id, index) => [id, index]));
  const displayedCategories = (selectedCategoryIds.length ? categories.filter((category) => selectedCategoryRank.has(category.id)).sort((a, b) => (selectedCategoryRank.get(a.id) ?? 0) - (selectedCategoryRank.get(b.id) ?? 0)) : homeCategories).slice(0, Math.max(1, Math.min(50, categoryContent.count ?? 10)));
  function selectedProducts(key: string, source: CatalogOffer[]) {
    const selectedIds = coreContent[key]?.product_ids ?? [];
    if (!selectedIds.length) return source.slice(0, coreContent[key]?.count ?? 10);
    const rank = new Map(selectedIds.map((id, index) => [id, index]));
    return source.filter((offer) => rank.has(offer.products?.id ?? '')).sort((a, b) => (rank.get(a.products?.id ?? '') ?? 0) - (rank.get(b.products?.id ?? '') ?? 0)).slice(0, coreContent[key]?.count ?? 10);
  }
  const defaultHero = <ScrollRail className="home-banner-rail" label="featured banners">
      <article className="home-banner"><p>FEATURED DEALS</p><h2>{renderWebsiteRichText(coreContent.hero?.title || 'Compare before you shop.')}</h2><span>{coreContent.hero?.body ? renderWebsiteRichText(coreContent.hero.body) : 'Find the right deal across configured stores, in one clean place.'}</span><a href="/deals?sort=best">Explore deals <ArrowRight size={15}/></a><div className="banner-icon">🛒️</div><div className="banner-chip">Compare store offers</div></article>
      <article className="home-banner"><p>SEASONAL PICKS</p><h2>Fresh finds for every cart.</h2><span>Explore fashion, tech, beauty and everyday essentials.</span><a href="#categories">Browse categories <ArrowRight size={15}/></a><div className="banner-icon">✨</div><div className="banner-chip">New curated picks</div></article>
      <article className="home-banner"><p>ELIGIBLE CASHBACK</p><h2>Rewards only where approved.</h2><span>See exact cashback on the offers that actually support it.</span><a href="/deals?cashback=yes">Find eligible offers <ArrowRight size={15}/></a><div className="banner-icon">₹</div><div className="banner-chip">Offer-specific benefit</div></article>
    </ScrollRail>;
  const homeSections: Record<string, ReactNode> = {
    'core:hero': !layout.section_order && layout.blocks.some((block) => block.config.slot === 'hero') ? null : defaultHero,
    'core:categories': <section id="categories" className="home-category-anchor" aria-labelledby="home-categories-title">
      <div className="section-title"><div><p className="eyebrow">BROWSE CATEGORIES</p><h2 id="home-categories-title">{renderWebsiteRichText(categoryContent.title || 'What are you shopping for?')}</h2>{categoryContent.body && <span className="home-managed-copy">{renderWebsiteRichText(categoryContent.body)}</span>}</div></div>
      {displayedCategories.length ? <ScrollRail className="home-category-row" label="categories">{displayedCategories.map((category, index) => <a href={`/category/${category.slug}`} className={`home-category${categoryContent.visual_shape && categoryContent.visual_shape !== 'standard' ? ` shape-${categoryContent.visual_shape.replaceAll('_','-')}` : ''}`} key={category.id}><span>{category.image_url ? <img src={category.image_url} alt=""/> : icons[index % icons.length]}</span><b>{category.name}</b></a>)}</ScrollRail> : <div className="home-empty"><b>Categories are being prepared</b><span>They will appear here when available.</span></div>}
    </section>,
    'core:stores': <StoreSection content={coreContent.stores}/>,
    'core:best_deals': <section id="deals"><div className="section-title"><div><p className="eyebrow">BEST DEALS</p><h2>{renderWebsiteRichText(coreContent.best_deals?.title || 'Best deals right now')}</h2>{coreContent.best_deals?.body && <span className="home-managed-copy">{renderWebsiteRichText(coreContent.best_deals.body)}</span>}</div><a href="/deals?sort=best">View all deals</a></div><HomeOfferRail offers={selectedProducts('best_deals', bestDeals)} bestDeal/></section>,
    'core:trending': <section><div className="section-title"><div><p className="eyebrow">TRENDING NOW</p><h2>{renderWebsiteRichText(coreContent.trending?.title || 'Popular picks across stores')}</h2>{coreContent.trending?.body && <span className="home-managed-copy">{renderWebsiteRichText(coreContent.trending.body)}</span>}</div><a href="/deals?sort=trending">View all trending deals</a></div><HomeOfferRail offers={selectedProducts('trending', trending)}/></section>,
    'core:price_drops': <section><div className="section-title"><div><p className="eyebrow">PRICE DROPS</p><h2>{renderWebsiteRichText(coreContent.price_drops?.title || 'Worth a closer look')}</h2>{coreContent.price_drops?.body && <span className="home-managed-copy">{renderWebsiteRichText(coreContent.price_drops.body)}</span>}</div><a href="/deals?sort=price-drop">View all price drops</a></div><HomeOfferRail offers={selectedProducts('price_drops', priceDrops)}/></section>,
    'core:benefits': <section className="benefits">{(coreContent.benefits?.title || coreContent.benefits?.body) && <div className="section-title"><div><h2>{renderWebsiteRichText(coreContent.benefits?.title || 'Why shop with Glonni?')}</h2>{coreContent.benefits?.body && <span className="home-managed-copy">{renderWebsiteRichText(coreContent.benefits.body)}</span>}</div></div>}
      <a href="/how-it-works"><ShieldCheck/><p><b>Trusted &amp; Secure</b><small>You purchase directly from the merchant</small></p></a>
      <a href="/deals"><BadgeCheck/><p><b>Compare Stores</b><small>Price, coupon and reward in one view</small></p></a>
      <a href="/cashback-guide"><Sparkles/><p><b>Eligible Cashback</b><small>Only on offers marked eligible</small></p></a>
      <a href="/help"><CircleHelp/><p><b>Help When You Need</b><small>Clear support whenever you need it</small></p></a>
    </section>,
  };

  return <><Header/><main className="home-main">{sectionOrder.map((token) => <Fragment key={token}>{token.startsWith('core:') ? homeSections[token] : <CmsManagedSections pageKey="home" blockIds={[token.slice(6)]} offers={offers}/>}</Fragment>)}</main></>;
}
