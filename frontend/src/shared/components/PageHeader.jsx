import React from 'react'

export default function PageHeader({ title, description, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
      <div>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--fs-2xl)',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          letterSpacing: '-0.025em',
          lineHeight: 1.2,
          marginBottom: description ? 6 : 0,
        }}>
          {title}
        </h1>
        {description && (
          <p style={{
            color: 'var(--color-text-muted)',
            fontSize: 'var(--fs-sm)',
            fontFamily: 'var(--font-display)',
            lineHeight: 1.6,
            maxWidth: 560,
          }}>
            {description}
          </p>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  )
}
