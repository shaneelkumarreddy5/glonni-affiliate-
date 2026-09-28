'use client'

import { useId } from 'react'
import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react'
import { Search } from 'lucide-react'
import styles from './glonni-ui.module.css'

interface FieldProps {
  label?: string
  helperText?: string
  error?: string
}

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>, FieldProps {}

function FieldMessages({ helperText, error, id }: { helperText?: string; error?: string; id: string }) {
  if (error) return <span id={id} className={styles.fieldError}>{error}</span>
  if (helperText) return <span id={id} className={styles.fieldHint}>{helperText}</span>
  return null
}

export function TextInput({ label, helperText, error, id: providedId, className, ...props }: TextInputProps) {
  const generatedId = useId()
  const id = providedId ?? generatedId
  const messageId = `${id}-message`
  const message = error || helperText

  return (
    <div className={styles.field}>
      {label && <label className={styles.fieldLabel} htmlFor={id}>{label}</label>}
      <input
        {...props}
        id={id}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={[props['aria-describedby'], message ? messageId : undefined].filter(Boolean).join(' ') || undefined}
        className={[styles.input, error ? styles.inputInvalid : '', className].filter(Boolean).join(' ')}
      />
      <FieldMessages id={messageId} helperText={helperText} error={error} />
    </div>
  )
}

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size' | 'children'>, FieldProps {
  options: SelectOption[]
  placeholder?: string
}

export function SelectField({
  label,
  helperText,
  error,
  options,
  placeholder,
  id: providedId,
  className,
  ...props
}: SelectFieldProps) {
  const generatedId = useId()
  const id = providedId ?? generatedId
  const messageId = `${id}-message`
  const message = error || helperText

  return (
    <div className={styles.field}>
      {label && <label className={styles.fieldLabel} htmlFor={id}>{label}</label>}
      <select
        {...props}
        id={id}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={[props['aria-describedby'], message ? messageId : undefined].filter(Boolean).join(' ') || undefined}
        className={[styles.select, error ? styles.inputInvalid : '', className].filter(Boolean).join(' ')}
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map(option => (
          <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>
        ))}
      </select>
      <FieldMessages id={messageId} helperText={helperText} error={error} />
    </div>
  )
}

export interface SearchFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  label?: string
}

export function SearchField({ label, id: providedId, className, ...props }: SearchFieldProps) {
  const generatedId = useId()
  const id = providedId ?? generatedId

  return (
    <div className={styles.field}>
      {label && <label className={styles.fieldLabel} htmlFor={id}>{label}</label>}
      <div className={styles.searchWrap}>
        <Search aria-hidden="true" className={styles.searchIcon} />
        <input
          {...props}
          id={id}
          type="search"
          aria-label={props['aria-label'] ?? (!label ? 'Search' : undefined)}
          className={[styles.searchInput, className].filter(Boolean).join(' ')}
        />
      </div>
    </div>
  )
}
