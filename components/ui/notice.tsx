'use client'

import { CircleCheck, CircleX, Info, TriangleAlert, X } from 'lucide-react'
import type { ReactNode } from 'react'
import styles from './glonni-ui.module.css'

export type NoticeVariant = 'info' | 'success' | 'warning' | 'error'

export interface NoticeProps {
  variant?: NoticeVariant
  title?: string
  children: ReactNode
  onDismiss?: () => void
  className?: string
}

const variants: Record<NoticeVariant, { className: string; icon: typeof Info }> = {
  info: { className: styles.noticeInfo, icon: Info },
  success: { className: styles.noticeSuccess, icon: CircleCheck },
  warning: { className: styles.noticeWarning, icon: TriangleAlert },
  error: { className: styles.noticeError, icon: CircleX },
}

export function Notice({ variant = 'info', title, children, onDismiss, className }: NoticeProps) {
  const config = variants[variant]
  const Icon = config.icon
  const role = variant === 'error' || variant === 'warning' ? 'alert' : 'status'

  return (
    <div role={role} className={[styles.notice, config.className, className].filter(Boolean).join(' ')}>
      <span className={styles.noticeIcon}><Icon aria-hidden="true" size={19} /></span>
      <div className={styles.noticeContent}>
        {title && <p className={styles.noticeTitle}>{title}</p>}
        <div className={styles.noticeMessage}>{children}</div>
      </div>
      {onDismiss && (
        <button type="button" className={styles.iconButton} onClick={onDismiss} aria-label="Dismiss notification">
          <X aria-hidden="true" size={17} />
        </button>
      )}
    </div>
  )
}
