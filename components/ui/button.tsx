import type { ButtonHTMLAttributes } from 'react'
import styles from './glonni-ui.module.css'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'navy'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const variantClass: Record<ButtonVariant, string> = {
  primary: styles.primary,
  secondary: styles.secondary,
  ghost: styles.ghost,
  destructive: styles.destructive,
  navy: styles.navy,
}

const sizeClass: Record<ButtonSize, string> = {
  sm: styles.sizeSm,
  md: styles.sizeMd,
  lg: styles.sizeLg,
}

export function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={[styles.button, variantClass[variant], sizeClass[size], className].filter(Boolean).join(' ')}
    />
  )
}
