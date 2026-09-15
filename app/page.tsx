import { ArrowRight, BadgeCheck, CircleHelp, ShieldCheck, Sparkles } from 'lucide-react';
import { Header } from '@/components/header';
import { StoreSection } from '@/components/store-section';
import { HomeOfferRail } from '@/components/home-offer-rail';
import { ScrollRail } from '@/components/scroll-rail';
import { CatalogOffer, getCatalogOffers, getCategories } from '@/lib/catalog';
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
  const [offers, categories] = await Promise.all([getCatalogOffers(), getCategories()]);
  const homeCategories = categories.filter((category) => category.parent_id === null).sort((a, b) => a.display_order - b.display_order);
  const bestDeals = uniqueProducts([...offers].sort((a, b) => ((a.current_price ?? Infinity) - (a.cashback_amount ?? 0)) - ((b.current_price ?? Infinity) - (b.cashback_amount ?? 0))));
  const priceDrops = uniqueProducts([...offers].sort((a, b) => ((b.list_price ?? b.current_price ?? 0) - (b.current_price ?? 0)) - ((a.list_price ?? a.current_price ?? 0) - (a.current_price ?? 0))));
  const trending = uniqueProducts([...offers].sort((a, b) => ((b.customer_rating ?? 0) * (b.rating_count ?? 0)) - ((a.customer_rating ?? 0) * (a.rating_count ?? 0))));

  return <><Header/><main className="home-main">
    <ScrollRail className="home-banner-rail" label="featured banners">
      <article className="home-banner"><p>FEATURED DEALS</p><h2>Compare before you shop.</h2><span>Find the right deal across configured stores, in one clean place.</span><a href="/deals?sort=best">Explore deals <ArrowRight size={15}/></a><div className="banner-icon">🛒️</div><div className="banner-chip">Compare store offers</div></article>
      <article className="home-banner"><p>SEASONAL PICKS</p><h2>Fresh finds for every cart.</h2><span>Explore fashion, tech, beauty and everyday essentials.</span><a href="#categories">Browse categories <ArrowRight size={15}/></a><div className="banner-icon">✨</div><div className="banner-chip">New curated picks</div></article>
      <article className="home-banner"><p>ELIGIBLE CASHBACK</p><h2>Rewards only where approved.</h2><span>See exact cashback on the offers that actually support it.</span><a href="/deals?cashback=yes">Find eligible offers <ArrowRight size={15}/></a><div className="banner-icon">₹</div><div className="banner-chip">Offer-specific benefit</div></article>
    </ScrollRail>
    <section id="categories" className="home-category-anchor" aria-labelledby="home-categories-title">
      <div className="section-title"><div><p className="eyebrow">BROWSE CATEGORIES</p><h2 id="home-categories-title">What are you shopping for?</h2></div></div>
      {homeCategories.length ? <ScrollRail className="home-category-row" label="categories">{homeCategories.map((category, index) => <a href={`/category/${category.slug}`} className="home-category" key={category.id}><span>{category.image_url ? <img src={category.image_url} alt=""/> : icons[index % icons.length]}</span><b>{category.name}</b></a>)}</ScrollRail> : <div className="home-empty"><b>Categories are being prepared</b><span>They will appear here when available.</span></div>}
    </section>
    <StoreSection/>
    <section id="deals"><div className="section-title"><div><p className="eyebrow">BEST DEALS</p><h2>Best deals right now</h2></div><a href="/deals?sort=best">View all deals</a></div><HomeOfferRail offers={bestDeals.slice(0, 10)} bestDeal/></section>
    <section><div className="section-title"><div><p className="eyebrow">TRENDING NOW</p><h2>Popular picks across stores</h2></div><a href="/deals?sort=trending">View all trending deals</a></div><HomeOfferRail offers={trending.slice(0, 10)}/></section>
    <section><div className="section-title"><div><p className="eyebrow">PRICE DROPS</p><h2>Worth a closer look</h2></div><a href="/deals?sort=price-drop">View all price drops</a></div><HomeOfferRail offers={priceDrops.slice(0, 10)}/></section>
    <section className="benefits">
      <a href="/how-it-works"><ShieldCheck/><p><b>Trusted &amp; Secure</b><small>You purchase directly from the merchant</small></p></a>
      <a href="/deals"><BadgeCheck/><p><b>Compare Stores</b><small>Price, coupon and reward in one view</small></p></a>
      <a href="/cashback-guide"><Sparkles/><p><b>Eligible Cashback</b><small>Only on offers marked eligible</small></p></a>
      <a href="/help"><CircleHelp/><p><b>Help When You Need</b><small>Clear support whenever you need it</small></p></a>
    </section>
  </main></>;
}
