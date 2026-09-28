'use client'

import { useId, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import styles from './glonni-ui.module.css'

export interface TabItem {
  id: string
  label: ReactNode
  content: ReactNode
  disabled?: boolean
}

export interface TabsProps {
  items: TabItem[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  ariaLabel: string
  className?: string
}

export function Tabs({ items, value, defaultValue, onValueChange, ariaLabel, className }: TabsProps) {
  const generatedId = useId()
  const rootId = `glonni-tabs-${generatedId.replace(/:/g, '')}`
  const firstEnabled = items.find(item => !item.disabled)?.id ?? ''
  const [internalValue, setInternalValue] = useState(defaultValue ?? firstEnabled)
  const currentValue = value ?? internalValue
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  const setValue = (nextValue: string) => {
    if (value === undefined) setInternalValue(nextValue)
    onValueChange?.(nextValue)
  }

  const focusRelativeTab = (event: KeyboardEvent<HTMLButtonElement>, startIndex: number) => {
    const enabled = items.map((item, index) => ({ item, index })).filter(({ item }) => !item.disabled)
    if (!enabled.length) return

    let targetIndex = startIndex
    if (event.key === 'Home') targetIndex = enabled[0].index
    else if (event.key === 'End') targetIndex = enabled[enabled.length - 1].index
    else {
      const direction = event.key === 'ArrowRight' ? 1 : -1
      const position = enabled.findIndex(({ index }) => index === startIndex)
      targetIndex = enabled[(position + direction + enabled.length) % enabled.length].index
    }

    event.preventDefault()
    setValue(items[targetIndex].id)
    tabRefs.current[targetIndex]?.focus()
  }

  const activeItem = items.find(item => item.id === currentValue && !item.disabled) ?? items.find(item => !item.disabled)
  if (!activeItem) return null

  return (
    <div className={className}>
      <div className={styles.tabList} role="tablist" aria-label={ariaLabel}>
        {items.map((item, index) => {
          const selected = item.id === activeItem.id
          const tabId = `${rootId}-tab-${item.id}`
          const panelId = `${rootId}-panel-${item.id}`

          return (
            <button
              key={item.id}
              ref={element => { tabRefs.current[index] = element }}
              id={tabId}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              disabled={item.disabled}
              className={styles.tab}
              onClick={() => setValue(item.id)}
              onKeyDown={event => {
                if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                  focusRelativeTab(event, index)
                }
              }}
            >
              {item.label}
            </button>
          )
        })}
      </div>
      <div
        id={`${rootId}-panel-${activeItem.id}`}
        role="tabpanel"
        aria-labelledby={`${rootId}-tab-${activeItem.id}`}
        tabIndex={0}
        className={styles.tabPanel}
      >
        {activeItem.content}
      </div>
    </div>
  )
}
