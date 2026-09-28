import { Inbox } from 'lucide-react'
import { useId } from 'react'
import type { ReactNode } from 'react'
import styles from './glonni-ui.module.css'

export interface EmptyStateProps {
  title: string
  message?: string
  icon?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({ title, message, icon = <Inbox aria-hidden="true" size={34} />, action, className }: EmptyStateProps) {
  const titleId = `glonni-empty-state-${useId().replace(/:/g, '')}`

  return (
    <section className={[styles.emptyState, className].filter(Boolean).join(' ')} aria-labelledby={titleId}>
      <span className={styles.emptyIcon}>{icon}</span>
      <h2 id={titleId} className={styles.emptyTitle}>{title}</h2>
      {message && <p className={styles.emptyMessage}>{message}</p>}
      {action}
    </section>
  )
}

export function LoadingState({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return (
    <div className={[styles.loadingState, className].filter(Boolean).join(' ')} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      <p className={styles.loadingLabel}>{label}</p>
    </div>
  )
}
