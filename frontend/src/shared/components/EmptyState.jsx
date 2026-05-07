import React from 'react'

export default function EmptyState({ title = 'Nothing here yet', description = '', icon, action }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      padding: '56px 24px',
      textAlign: 'center',
    }}>
      {/* Icon / illustration */}
      <div style={{
        width: 64,
        height: 64,
        borderRadius: '50%',
        background: 'var(--c-surface-2)',
        border: '1px solid var(--c-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 28,
      }}>
        {icon || <EmptyIcon />}
      </div>

      <div>
        <div style={{ fontWeight: 600, color: 'var(--c-text)', fontSize: 'var(--fs-md)', marginBottom: 6 }}>
          {title}
        </div>
        {description && (
          <div style={{ color: 'var(--c-text-muted)', fontSize: 'var(--fs-sm)', maxWidth: 320, lineHeight: 1.6 }}>
            {description}
          </div>
        )}
      </div>

      {action && (
        <div style={{ marginTop: 4 }}>
          {action}
        </div>
      )}
    </div>
  )
}

function EmptyIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--c-text-faint)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  )
}
