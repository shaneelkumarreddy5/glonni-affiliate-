import type { ReactNode } from 'react'
import styles from './glonni-ui.module.css'

export type TableAlignment = 'left' | 'center' | 'right'

export interface TableColumn<Row> {
  key: string
  header: ReactNode
  align?: TableAlignment
  width?: string
  render: (row: Row, index: number) => ReactNode
}

export interface DataTableProps<Row> {
  columns: TableColumn<Row>[]
  rows: Row[]
  getRowKey: (row: Row, index: number) => string | number
  caption?: string
  emptyMessage?: ReactNode
  className?: string
}

export function DataTable<Row>({
  columns,
  rows,
  getRowKey,
  caption,
  emptyMessage = 'No records to display.',
  className,
}: DataTableProps<Row>) {
  return (
    <div className={[styles.tableWrap, className].filter(Boolean).join(' ')}>
      <table className={styles.table}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map(column => (
              <th key={column.key} scope="col" data-align={column.align ?? 'center'} style={column.width ? { width: column.width } : undefined}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, index) => (
            <tr key={getRowKey(row, index)}>
              {columns.map(column => (
                <td key={column.key} data-align={column.align ?? 'center'}>
                  {column.render(row, index)}
                </td>
              ))}
            </tr>
          )) : (
            <tr><td className={styles.tableEmpty} colSpan={Math.max(columns.length, 1)}>{emptyMessage}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
