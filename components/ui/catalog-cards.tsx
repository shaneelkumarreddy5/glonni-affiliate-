import Link from 'next/link'
import { ChevronRight, Image, Star } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from './badge'
import type { BadgeVariant } from './badge'
import { CategoryArtwork } from './category-artwork'
import styles from './catalog-cards.module.css'

export interface ProductCardProps {
  href: string
  title: string
  storeName: string
  imageUrl?: string | null
  storeLogoUrl?: string | null
  price: string
  originalPrice?: string | null
  rewardText?: string | null
  rewardTone?: 'cashback' | 'best' | 'neutral'
  meta?: ReactNode
  rating?: number | null
  ratingCount?: number | null
  badgeText?: string | null
  badgeVariant?: BadgeVariant
  actionSlot?: ReactNode
  interactive?: boolean
  className?: string
}

export function ProductCard({
  href,
  title,
  storeName,
  imageUrl,
  storeLogoUrl,
  price,
  originalPrice,
  rewardText,
  rewardTone = 'cashback',
  meta,
  rating,
  ratingCount,
  badgeText,
  badgeVariant = 'sale',
  actionSlot,
  interactive = true,
  className,
}: ProductCardProps) {
  const hasRating = rating != null && rating > 0;
  const ratingText = hasRating
    ? `${rating.toFixed(1)}${ratingCount != null ? ` (${ratingCount.toLocaleString()})` : ''}`
    : 'No ratings yet';
  const content = (
    <>
      <div className={styles.productMedia}>
        {imageUrl ? <img className={styles.productImage} src={imageUrl} alt={title} loading="lazy"/> : <span className={styles.productImageFallback}><Image aria-hidden="true" size={32}/></span>}
        <span className={styles.merchantBadge}>
          {storeLogoUrl && <img className={styles.merchantLogo} src={storeLogoUrl} alt="" loading="lazy"/>}
          <span className={styles.merchantName}>{storeName}</span>
        </span>
      </div>
      <div className={styles.productBody}>
        <h3 className={styles.productTitle}>{title}</h3>
        <div className={styles.productInfoRow}>
          <div className={styles.rating} aria-label={hasRating ? `Rated ${rating.toFixed(1)} out of 5${ratingCount != null ? `, ${ratingCount.toLocaleString()} reviews` : ''}` : 'No customer rating available'}>
            <Star className={styles.ratingStar} size={14} fill={hasRating ? 'currentColor' : 'none'} strokeWidth={1.8} aria-hidden="true"/>
            <span>{ratingText}</span>
          </div>
          {badgeText && <Badge className={styles.discountBadge} variant={badgeVariant}>{badgeText}</Badge>}
        </div>
        <div className={styles.priceRow}>
          <span className={styles.price}>{price}</span>
          {originalPrice && originalPrice !== price && <del className={styles.originalPrice}>{originalPrice}</del>}
        </div>
        {meta && <span className={styles.productMeta}>{meta}</span>}
        {rewardText && <span className={[styles.reward, styles[`reward_${rewardTone}`]].join(' ')}>{rewardText}</span>}
        <span className={styles.productCta}>View Deal</span>
      </div>
    </>
  )

  return (
    <article className={[styles.productCard, className].filter(Boolean).join(' ')}>
      {interactive ? <Link className={styles.productCardLink} href={href}>{content}</Link> : content}

    </article>
  )
}

export interface CategoryCardProps {
  href?: string
  name: string
  imageUrl?: string | null
  interactive?: boolean
  className?: string
}

export function CategoryCard({ href, name, imageUrl, interactive = true, className }: CategoryCardProps) {
  const content = (
    <>
      <span className={styles.categoryImage} aria-hidden="true">
        <CategoryArtwork name={name} imageUrl={imageUrl}/>
      </span>
      <span className={styles.categoryName}>{name}</span>
    </>
  )
  const cardClass = [styles.categoryCard, className].filter(Boolean).join(' ')

  return interactive && href ? <Link className={cardClass} href={href}>{content}</Link> : <div className={cardClass}>{content}</div>
}

export interface StoreCardProps {
  href?: string
  name: string
  logoUrl?: string | null
  meta?: ReactNode
  layout?: 'stacked' | 'horizontal' | 'brand'
  interactive?: boolean
  className?: string
}

export function StoreCard({ href, name, logoUrl, meta, layout = 'stacked', interactive = true, className }: StoreCardProps) {
  const content = (
    <>
      <span className={styles.storeLogo} aria-hidden="true">
        {logoUrl ? <img src={logoUrl} alt="" loading="lazy"/> : <span className={styles.storeInitial}>{name.trim().slice(0, 1).toUpperCase() || '•'}</span>}
      </span>
      {(layout !== 'brand' || !logoUrl) && <span className={styles.storeInfo}><span className={styles.storeName}>{name}</span>{meta && <span className={styles.storeMeta}>{meta}</span>}</span>}
      {(layout === 'horizontal' || layout === 'brand') && <ChevronRight className={styles.storeArrow} size={18} aria-hidden="true"/>}
    </>
  )
  const cardClass = [styles.storeCard, layout === 'horizontal' ? styles.storeCardHorizontal : '', layout === 'brand' ? styles.storeCardBrand : '', className].filter(Boolean).join(' ')

  return interactive && href ? <Link className={cardClass} href={href} aria-label={`Open ${name} store page`}>{content}</Link> : <div className={cardClass}>{content}</div>
}

export interface HeroBannerProps {
  theme?: 'navy' | 'yellow' | 'image'
  eyebrow?: string
  headline: ReactNode
  subline?: ReactNode
  ctaLabel?: string
  ctaHref?: string
  imageUrl?: string | null
  imageAlt?: string
  layout?: 'feature' | 'rail'
  headingLevel?: 'h1' | 'h2' | 'h3'
  interactive?: boolean
  className?: string
}

export function HeroBanner({
  theme = 'navy',
  eyebrow,
  headline,
  subline,
  ctaLabel,
  ctaHref,
  imageUrl,
  imageAlt = '',
  layout = 'feature',
  headingLevel: Heading = 'h2',
  interactive = true,
  className,
}: HeroBannerProps) {
  const themeClass = theme === 'yellow' ? styles.bannerYellow : theme === 'image' ? styles.bannerImage : styles.bannerNavy
  const ctaClass = [styles.bannerCta, theme === 'yellow' ? styles.bannerCtaNavy : ''].filter(Boolean).join(' ')

  return (
    <article className={[styles.banner, themeClass, layout === 'rail' ? styles.railBanner : '', className].filter(Boolean).join(' ')} data-hero-layout={layout}>
      {theme === 'image' && imageUrl && <img className={styles.bannerImageMedia} src={imageUrl} alt={imageAlt} loading="lazy"/>}
      <div className={styles.bannerContent}>
        {eyebrow && <span className={styles.bannerEyebrow}>{eyebrow}</span>}
        <Heading className={styles.bannerHeading}>{headline}</Heading>
        {subline && <p className={styles.bannerSubline}>{subline}</p>}
        {ctaLabel && (interactive && ctaHref
          ? <Link className={ctaClass} href={ctaHref}>{ctaLabel}</Link>
          : <span className={[ctaClass, styles.bannerCtaStatic].join(' ')}>{ctaLabel}</span>)}
      </div>
    </article>
  )
}
