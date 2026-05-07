import React, { useEffect, useRef, useState } from 'react'

/*
  StatCard — Seller/HITL KPI metric card
  - Count-up animation on mount (Stripe-style)
  - Trend arrow (up/down/neutral)
  - Hover lift + glow
  Space Grotesk label, JetBrains Mono value
*/

function useCountUp(target, duration = 900) {
  const [current, setCurrent] = useState(0)
  const frameRef = useRef(null)

  useEffect(() => {
    // Only animate plain integers/decimals — not ₹1,234 or "89%" or "4.2/5"
    const numTarget = typeof target === 'number' ? target : parseFloat(String(target))
    if (isNaN(numTarget) || !isFinite(numTarget)) { setCurrent(target); return }

    const start = performance.now()
    const from = 0

    function step(now) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const value = Math.round(from + (numTarget - from) * eased)
      setCurrent(value)
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step)
      } else {
        setCurrent(numTarget) // land exactly on target
      }
    }
    frameRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameRef.current)
  }, [target, duration])

  return current
}

export default function StatCard({ label, value, sub, trend, variant = 'default', icon, onClick }) {
  const accents = {
    default: '#0d9488',
    primary: '#0d9488',
    danger:  '#ef4444',
    warning: '#f59e0b',
    success: '#14b8a6',
    info:    '#3b82f6',
  }
  const accentBgs = {
    default: 'rgba(13,148,136,.08)',
    primary: 'rgba(13,148,136,.08)',
    danger:  'rgba(239,68,68,.08)',
    warning: 'rgba(245,158,11,.08)',
    success: 'rgba(20,184,166,.08)',
    info:    'rgba(59,130,246,.08)',
  }

  const accent = accents[variant]  || accents.default
  const bg     = accentBgs[variant] || accentBgs.default

  // Pass value directly to hook — it handles non-numeric passthrough
  const animatedVal = useCountUp(value ?? 0)
  // Display: use animated count for pure numbers, raw value for formatted strings
  const isNumeric = typeof value === 'number'
  const finalDisplay = isNumeric ? animatedVal : (value ?? '—')

  const trendColor = trend > 0 ? '#14b8a6' : trend < 0 ? '#ef4444' : '#64748b'
  const trendIcon  = trend > 0 ? '↑' : trend < 0 ? '↓' : '→'

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? e => { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}
      style={{
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--r-xl)',
        padding: '20px 22px',
        boxShadow: 'var(--sh-md)',
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
        cursor: onClick ? 'pointer' : 'default',
        animation: 'fadeIn .3s ease both',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = `var(--sh-lg), 0 0 0 1px ${accent}33`
        e.currentTarget.style.borderColor = `${accent}44`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'none'
        e.currentTarget.style.boxShadow = 'var(--sh-md)'
        e.currentTarget.style.borderColor = 'var(--color-border)'
      }}
      onFocus={e => { e.currentTarget.style.boxShadow = `0 0 0 2px ${accent}55` }}
      onBlur={e => { e.currentTarget.style.boxShadow = 'var(--sh-md)' }}
    >
      {/* Top accent bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: accent }} />

      {/* Subtle glow orb in corner */}
      <div style={{
        position: 'absolute', bottom: -20, right: -20,
        width: 80, height: 80,
        background: bg,
        borderRadius: '50%',
        filter: 'blur(16px)',
        pointerEvents: 'none',
      }}/>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, position: 'relative' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 10, fontFamily: 'var(--font-mono)' }}>
            {label}
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-0.03em', lineHeight: 1, fontFamily: 'var(--font-mono)' }}>
            {finalDisplay}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}>
            {sub && (
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-display)' }}>
                {sub}
              </div>
            )}
            {trend !== undefined && trend !== null && (
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: trendColor,
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {trendIcon} {Math.abs(trend)}%
              </span>
            )}
          </div>
        </div>
        {icon && (
          <div style={{
            width: 40, height: 40, borderRadius: 'var(--r-md)',
            background: bg, border: `1px solid ${accent}33`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, color: accent,
          }}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}
