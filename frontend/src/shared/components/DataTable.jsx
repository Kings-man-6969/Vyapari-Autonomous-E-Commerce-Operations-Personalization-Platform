import React from 'react';
import EmptyState from './EmptyState';

/* ─── DESIGN.MD — DataTable Component ───
   Container: #0a0a0a elevated card with #1e2c31 hairline border
   Headers: eyebrow-cap (Inter 500w, uppercase, letter-spacing: 0.72px)
   Rows: Inter 420w with #1e2c31 hairline dividers and subtle hover
─────────────────────────────────────────── */

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
          <div key={i} className="skeleton" style={{ height: 48, marginBottom: 8, opacity: 1 - i * 0.15 }} />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div
      style={{
        background: '#0a0a0a',
        border: '1px solid #1e2c31',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
        fontFamily: "'Inter', Helvetica, Arial, sans-serif",
        fontFeatureSettings: '"ss03"',
      }}
      className={className}
    >
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          textAlign: 'left',
          fontSize: 14,
        }}>
          <thead>
            <tr style={{ background: '#121212', borderBottom: '1px solid #1e2c31' }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    padding: '14px 20px',
                    fontSize: 11,
                    fontWeight: 500,
                    color: '#71717a',
                    textTransform: 'uppercase',
                    letterSpacing: '0.72px',
                    textAlign: col.align || 'left',
                    fontFeatureSettings: '"ss03"',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row[rowKey] || idx}
                style={{
                  borderBottom: idx < rows.length - 1 ? '1px solid #1e2c31' : 'none',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#141414'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      padding: '14px 20px',
                      color: '#ffffff',
                      fontSize: 14,
                      fontWeight: 420,
                      textAlign: col.align || 'left',
                      fontFeatureSettings: '"ss03"',
                    }}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
