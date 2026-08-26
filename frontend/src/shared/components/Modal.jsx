import React, { useEffect, useCallback } from 'react';

/* ─── DESIGN.MD — Modal Component ───
   Background: #0a0a0a elevated card
   Border: 1px solid #1e2c31
   Elevation: Level 2 / Level 4 dialog
   Buttons: pill-only (border-radius: 9999px)
────────────────────────────────────── */

export default function Modal({ open, title, children, onClose, maxWidth = 520 }) {
  const handleKey = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKey);
      return () => document.removeEventListener('keydown', handleKey);
    }
  }, [open, handleKey]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#0a0a0a',
          border: '1px solid #1e2c31',
          borderRadius: 12,
          padding: '32px',
          width: '100%',
          maxWidth,
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
          fontFamily: "'Inter', Helvetica, Arial, sans-serif",
          fontFeatureSettings: '"ss03"',
          animation: 'modalIn 0.25s cubic-bezier(0.16,1,0.3,1) both',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}>
          <h3 style={{
            fontSize: 20,
            fontWeight: 500,
            color: '#ffffff',
            letterSpacing: '0.3px',
            fontFeatureSettings: '"ss03"',
          }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32,
              height: 32,
              borderRadius: 9999,
              background: 'transparent',
              border: '1px solid #1e2c31',
              color: '#71717a',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              transition: 'all 0.18s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#71717a'; e.currentTarget.style.borderColor = '#1e2c31'; }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
