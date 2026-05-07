import React from 'react'

const sizes = { sm: 14, md: 20, lg: 30, xl: 44 }
const borders = { sm: 2, md: 2.5, lg: 3, xl: 3.5 }

export default function Spinner({ size = 'md', color }) {
  const dim = sizes[size] || 20
  const bw  = borders[size] || 2.5
  const c   = color || 'var(--color-primary)'
  return (
    <div
      aria-label="Loading"
      style={{
        width: dim, height: dim,
        borderRadius: '50%',
        border: `${bw}px solid transparent`,
        borderTopColor: c,
        borderRightColor: `${c}40`,
        animation: 'spin .75s linear infinite',
        flexShrink: 0,
      }}
    />
  )
}

export function SpinnerPage({ message = 'Loading…' }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', gap: 16, background: 'var(--color-bg-primary)',
    }}>
      <Spinner size="lg" color="var(--color-primary)" />
      <span style={{ color: 'var(--color-text-muted)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>{message}</span>
    </div>
  )
}
