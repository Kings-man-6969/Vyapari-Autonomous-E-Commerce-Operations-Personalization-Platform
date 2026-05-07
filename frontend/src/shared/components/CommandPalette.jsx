import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

/*
  COMMAND PALETTE — ⌘K / Ctrl+K
  Linear / Notion-style universal navigation
  Space Grotesk, dark surface, instant filter
*/

const COMMANDS = [
  // Seller
  { id: 'overview',   label: 'Dashboard Overview',     path: '/seller/overview',  group: 'Seller',       icon: '⬡' },
  { id: 'inventory',  label: 'Inventory Management',   path: '/seller/inventory', group: 'Seller',       icon: '📦' },
  { id: 'pricing',    label: 'Pricing Control',        path: '/seller/pricing',   group: 'Seller',       icon: '🏷' },
  { id: 'reviews',    label: 'Review Manager',         path: '/seller/reviews',   group: 'Seller',       icon: '★' },
  { id: 'orders',     label: 'Order Management',       path: '/seller/orders',    group: 'Seller',       icon: '📋' },
  { id: 'finance',    label: 'Financial Dashboard',    path: '/seller/finance',   group: 'Seller',       icon: '₹' },
  { id: 'settings',   label: 'Store Settings',         path: '/seller/settings',  group: 'Seller',       icon: '⚙' },
  { id: 'agent',      label: 'AI Assistant',           path: '/seller/agent',     group: 'Seller',       icon: '🤖' },
  // HITL
  { id: 'hitl',       label: 'Decision Queue',         path: '/hitl',             group: 'HITL Ops',     icon: '⚡' },
  { id: 'history',    label: 'Decision History',       path: '/hitl/history',     group: 'HITL Ops',     icon: '🕐' },
  { id: 'analytics',  label: 'HITL Analytics',         path: '/hitl/analytics',   group: 'HITL Ops',     icon: '📊' },
]

export default function CommandPalette({ open, onClose }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  const filtered = query.trim().length === 0
    ? COMMANDS
    : COMMANDS.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.group.toLowerCase().includes(query.toLowerCase())
      )

  // Reset selection when filter changes
  useEffect(() => { setSelected(0) }, [query])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  const navigate_to = useCallback((path) => {
    navigate(path)
    onClose()
  }, [navigate, onClose])

  function handleKey(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected(s => Math.min(s + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected(s => Math.max(s - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[selected]) navigate_to(filtered[selected].path)
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!open) return null

  // Group results
  const groups = {}
  filtered.forEach(c => {
    if (!groups[c.group]) groups[c.group] = []
    groups[c.group].push(c)
  })

  let globalIdx = 0

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,.65)',
          backdropFilter: 'blur(6px)',
          zIndex: 9000,
        }}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        style={{
          position: 'fixed',
          top: '18%', left: '50%',
          transform: 'translateX(-50%)',
          width: '100%', maxWidth: 560,
          background: '#111827',
          border: '1px solid rgba(255,255,255,.1)',
          borderRadius: 14,
          boxShadow: '0 32px 80px rgba(0,0,0,.7)',
          zIndex: 9001,
          overflow: 'hidden',
          animation: 'cmdSlideIn .18s ease forwards',
        }}
        onKeyDown={handleKey}
      >
        {/* Search input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 16px',
          borderBottom: '1px solid rgba(255,255,255,.07)',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search commands, pages…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#e2e8f0', fontSize: 15, fontFamily: "'Space Grotesk', sans-serif",
            }}
            aria-label="Command palette search"
          />
          <kbd style={{
            padding: '3px 7px', borderRadius: 5,
            background: 'rgba(255,255,255,.07)',
            border: '1px solid rgba(255,255,255,.1)',
            fontSize: 11, color: '#64748b',
            fontFamily: "'JetBrains Mono', monospace",
          }}>ESC</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 360, overflowY: 'auto', padding: '6px 0' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b', fontSize: 13, fontFamily: "'Space Grotesk', sans-serif" }}>
              No results for "{query}"
            </div>
          ) : (
            Object.entries(groups).map(([group, items]) => (
              <div key={group}>
                <div style={{
                  padding: '8px 16px 4px',
                  fontSize: 10, fontWeight: 700,
                  color: '#475569', letterSpacing: '.08em',
                  textTransform: 'uppercase',
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {group}
                </div>
                {items.map((cmd) => {
                  const idx = globalIdx++
                  const isSelected = idx === selected
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => navigate_to(cmd.path)}
                      onMouseEnter={() => setSelected(idx)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        width: '100%', padding: '9px 16px',
                        background: isSelected ? 'rgba(13,148,136,.14)' : 'transparent',
                        border: 'none', borderRadius: 0,
                        color: isSelected ? '#2dd4bf' : '#cbd5e1',
                        fontSize: 14, fontFamily: "'Space Grotesk', sans-serif",
                        cursor: 'pointer', textAlign: 'left',
                        transition: 'background 100ms, color 100ms',
                        outline: isSelected ? '2px solid rgba(13,148,136,.4)' : 'none',
                        outlineOffset: -2,
                      }}
                      aria-selected={isSelected}
                    >
                      <span style={{ fontSize: 15, width: 20, textAlign: 'center', flexShrink: 0 }}>{cmd.icon}</span>
                      <span style={{ flex: 1 }}>{cmd.label}</span>
                      {isSelected && (
                        <kbd style={{
                          padding: '2px 6px', borderRadius: 4,
                          background: 'rgba(13,148,136,.2)',
                          border: '1px solid rgba(13,148,136,.3)',
                          fontSize: 10, color: '#14b8a6',
                          fontFamily: "'JetBrains Mono', monospace",
                        }}>↵</kbd>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div style={{
          padding: '10px 16px',
          borderTop: '1px solid rgba(255,255,255,.06)',
          display: 'flex', gap: 16,
        }}>
          {[['↑↓', 'Navigate'], ['↵', 'Open'], ['ESC', 'Close']].map(([key, label]) => (
            <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#475569', fontFamily: "'Space Grotesk', sans-serif" }}>
              <kbd style={{
                padding: '2px 6px', borderRadius: 4,
                background: 'rgba(255,255,255,.06)',
                border: '1px solid rgba(255,255,255,.08)',
                fontSize: 10, color: '#64748b',
                fontFamily: "'JetBrains Mono', monospace",
              }}>{key}</kbd>
              {label}
            </span>
          ))}
        </div>
      </div>
    </>
  )
}
