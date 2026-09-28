'use client'

import { useId } from 'react'
import type { InputHTMLAttributes } from 'react'
import styles from './glonni-ui.module.css'

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size' | 'onChange'> {
  label: string
  description?: string
  onCheckedChange?: (checked: boolean) => void
}

export function Switch({ label, description, id: providedId, onCheckedChange, onBlur, onFocus, ...props }: SwitchProps) {
  const generatedId = useId()
  const id = providedId ?? generatedId
  const descriptionId = `${id}-description`

  return (
    <label className={styles.switchRow} htmlFor={id}>
      <input
        {...props}
        id={id}
        type="checkbox"
        role="switch"
        aria-describedby={description ? descriptionId : undefined}
        className={styles.switchInput}
        onChange={event => onCheckedChange?.(event.currentTarget.checked)}
        onBlur={onBlur}
        onFocus={onFocus}
      />
      <span className={styles.switchTrack} aria-hidden="true" />
      <span className={styles.switchText}>
        <span className={styles.switchLabel}>{label}</span>
        {description && <span id={descriptionId} className={styles.switchDescription}>{description}</span>}
      </span>
    </label>
  )
}
