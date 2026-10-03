import { ProductCard } from '@/components/ui/catalog-cards';
import { ScrollRail } from '@/components/scroll-rail';
import type { CatalogOffer } from '@/lib/catalog';
import { hasCashback, rewardLabel } from '@/lib/rewards';
import styles from '@/components/ui/catalog-cards.module.css';

function formatPrice(value: number | null | undefined) {
  return value == null ? 'Price unavailable' : `₹${value.toLocaleString('en-IN')}`;
}

export function HomeOfferRail({ offers, bestDeal = false, returnTo = '/' }: { offers: CatalogOffer[]; bestDeal?: boolean; returnTo?: string }) {
  return <ScrollRail className="home-offer-rail" label="deals">
    {offers.map((offer, index) => {
      const product = offer.products;
      const merchant = offer.merchants;
      const discount = offer.current_price != null && offer.list_price != null && offer.list_price > offer.current_price
        ? Math.round((1 - offer.current_price / offer.list_price) * 100)
        : null;
      const benefit = hasCashback(offer) || offer.reward_type === 'points'
        ? rewardLabel(offer)
        : bestDeal || index === 0 ? 'Best deal' : 'Compare this offer';
      return <ProductCard
        key={offer.id}
        className={styles.railProductCard}
        href={`/product/${product?.slug ?? ''}?from=${encodeURIComponent(returnTo)}`}
        title={product?.title ?? 'Product details unavailable'}
        storeName={merchant?.name ?? 'Store'}
        storeLogoUrl={merchant?.logo_url}
        imageUrl={product?.image_url}
        subtitle={product?.brand || product?.categories?.name || 'Glonni deal'}
        price={formatPrice(offer.current_price)}
        originalPrice={offer.list_price == null ? null : formatPrice(offer.list_price)}
        rating={offer.customer_rating}
        ratingCount={offer.rating_count}
        badgeText={discount ? `${discount}% OFF` : null}
        badgeVariant="sale"
        rewardText={benefit}
        rewardTone={hasCashback(offer) ? 'cashback' : bestDeal || index === 0 ? 'best' : 'neutral'}
      />;
    })}
  </ScrollRail>;
}
