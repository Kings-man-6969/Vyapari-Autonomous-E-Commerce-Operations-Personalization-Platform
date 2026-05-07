import React, { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '@/services/api'

/*
  NOTIFICATION BELL — real-time badge + dropdown
  Polls /stats every 60s for pending HITL decisions + low stock alerts
  Space Grotesk, teal accent, animated badge bounce
*/

export default function NotificationBell({ token }) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unread, setUnread] = useState(0)
  const ref = useRef(null)

  const fetchNotifications = useCallback(async () => {
    // Skip if no valid-looking token (avoids 401 spam before auth)
    if (!token || token.length < 20) return
    try {
      const stats = await apiFetch('/stats', {}, token)
      const items = []
      if (stats.pending_agent_decisions > 0) {
        items.push({
          id: 'hitl',
          icon: '⚡',
          title: `${stats.pending_agent_decisions} pending HITL decision${stats.pending_agent_decisions > 1 ? 's' : ''}`,
          sub: 'Review AI proposals in Decision Queue',
          path: '/hitl',
          variant: 'warning',
        })
      }
      if (stats.critical_stock_items > 0) {
        items.push({
          id: 'stock',
          icon: '⚠',
          title: `${stats.critical_stock_items} product${stats.critical_stock_items > 1 ? 's' : ''} critically low`,
          sub: 'Immediate restocking recommended',
          path: '/seller/inventory',
          variant: 'danger',
        })
      }
      if (stats.escalated_reviews > 0) {
        items.push({
          id: 'review',
          icon: '🔺',
          title: `${stats.escalated_reviews} escalated review${stats.escalated_reviews > 1 ? 's' : ''}`,
          sub: 'Require your direct attention',
          path: '/seller/reviews',
          variant: 'danger',
        })
      }
      if (items.length === 0) {
        items.push({
          id: 'clear',
          icon: '✓',
          title: 'All clear',
          sub: 'No pending actions required',
          path: null,
          variant: 'success',
        })
      }
      setNotifications(items)
      setUnread(items.filter(i => i.variant !== 'success').length)
    } catch { /* silent */ }
  }, [token])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60_000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Click-outside close
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const variantColors = {
    warning: { color: '#f59e0b', bg: 'rgba(245,158,11,.1)', border: 'rgba(245,158,11,.2)' },
    danger:  { color: '#ef4444', bg: 'rgba(239,68,68,.1)',  border: 'rgba(239,68,68,.2)' },
    success: { color: '#14b8a6', bg: 'rgba(20,184,166,.08)', border: 'rgba(20,184,166,.15)' },
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        style={{
          position: 'relative',
          width: 36, height: 36,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: open ? 'var(--color-bg-raised)' : 'transparent',
          border: '1px solid ' + (open ? 'var(--color-border-hover)' : 'transparent'),
          borderRadius: 'var(--r-md)',
          color: 'var(--color-text-muted)',
          cursor: 'pointer',
          transition: 'all var(--t-base)',
        }}
        onMouseEnter={e => { if (!open) { e.currentTarget.style.background = 'var(--color-bg-raised)'; e.currentTarget.style.borderColor = 'var(--color-border)' } }}
        onMouseLeave={e => { if (!open) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' } }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && (
          <span
            style={{
              position: 'absolute', top: 4, right: 4,
              width: 16, height: 16,
              background: '#ef4444',
              borderRadius: '50%',
              fontSize: 9, fontWeight: 800,
              color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'JetBrains Mono', monospace",
              animation: 'badgeBounce .5s ease',
              border: '2px solid var(--color-bg-surface)',
            }}
            aria-hidden="true"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Notifications"
          className="animate-fade-in"
          style={{
            position: 'absolute', right: 0, top: 'calc(100% + 8px)',
            width: 300,
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--r-lg)',
            boxShadow: 'var(--sh-xl)',
            zIndex: 500,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '12px 16px 10px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>
              Notifications
            </div>
            {unread > 0 && (
              <span style={{
                padding: '2px 8px',
                background: 'rgba(239,68,68,.1)',
                border: '1px solid rgba(239,68,68,.2)',
                borderRadius: 'var(--r-full)',
                fontSize: 10, fontWeight: 700, color: '#f87171',
                fontFamily: "'JetBrains Mono', monospace",
              }}>{unread} new</span>
            )}
          </div>

          {/* Items */}
          <div style={{ padding: '6px 0' }}>
            {notifications.map(notif => {
              const vc = variantColors[notif.variant] || variantColors.success
              return (
                <div
                  key={notif.id}
                  role="option"
                  onClick={() => { if (notif.path) { window.location.href = notif.path }; setOpen(false) }}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '10px 16px',
                    cursor: notif.path ? 'pointer' : 'default',
                    transition: 'background var(--t-fast)',
                    borderLeft: `3px solid ${vc.color}`,
                  }}
                  onMouseEnter={e => { if (notif.path) e.currentTarget.style.background = 'var(--color-bg-raised)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{
                    width: 30, height: 30, flexShrink: 0,
                    background: vc.bg,
                    border: `1px solid ${vc.border}`,
                    borderRadius: 'var(--r-sm)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13,
                  }}>{notif.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 'var(--fs-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)', marginBottom: 2 }}>
                      {notif.title}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-display)', lineHeight: 1.4 }}>
                      {notif.sub}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div style={{
            padding: '8px 16px 10px',
            borderTop: '1px solid var(--color-border)',
            fontSize: 10, color: 'var(--color-text-faint)',
            fontFamily: "'JetBrains Mono', monospace",
            textAlign: 'right',
          }}>
            Auto-refreshes every 60s
          </div>
        </div>
      )}
    </div>
  )
}
