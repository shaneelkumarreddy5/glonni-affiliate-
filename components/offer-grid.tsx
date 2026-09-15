import { Star } from 'lucide-react';
import { CatalogOffer } from '@/lib/catalog';
import { hasCashback, rewardLabel } from '@/lib/rewards';
import { SaveOfferButton } from '@/components/save-offer-button';
import styles from './offer-grid.module.css';

export function OfferGrid({ offers, contextHref, storeCounts, dealMode = false }: { offers: CatalogOffer[]; contextHref?: string; storeCounts?: Record<string, number>; dealMode?: boolean }) {
  const suffix = contextHref ? `?from=${encodeURIComponent(contextHref)}` : '';
  return <div className="offer-grid">{offers.map((offer) => {
    const discount = offer.current_price && offer.list_price ? Math.round((1 - offer.current_price / offer.list_price) * 100) : null;
    const href = `/product/${offer.products?.slug}${suffix}`;
    const storeCount = offer.products?.id ? storeCounts?.[offer.products.id] : undefined;
    const effectivePrice = Math.max(0, (offer.current_price ?? 0) - (offer.cashback_amount ?? 0));
    return <article className={`offer ${styles.offer}`} key={offer.id}>
      <a href={href} className={styles.main}>
        <div className="offer-img">{discount && <em>{discount}% OFF</em>}<img src={offer.products?.image_url || ''} alt={offer.products?.title ?? ''}/></div>
        <h3>{offer.products?.title}</h3>
        <p>{dealMode ? `Best at ${offer.merchants?.name}` : `${offer.merchants?.name} · ${offer.products?.categories?.name}`}</p>
        <b>₹{offer.current_price?.toLocaleString('en-IN')}</b>{offer.list_price && <del>₹{offer.list_price.toLocaleString('en-IN')}</del>}
        {dealMode && hasCashback(offer) && offer.cashback_amount && <small className={styles.effective}>Effective price ₹{effectivePrice.toLocaleString('en-IN')}</small>}
        <strong className={hasCashback(offer) ? 'cashback' : ''}>{rewardLabel(offer)}</strong>
        {dealMode && <div className={styles.meta}>{storeCount && storeCount > 1 ? <span>Compare {storeCount} stores</span> : <span>1 connected store</span>}{offer.customer_rating ? <span><Star size={11} fill="currentColor"/>{offer.customer_rating.toFixed(1)}</span> : null}</div>}
      </a>
      <span className={styles.save}><SaveOfferButton offer={{ offerId: offer.id, productTitle: offer.products?.title ?? 'Deal', productSlug: offer.products?.slug ?? '', imageUrl: offer.products?.image_url ?? null, merchantName: offer.merchants?.name ?? 'Store', price: offer.current_price, benefit: rewardLabel(offer) }}/></span>
    </article>;
  })}</div>;
}
