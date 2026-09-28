'use client'

import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import type { ReactNode, SyntheticEvent } from 'react'
import styles from './glonni-ui.module.css'

export interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  closeLabel?: string
}

export function Dialog({ open, onOpenChange, title, description, children, footer, closeLabel = 'Close dialog' }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const generatedId = useId()
  const titleId = `glonni-dialog-title-${generatedId.replace(/:/g, '')}`
  const descriptionId = `glonni-dialog-description-${generatedId.replace(/:/g, '')}`

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault()
    onOpenChange(false)
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={handleCancel}
      onClick={event => {
        if (event.target === event.currentTarget) onOpenChange(false)
      }}
    >
      <div className={styles.dialogInner}>
        <header className={styles.dialogHeader}>
          <div>
            <h2 id={titleId} className={styles.dialogTitle}>{title}</h2>
            {description && <p id={descriptionId} className={styles.dialogDescription}>{description}</p>}
          </div>
          <button type="button" className={styles.iconButton} onClick={() => onOpenChange(false)} aria-label={closeLabel}>
            <X aria-hidden="true" size={18} />
          </button>
        </header>
        <div className={styles.dialogBody}>{children}</div>
        {footer && <footer className={styles.dialogFooter}>{footer}</footer>}
      </div>
    </dialog>
  )
}
