import React from 'react'

const variantStyles = {
  success: { background: 'rgba(20,184,166,.1)',  color: '#14b8a6', border: '1px solid rgba(20,184,166,.25)' },
  warning: { background: 'rgba(245,158,11,.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,.25)' },
  danger:  { background: 'rgba(239,68,68,.1)',  color: '#f87171', border: '1px solid rgba(239,68,68,.25)' },
  info:    { background: 'rgba(59,130,246,.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,.25)' },
  neutral: { background: 'rgba(100,116,139,.1)',color: '#94a3b8', border: '1px solid rgba(100,116,139,.2)' },
  primary: { background: 'rgba(13,148,136,.1)', color: '#2dd4bf', border: '1px solid rgba(13,148,136,.25)' },
}

export function riskVariant(level) {
  const map = { high: 'danger', medium: 'warning', low: 'success' }
  return map[String(level).toLowerCase()] || 'neutral'
}

export function statusVariant(status) {
  const map = {
    approved: 'success', auto_executed: 'success',
    pending: 'warning',
    rejected: 'danger',
    active: 'success', inactive: 'neutral',
    positive: 'success', negative: 'danger', neutral: 'neutral',
  }
  return map[String(status).toLowerCase()] || 'neutral'
}

export function stockVariant(stock) {
  const s = Number(stock)
  if (s < 5)   return 'danger'
  if (s <= 20) return 'warning'
  return 'success'
}

export default function Badge({ children, variant = 'neutral', className = '' }) {
  const vs = variantStyles[variant] || variantStyles.neutral
  return (
    <span
      className={className}
      style={{
        ...vs,
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '3px 9px', borderRadius: 'var(--r-full)',
        fontSize: 11, fontWeight: 700,
        letterSpacing: '.03em', whiteSpace: 'nowrap', lineHeight: 1.4,
        fontFamily: 'var(--font-mono)',
      }}
    >
      {children}
    </span>
  )
}
