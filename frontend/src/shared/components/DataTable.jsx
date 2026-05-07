import React from 'react'
import EmptyState from './EmptyState'

/**
 * DataTable
 * @param {object[]} columns - Array of { key, label, render?, align? }
 * @param {object[]} rows    - Data rows; each row must have a unique `id` or `key` prop
 * @param {string}   rowKey  - Key used for row's React key (default: 'id')
 * @param {string}   emptyTitle
 * @param {string}   emptyDescription
 * @param {boolean}  loading
 */
export default function DataTable({
  columns = [],
  rows = [],
  rowKey = 'id',
  emptyTitle = 'No data found',
  emptyDescription = '',
  loading = false,
  className = '',
}) {
  if (loading) {
    return (
      <div style={{ padding: '24px 0' }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 44, marginBottom: 8, opacity: 1 - i * 0.15 }} />
        ))}
      </div>
    )
  }

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }

  return (
    <div className={`table-wrapper ${className}`}>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={{ textAlign: col.align || 'left' }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[rowKey]}>
              {columns.map((col) => (
                <td key={col.key} style={{ textAlign: col.align || 'left' }}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
