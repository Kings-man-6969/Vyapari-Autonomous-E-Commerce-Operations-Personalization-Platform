import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/* ─── DESIGN.MD — Command Palette ───
   Container: #0a0a0a with Level 2 elevation and #1e2c31 border
   Item list: pill focus highlights, Inter ss03 typography
─────────────────────────────────────── */

const COMMANDS = [
  { id: 'overview',   label: 'Dashboard Overview',     path: '/seller/overview',  group: 'Seller',       icon: '⬡' },
  { id: 'inventory',  label: 'Inventory Management',   path: '/seller/inventory', group: 'Seller',       icon: '📦' },
  { id: 'pricing',    label: 'Pricing Control',        path: '/seller/pricing',   group: 'Seller',       icon: '🏷' },
  { id: 'orders',     label: 'Order Management',       path: '/seller/orders',    group: 'Seller',       icon: '📋' },
  { id: 'finance',    label: 'Financial Dashboard',    path: '/seller/finance',   group: 'Seller',       icon: '₹' },
  { id: 'reviews',    label: 'Review Manager',         path: '/seller/reviews',   group: 'Seller',       icon: '★' },
  { id: 'analytics',  label: 'Performance Analytics',  path: '/seller/analytics', group: 'Seller',       icon: '📈' },
  { id: 'agent',      label: 'AI Assistant',           path: '/seller/ai',        group: 'Seller',       icon: '🤖' },
  { id: 'settings',   label: 'Store Settings',         path: '/seller/settings',  group: 'Seller',       icon: '⚙' },
  { id: 'hitl',       label: 'Decision Queue',         path: '/hitl',             group: 'HITL Ops',     icon: '⚡' },
  { id: 'history',    label: 'Decision History',       path: '/hitl/history',     group: 'HITL Ops',     icon: '🕐' },
  { id: 'hitl-stats', label: 'HITL Analytics',         path: '/hitl/analytics',   group: 'HITL Ops',     icon: '📊' },
  { id: 'adm-vitals', label: 'Platform Vitals',        path: '/admin/overview',   group: 'Admin',        icon: '🛡️' },
  { id: 'adm-users',  label: 'User Directory',         path: '/admin/users',      group: 'Admin',        icon: '👥' },
  { id: 'adm-mod',    label: 'Moderation Queue',       path: '/admin/moderation', group: 'Admin',        icon: '🔒' },
];

export default function CommandPalette({ open, onClose }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const filtered = query.trim().length === 0
    ? COMMANDS
    : COMMANDS.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.group.toLowerCase().includes(query.toLowerCase())
      );

  useEffect(() => { setSelected(0); }, [query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const navigateTo = useCallback((path) => {
    navigate(path);
    onClose();
  }, [navigate, onClose]);

  function handleKey(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected(s => Math.min(s + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected(s => Math.max(s - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selected]) navigateTo(filtered[selected].path);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(10px)',
          zIndex: 9000,
        }}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        style={{
          position: 'fixed',
          top: '20vh',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 560,
          background: '#0a0a0a',
          border: '1px solid #1e2c31',
          borderRadius: 12,
          boxShadow: '0 30px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.08)',
          zIndex: 9001,
          overflow: 'hidden',
          fontFamily: "'Inter', Helvetica, Arial, sans-serif",
          fontFeatureSettings: '"ss03"',
          animation: 'modalIn 0.2s cubic-bezier(0.16,1,0.3,1) both',
        }}
      >
        {/* Search header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #1e2c31',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <span style={{ color: '#71717a', fontSize: 16 }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Type a command or jump to page…"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              fontSize: 16,
              outline: 'none',
              fontFamily: "'Inter', Helvetica, Arial, sans-serif",
              fontFeatureSettings: '"ss03"',
            }}
          />
          <span style={{
            padding: '2px 8px',
            borderRadius: 9999,
            background: '#141414',
            border: '1px solid #1e2c31',
            color: '#71717a',
            fontSize: 11,
          }}>
            ESC
          </span>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 340, overflowY: 'auto', padding: '8px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#71717a', fontSize: 14 }}>
              No commands found
            </div>
          ) : (
            filtered.map((c, idx) => {
              const isSelected = idx === selected;
              return (
                <div
                  key={c.id}
                  onClick={() => navigateTo(c.path)}
                  onMouseEnter={() => setSelected(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: isSelected ? '#1a1a1a' : 'transparent',
                    color: isSelected ? '#ffffff' : 'rgba(255,255,255,0.75)',
                    cursor: 'pointer',
                    transition: 'all 0.1s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 14, opacity: isSelected ? 1 : 0.6 }}>{c.icon}</span>
                    <span style={{ fontSize: 14, fontWeight: isSelected ? 500 : 420 }}>{c.label}</span>
                  </div>
                  <span style={{
                    fontSize: 11,
                    color: '#71717a',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    {c.group}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
