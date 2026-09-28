import type { HTMLAttributes } from 'react'
import styles from './glonni-ui.module.css'

export type BadgeVariant = 'sale' | 'flash' | 'deal' | 'free' | 'new' | 'cashback' | 'instock' | 'custom'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

export function Badge({ variant = 'custom', className, ...props }: BadgeProps) {
  const variantStyle: Record<BadgeVariant, string> = {
    sale: styles.badgeSale,
    flash: styles.badgeFlash,
    deal: styles.badgeDeal,
    free: styles.badgeFree,
    new: styles.badgeNew,
    cashback: styles.badgeCashback,
    instock: styles.badgeInStock,
    custom: styles.badgeCustom,
  }

  return <span {...props} className={[styles.badge, variantStyle[variant], className].filter(Boolean).join(' ')} />
}
