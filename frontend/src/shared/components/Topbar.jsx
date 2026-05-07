import React, { useEffect, useState } from 'react'
import Breadcrumbs from './Breadcrumbs'
import NotificationBell from './NotificationBell'
import CommandPalette from './CommandPalette'

/*
  SELLER/HITL TOPBAR — upgraded
  - ⌘K command palette trigger
  - Notification bell with live badge
  - Breadcrumb navigation
  - Visible mobile hamburger
  - Role badge + sign-out
  Space Grotesk / JetBrains Mono
*/

export default function Topbar({ role, onLogout, onMenuToggle, pageTitle, token }) {
  const [cmdOpen, setCmdOpen] = useState(false)

  // ⌘K / Ctrl+K global shortcut
  useEffect(() => {
    function handler(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdOpen(v => !v)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  return (
    <>
      <div className="app-topbar">
        {/* Mobile hamburger — always visible on mobile */}
        <button
          onClick={onMenuToggle}
          id="topbar-menu-toggle"
          className="btn-icon btn-ghost"
          aria-label="Toggle navigation menu"
          style={{ flexShrink: 0 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M3 6h18M3 12h18M3 18h18"/>
          </svg>
        </button>

        {/* Page title + breadcrumbs */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Breadcrumbs />
          <div style={{
            fontSize: 'var(--fs-sm)',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-display)',
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginTop: 1,
          }}>
            {pageTitle}
          </div>
        </div>

        {/* Command palette trigger */}
        <button
          onClick={() => setCmdOpen(true)}
          aria-label="Open command palette (Ctrl+K)"
          title="Command Palette (Ctrl+K)"
          className="hide-mobile"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 12px',
            background: 'var(--color-bg-raised)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--r-md)',
            color: 'var(--color-text-muted)',
            fontSize: 'var(--fs-xs)',
            fontFamily: "'JetBrains Mono', monospace",
            cursor: 'pointer',
            transition: 'all var(--t-base)',
            flexShrink: 0,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--color-border-hover)'
            e.currentTarget.style.color = 'var(--color-text-primary)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--color-border)'
            e.currentTarget.style.color = 'var(--color-text-muted)'
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          Search…
          <kbd style={{
            padding: '2px 5px',
            background: 'rgba(255,255,255,.06)',
            border: '1px solid rgba(255,255,255,.1)',
            borderRadius: 4,
            fontSize: 10,
          }}>⌘K</kbd>
        </button>

        {/* Right cluster */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* Notification bell (seller/admin only) */}
          {(role === 'seller' || role === 'admin') && (
            <NotificationBell token={token} />
          )}

          {/* Role badge */}
          <div
            className="hide-xs"
            style={{
              padding: '4px 12px',
              borderRadius: 'var(--r-full)',
              background: 'rgba(13,148,136,.1)',
              border: '1px solid rgba(13,148,136,.25)',
              color: '#14b8a6',
              fontSize: 'var(--fs-xs)',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '.05em',
              textTransform: 'uppercase',
            }}
          >
            {role || 'user'}
          </div>

          {/* Sign out */}
          <button
            onClick={onLogout}
            aria-label="Sign out"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 12px',
              borderRadius: 'var(--r-md)',
              border: '1px solid rgba(239,68,68,.2)',
              background: 'rgba(239,68,68,.06)',
              color: '#f87171',
              fontSize: 'var(--fs-xs)',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all var(--t-base)',
              fontFamily: 'var(--font-display)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(239,68,68,.14)'
              e.currentTarget.style.borderColor = 'rgba(239,68,68,.4)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(239,68,68,.06)'
              e.currentTarget.style.borderColor = 'rgba(239,68,68,.2)'
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span className="hide-xs">Sign out</span>
          </button>
        </div>
      </div>

      {/* Command Palette portal */}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </>
  )
}
