import Link from 'next/link';
import { CatalogOffer } from '@/lib/catalog';
import { hasCashback, rewardLabel } from '@/lib/rewards';
import { ScrollRail } from '@/components/scroll-rail';
import type { WebsiteVisualShape } from '@/lib/website-layout';

export function HomeOfferRail({ offers, bestDeal = false, shape = 'standard' }: { offers: CatalogOffer[]; bestDeal?: boolean; shape?: WebsiteVisualShape }) {
  return <ScrollRail className="home-offer-rail" label="deals">{offers.map((offer, index) => { const discount = offer.current_price && offer.list_price ? Math.round((1 - offer.current_price / offer.list_price) * 100) : null; const cashback = hasCashback(offer); return <Link className={`home-offer-card${shape !== 'standard' ? ` shape-${shape.replaceAll('_', '-')}` : ''}`} href={`/product/${offer.products?.slug}?from=/`} key={offer.id}><div className="home-offer-merchant">{offer.merchants?.name || 'Store'}</div><div className="home-offer-image">{discount && <em>{discount}% OFF</em>}<img src={offer.products?.image_url || ''} alt={offer.products?.title || ''}/></div><div className="home-offer-body"><h3>{offer.products?.title}</h3><p>{offer.products?.brand || offer.products?.categories?.name || 'Glonni deal'}</p><b>₹{offer.current_price?.toLocaleString('en-IN')}</b>{offer.list_price && <del>₹{offer.list_price.toLocaleString('en-IN')}</del>}</div><strong className={cashback ? 'home-offer-strip cashback-strip' : bestDeal || index === 0 ? 'home-offer-strip best-strip' : 'home-offer-strip'}>{cashback ? rewardLabel(offer) : bestDeal || index === 0 ? 'Best deal' : 'Compare this offer'}</strong></Link> })}</ScrollRail>;
}
