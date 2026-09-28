import styles from './glonni-ui.module.css'

export type AvatarSize = 'sm' | 'md' | 'lg'

export interface AvatarProps {
  name: string
  src?: string
  size?: AvatarSize
  className?: string
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map(part => part[0]).join('').toLocaleUpperCase() || '?'
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const sizeStyle = { sm: styles.avatarSm, md: styles.avatarMd, lg: styles.avatarLg }[size]

  return (
    <span className={[styles.avatar, sizeStyle, className].filter(Boolean).join(' ')} role="img" aria-label={name}>
      {src ? <img src={src} alt="" className={styles.avatarImage} /> : initialsFor(name)}
    </span>
  )
}
