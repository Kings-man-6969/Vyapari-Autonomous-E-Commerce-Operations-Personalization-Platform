import React, { useEffect, useRef } from 'react'

/**
 * Modal — Accessible overlay dialog
 * @param {boolean} open
 * @param {function} onClose
 * @param {string} title
 * @param {React.ReactNode} children
 * @param {string} [size] - 'sm' | 'md' | 'lg'
 */
export default function Modal({ open, onClose, title, children, size = 'md' }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const el = dialogRef.current
    if (el) el.focus()
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const maxWidths = { sm: 400, md: 560, lg: 760 }

  return (
    <div
      style={overlayStyle}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      aria-modal="true"
      role="dialog"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        style={{ ...dialogStyle, maxWidth: maxWidths[size] || maxWidths.md }}
        className="animate-fade-in"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={headerStyle}>
          <h3 id="modal-title" style={{ margin: 0, fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--c-text)' }}>
            {title}
          </h3>
          <button onClick={onClose} style={closeStyle} aria-label="Close modal">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="m18 6-12 12M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '0 24px 24px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.72)',
  backdropFilter: 'blur(4px)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
}

const dialogStyle = {
  width: '100%',
  background: 'var(--c-surface)',
  border: '1px solid var(--c-border)',
  borderRadius: 'var(--radius-2xl)',
  boxShadow: 'var(--shadow-xl)',
  outline: 'none',
  maxHeight: 'calc(100vh - 40px)',
  overflow: 'auto',
}

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '20px 24px 16px',
  borderBottom: '1px solid var(--c-border)',
  marginBottom: 20,
}

const closeStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 30,
  height: 30,
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--c-border)',
  background: 'transparent',
  color: 'var(--c-text-muted)',
  cursor: 'pointer',
  transition: 'all 150ms ease',
  flexShrink: 0,
}
