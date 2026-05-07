import React from 'react'
import { Link, useLocation } from 'react-router-dom'

/*
  SELLER DASHBOARD SIDEBAR + MOBILE BOTTOM TAB BAR
  - Desktop: fixed left sidebar (unchanged)
  - Mobile: bottom tab navigation (Meesho/Flipkart style)
  Font: Space Grotesk (geometric, technical confidence)
  Colors: Slate blue / teal on deep charcoal
*/

const navGroups = [
  {
    label: 'Seller',
    items: [
      { to: '/seller/overview',  label: 'Overview',    icon: <GridIcon />,    mobileIcon: <GridIcon /> },
      { to: '/seller/inventory', label: 'Inventory',   icon: <BoxIcon />,     mobileIcon: <BoxIcon /> },
      { to: '/seller/pricing',   label: 'Pricing',     icon: <TagIcon />,     mobileIcon: <TagIcon /> },
      { to: '/seller/orders',    label: 'Orders',      icon: <OrderIcon />,   mobileIcon: <OrderIcon /> },
      { to: '/seller/finance',   label: 'Finance',     icon: <ChartIcon />,   mobileIcon: <ChartIcon /> },
      { to: '/seller/reviews',   label: 'Reviews',     icon: <StarIcon />,    mobileIcon: <StarIcon /> },
      { to: '/seller/settings',  label: 'Settings',    icon: <SettingsIcon />,mobileIcon: <SettingsIcon /> },
      { to: '/seller/agent',     label: 'AI Assistant',icon: <AgentIcon />,   mobileIcon: <AgentIcon /> },
    ],
  },
  {
    label: 'HITL Operations',
    items: [
      { to: '/hitl',           label: 'Decisions', icon: <QueueIcon />,  mobileIcon: <QueueIcon /> },
      { to: '/hitl/history',   label: 'History',   icon: <ClockIcon />,  mobileIcon: <ClockIcon /> },
      { to: '/hitl/analytics', label: 'Analytics', icon: <ChartIcon />,  mobileIcon: <ChartIcon /> },
    ],
  },
]

// Items shown in mobile bottom tab (most used 5)
const mobileTabItems = [
  { to: '/seller/overview',  label: 'Home',      icon: <GridIcon /> },
  { to: '/seller/inventory', label: 'Inventory', icon: <BoxIcon /> },
  { to: '/seller/orders',    label: 'Orders',    icon: <OrderIcon /> },
  { to: '/hitl',             label: 'HITL',      icon: <QueueIcon /> },
  { to: '/seller/agent',     label: 'AI',        icon: <AgentIcon /> },
]

export default function Sidebar({ open, onClose }) {
  const location = useLocation()

  function isActive(to) {
    if (to === '/hitl') return location.pathname === '/hitl'
    return location.pathname.startsWith(to)
  }

  return (
    <>
      {/* Overlay for mobile drawer */}
      <div
        className={`sidebar-overlay${open ? ' visible' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ── DESKTOP SIDEBAR ───────────────────────────────── */}
      <aside
        className={`app-sidebar${open ? ' open' : ''}`}
        aria-label="Main navigation"
        role="navigation"
      >
        {/* Brand */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '20px 18px 16px',
          borderBottom: '1px solid var(--color-border)',
          marginBottom: 4,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', flexShrink: 0,
            boxShadow: '0 0 16px rgba(13,148,136,.4)',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 'var(--fs-md)', color: 'var(--color-text-primary)', letterSpacing: '-0.02em', fontFamily: 'var(--font-display)' }}>Vyapari</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-faint)', fontWeight: 500, fontFamily: 'var(--font-mono)', letterSpacing: '.04em' }}>Operations Console</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }} aria-label="Sidebar navigation">
          {navGroups.map((group) => (
            <div key={group.label} style={{ marginBottom: 28 }}>
              <div style={{
                fontSize: 'var(--fs-xs)', fontWeight: 700,
                color: 'var(--color-text-faint)',
                letterSpacing: '.1em', textTransform: 'uppercase',
                padding: '4px 8px 10px',
                fontFamily: 'var(--font-mono)',
              }}>
                {group.label}
              </div>
              {group.items.map((item) => {
                const active = isActive(item.to)
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    aria-current={active ? 'page' : undefined}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 10px',
                      fontSize: 'var(--fs-sm)', fontWeight: active ? 600 : 500,
                      textDecoration: 'none',
                      transition: 'all 150ms ease',
                      marginBottom: 2,
                      borderRadius: 'var(--r-md)',
                      background: active ? 'rgba(13,148,136,.12)' : 'transparent',
                      color: active ? '#2dd4bf' : 'var(--color-text-muted)',
                      borderLeft: active ? '2px solid #0d9488' : '2px solid transparent',
                      fontFamily: 'var(--font-display)',
                      outline: 'none',
                    }}
                    onFocus={e => { e.currentTarget.style.boxShadow = '0 0 0 2px rgba(13,148,136,.4)' }}
                    onBlur={e => { e.currentTarget.style.boxShadow = 'none' }}
                    onMouseEnter={e => {
                      if (!active) {
                        e.currentTarget.style.background = 'var(--color-bg-raised)'
                        e.currentTarget.style.color = 'var(--color-text-primary)'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.color = 'var(--color-text-muted)'
                      }
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', color: active ? '#0d9488' : 'var(--color-text-faint)', transition: 'color 150ms' }}>
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '12px 18px 16px', borderTop: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-faint)', fontFamily: 'var(--font-mono)' }}>
            Autonomous E-Commerce
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-faint)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
            v1.0.0
          </div>
        </div>
      </aside>

      {/* ── MOBILE BOTTOM TAB BAR ─────────────────────────── */}
      <nav
        className="mobile-tab-bar"
        aria-label="Mobile navigation"
        role="navigation"
      >
        {mobileTabItems.map((item) => {
          const active = isActive(item.to)
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                flex: 1,
                padding: '8px 4px',
                textDecoration: 'none',
                color: active ? '#2dd4bf' : '#64748b',
                fontSize: 9,
                fontWeight: active ? 700 : 500,
                fontFamily: 'var(--font-display)',
                letterSpacing: '.03em',
                transition: 'color 150ms',
                background: 'transparent',
                border: 'none',
                position: 'relative',
              }}
            >
              {/* Active indicator */}
              {active && (
                <span style={{
                  position: 'absolute',
                  top: 0, left: '25%', right: '25%',
                  height: 2,
                  background: '#0d9488',
                  borderRadius: '0 0 var(--r-sm) var(--r-sm)',
                }}/>
              )}
              <span style={{
                display: 'flex',
                padding: active ? '6px' : '4px',
                borderRadius: 'var(--r-sm)',
                background: active ? 'rgba(13,148,136,.15)' : 'transparent',
                transition: 'all 150ms',
              }}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}

// ── Icons ───────────────────────────────────────────────────────
function GridIcon()    { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> }
function BoxIcon()     { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></svg> }
function TagIcon()     { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.41 0l7.72-7.72a1 1 0 0 0 0-1.41z"/><path d="M7 7h.01"/></svg> }
function StarIcon()    { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> }
function OrderIcon()   { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> }
function QueueIcon()   { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg> }
function ClockIcon()   { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> }
function ChartIcon()   { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg> }
function SettingsIcon(){ return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> }
function AgentIcon()   { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg> }
