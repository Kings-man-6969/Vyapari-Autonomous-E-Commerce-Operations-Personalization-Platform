import React from 'react'
import { Link, useLocation } from 'react-router-dom'

/*
  BREADCRUMBS — Context-aware path indicator
  Space Grotesk, subtle separator, clickable segments
*/

const PATH_LABELS = {
  seller: 'Seller',
  overview: 'Overview',
  inventory: 'Inventory',
  pricing: 'Pricing',
  reviews: 'Reviews',
  orders: 'Orders',
  finance: 'Finance',
  settings: 'Settings',
  agent: 'AI Assistant',
  hitl: 'HITL Ops',
  history: 'History',
  analytics: 'Analytics',
  decision: 'Decision',
}

export default function Breadcrumbs() {
  const { pathname } = useLocation()

  // Parse segments, skip empty
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length <= 1) return null

  // Build crumb list: [{label, path}]
  const crumbs = segments.map((seg, i) => ({
    label: PATH_LABELS[seg] || seg,
    path: '/' + segments.slice(0, i + 1).join('/'),
    isLast: i === segments.length - 1,
  }))

  return (
    <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {crumbs.map((crumb, i) => (
        <span key={crumb.path} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {i > 0 && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2.5" strokeLinecap="round">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          )}
          {crumb.isLast ? (
            <span style={{
              fontSize: 'var(--fs-xs)',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-display)',
              letterSpacing: '.01em',
            }}>
              {crumb.label}
            </span>
          ) : (
            <Link
              to={crumb.path}
              style={{
                fontSize: 'var(--fs-xs)',
                fontWeight: 500,
                color: 'var(--color-text-faint)',
                fontFamily: 'var(--font-display)',
                textDecoration: 'none',
                transition: 'color var(--t-fast)',
                letterSpacing: '.01em',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-text-muted)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-faint)' }}
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}
