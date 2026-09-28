import { ProductCard } from '@/components/ui/catalog-cards';
import { SaveOfferButton } from '@/components/save-offer-button';
import type { CatalogOffer } from '@/lib/catalog';
import { hasCashback, rewardLabel } from '@/lib/rewards';
import styles from '@/components/ui/catalog-cards.module.css';

function formatPrice(value: number | null | undefined) {
  return value == null ? 'Price unavailable' : `₹${value.toLocaleString('en-IN')}`;
}

export function OfferGrid({ offers, contextHref, storeCounts, dealMode = false }: { offers: CatalogOffer[]; contextHref?: string; storeCounts?: Record<string, number>; dealMode?: boolean }) {
  const suffix = contextHref ? `?from=${encodeURIComponent(contextHref)}` : '';
  return <div className="offer-grid">{offers.map((offer) => {
    const product = offer.products;
    const merchant = offer.merchants;
    const discount = offer.current_price != null && offer.list_price != null && offer.list_price > offer.current_price
      ? Math.round((1 - offer.current_price / offer.list_price) * 100)
      : null;
    const storeCount = product?.id ? storeCounts?.[product.id] : undefined;
    const effectivePrice = Math.max(0, (offer.current_price ?? 0) - (offer.cashback_amount ?? 0));
    const compareLabel = storeCount && storeCount > 1 ? `Compare ${storeCount} stores` : '1 connected store';
    const meta = dealMode
      ? <>{hasCashback(offer) && offer.cashback_amount ? `Effective price ${formatPrice(effectivePrice)} · ` : ''}{compareLabel}</>
      : null;

    return <ProductCard
      key={offer.id}
      className={styles.gridProductCard}
      href={`/product/${product?.slug ?? ''}${suffix}`}
      title={product?.title ?? 'Product details unavailable'}
      storeName={merchant?.name ?? 'Store'}
      storeLogoUrl={merchant?.logo_url}
      imageUrl={product?.image_url}
      subtitle={dealMode ? `Best at ${merchant?.name ?? 'this store'}` : `${merchant?.name ?? 'Store'} · ${product?.categories?.name ?? 'Catalogue'}`}
      price={formatPrice(offer.current_price)}
      originalPrice={offer.list_price == null ? null : formatPrice(offer.list_price)}
      rewardText={rewardLabel(offer)}
      rewardTone={hasCashback(offer) ? 'cashback' : 'neutral'}
      meta={meta}
      rating={offer.customer_rating}
      ratingCount={offer.rating_count}
      badgeText={discount ? `${discount}% OFF` : null}
      badgeVariant="sale"
      actionSlot={<SaveOfferButton compact offer={{ offerId: offer.id, productTitle: product?.title ?? 'Deal', productSlug: product?.slug ?? '', imageUrl: product?.image_url ?? null, merchantName: merchant?.name ?? 'Store', price: offer.current_price, benefit: rewardLabel(offer) }}/>}
    />;
  })}</div>;
}
