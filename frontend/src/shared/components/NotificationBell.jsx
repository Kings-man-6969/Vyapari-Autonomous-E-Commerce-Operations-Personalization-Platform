import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/services/api';

/* ─── DESIGN.MD — NotificationBell ───
   Dropdown: #0a0a0a elevated panel with #1e2c31 border
   Notification chips: pill status badges
   Typography: Inter ss03
──────────────────────────────────────── */

export default function NotificationBell({ token }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  const fetchNotifications = useCallback(async () => {
    if (!token || token.length < 20) return;
    try {
      const stats = await apiFetch('/stats', {}, token);
      const items = [];
      if (stats.pending_agent_decisions > 0) {
        items.push({
          id: 'hitl',
          icon: '⚡',
          title: `${stats.pending_agent_decisions} pending decision${stats.pending_agent_decisions > 1 ? 's' : ''}`,
          sub: 'Review AI proposals in Decision Queue',
          path: '/hitl',
          variant: 'warning',
        });
      }
      if (stats.critical_stock_items > 0) {
        items.push({
          id: 'stock',
          icon: '⚠',
          title: `${stats.critical_stock_items} product${stats.critical_stock_items > 1 ? 's' : ''} critically low`,
          sub: 'Immediate restocking recommended',
          path: '/seller/inventory',
          variant: 'danger',
        });
      }
      if (stats.escalated_reviews > 0) {
        items.push({
          id: 'review',
          icon: '★',
          title: `${stats.escalated_reviews} escalated review${stats.escalated_reviews > 1 ? 's' : ''}`,
          sub: 'Requires your attention',
          path: '/seller/reviews',
          variant: 'danger',
        });
      }
      if (items.length === 0) {
        items.push({
          id: 'clear',
          icon: '✓',
          title: 'All clear',
          sub: 'No pending actions required',
          path: null,
          variant: 'success',
        });
      }
      setNotifications(items);
      setUnread(items.filter(i => i.variant !== 'success').length);
    } catch { /* silent */ }
  }, [token]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        style={{
          position: 'relative',
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: open ? '#141414' : 'transparent',
          border: '1px solid ' + (open ? 'rgba(255,255,255,0.2)' : '#1e2c31'),
          borderRadius: 9999,
          color: 'rgba(255,255,255,0.8)',
          cursor: 'pointer',
          transition: 'all 0.18s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
        onMouseLeave={e => {
          if (!open) {
            e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
            e.currentTarget.style.borderColor = '#1e2c31';
          }
        }}
      >
        <BellIcon />
        {unread > 0 && (
          <span style={{
            position: 'absolute',
            top: -2,
            right: -2,
            minWidth: 16,
            height: 16,
            borderRadius: 9999,
            background: '#fee2e2',
            color: '#991b1b',
            fontSize: 10,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            fontFamily: "'Inter', Helvetica, Arial, sans-serif",
            fontFeatureSettings: '"ss03"',
          }}>
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: 'calc(100% + 8px)',
          width: 320,
          background: '#0a0a0a',
          border: '1px solid #1e2c31',
          borderRadius: 12,
          boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)',
          zIndex: 200,
          overflow: 'hidden',
          fontFamily: "'Inter', Helvetica, Arial, sans-serif",
          fontFeatureSettings: '"ss03"',
          animation: 'modalIn 0.2s cubic-bezier(0.16,1,0.3,1) both',
        }}>
          <div style={{
            padding: '14px 18px',
            borderBottom: '1px solid #1e2c31',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#ffffff' }}>Notifications</span>
            {unread > 0 && (
              <span style={{
                fontSize: 11,
                fontWeight: 500,
                padding: '2px 8px',
                borderRadius: 9999,
                background: '#fee2e2',
                color: '#991b1b',
              }}>
                {unread} new
              </span>
            )}
          </div>

          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {notifications.map((item) => (
              <a
                key={item.id}
                href={item.path || '#'}
                onClick={e => {
                  if (!item.path) e.preventDefault();
                  setOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '14px 18px',
                  borderBottom: '1px solid #141414',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'background 0.15s',
                  background: 'transparent',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#121212'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: 9999,
                  background: item.variant === 'success' ? 'rgba(193,251,212,0.15)' : 'rgba(254,226,226,0.15)',
                  color: item.variant === 'success' ? '#c1fbd4' : '#fee2e2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  flexShrink: 0,
                }}>
                  {item.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#ffffff', marginBottom: 2 }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: 12, color: '#71717a', lineHeight: 1.4 }}>
                    {item.sub}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
