import Link from 'next/link'
import { ChevronRight, Image, Star } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from './badge'
import type { BadgeVariant } from './badge'
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
  subtitle?: string | null
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
  subtitle,
  meta,
  rating,
  ratingCount,
  badgeText,
  badgeVariant = 'sale',
  actionSlot,
  interactive = true,
  className,
}: ProductCardProps) {
  const content = (
    <>
      <div className={styles.productMedia}>
        {imageUrl ? <img className={styles.productImage} src={imageUrl} alt={title} loading="lazy"/> : <span className={styles.productImageFallback}><Image aria-hidden="true" size={32}/></span>}
        <span className={styles.merchantBadge}>
          {storeLogoUrl && <img className={styles.merchantLogo} src={storeLogoUrl} alt="" loading="lazy"/>}
          <span className={styles.merchantName}>{storeName}</span>
        </span>
        {badgeText && <span className={[styles.productBadge, actionSlot ? styles.productBadgeWithAction : ''].filter(Boolean).join(' ')}><Badge variant={badgeVariant}>{badgeText}</Badge></span>}
      </div>
      <div className={styles.productBody}>
        <h3 className={styles.productTitle}>{title}</h3>
        {subtitle && <p className={styles.productSubtitle}>{subtitle}</p>}
        {rating != null && rating > 0 && <div className={styles.rating} aria-label={`Rated ${rating.toFixed(1)} out of 5${ratingCount ? `, ${ratingCount.toLocaleString()} reviews` : ''}`}>
          <span className={styles.ratingStars} aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <Star key={index} size={11} fill={index < Math.round(rating) ? 'currentColor' : 'none'} strokeWidth={1.7}/>)}</span>
          <span>{rating.toFixed(1)}{ratingCount ? ` (${ratingCount.toLocaleString()})` : ''}</span>
        </div>}
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
      {actionSlot && <span className={styles.saveSlot}>{actionSlot}</span>}
    </article>
  )
}

export interface CategoryCardProps {
  href?: string
  name: string
  imageUrl?: string | null
  subtitle?: string | null
  storeCount?: number | null
  interactive?: boolean
  className?: string
}

export function CategoryCard({ href, name, imageUrl, subtitle, storeCount, interactive = true, className }: CategoryCardProps) {
  const content = (
    <>
      <span className={styles.categoryImage} aria-hidden="true">
        {imageUrl ? <img src={imageUrl} alt="" loading="lazy"/> : name.trim().slice(0, 1).toUpperCase() || '•'}
      </span>
      <span className={styles.categoryName}>{name}</span>
      {subtitle && <span className={styles.categoryMeta}>{subtitle}</span>}
      {storeCount != null && <span className={styles.categoryMeta}>{storeCount.toLocaleString()} stores</span>}
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
  layout?: 'stacked' | 'horizontal'
  interactive?: boolean
  className?: string
}

export function StoreCard({ href, name, logoUrl, meta, layout = 'stacked', interactive = true, className }: StoreCardProps) {
  const content = (
    <>
      <span className={styles.storeLogo} aria-hidden="true">
        {logoUrl ? <img src={logoUrl} alt="" loading="lazy"/> : <span className={styles.storeInitial}>{name.trim().slice(0, 1).toUpperCase() || '•'}</span>}
      </span>
      <span className={styles.storeInfo}><span className={styles.storeName}>{name}</span>{meta && <span className={styles.storeMeta}>{meta}</span>}</span>
      {layout === 'horizontal' && <ChevronRight className={styles.storeArrow} size={18} aria-hidden="true"/>}
    </>
  )
  const cardClass = [styles.storeCard, layout === 'horizontal' ? styles.storeCardHorizontal : '', className].filter(Boolean).join(' ')

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
