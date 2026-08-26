import React from 'react';
import Modal from './Modal';

/* ─── DESIGN.MD — ConfirmModal ───
   Actions: pill-only (button-primary-pill / button-outline-on-dark)
─────────────────────────────────── */

export default function ConfirmModal({
  open,
  title = 'Confirm action',
  message = 'Are you sure you want to proceed?',
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  dangerConfirm = false,
  loading = false,
}) {
  if (!open) return null;

  return (
    <Modal open={open} title={title} onClose={onCancel} maxWidth={440}>
      <p style={{
        color: '#a1a1aa',
        fontSize: 15,
        fontWeight: 420,
        lineHeight: 1.6,
        marginBottom: 32,
        fontFamily: "'Inter', Helvetica, Arial, sans-serif",
        fontFeatureSettings: '"ss03"',
      }}>
        {message}
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        {/* Cancel button — button-outline-on-dark */}
        <button
          onClick={onCancel}
          disabled={loading}
          style={{
            padding: '10px 22px',
            borderRadius: 9999,
            background: 'transparent',
            border: '1px solid #1e2c31',
            color: 'rgba(255,255,255,0.8)',
            fontSize: 14,
            fontWeight: 420,
            cursor: 'pointer',
            fontFamily: "'Inter', Helvetica, Arial, sans-serif",
            fontFeatureSettings: '"ss03"',
            transition: 'all 0.18s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; e.currentTarget.style.borderColor = '#1e2c31'; }}
        >
          Cancel
        </button>

        {/* Confirm button — pill button */}
        <button
          onClick={onConfirm}
          disabled={loading}
          style={{
            padding: '10px 24px',
            borderRadius: 9999,
            background: dangerConfirm ? '#991b1b' : '#ffffff',
            color: dangerConfirm ? '#ffffff' : '#000000',
            border: 'none',
            fontSize: 14,
            fontWeight: 500,
            cursor: loading ? 'wait' : 'pointer',
            fontFamily: "'Inter', Helvetica, Arial, sans-serif",
            fontFeatureSettings: '"ss03"',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.18s',
          }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.filter = 'brightness(0.9)'; }}
          onMouseLeave={e => { if (!loading) e.currentTarget.style.filter = 'none'; }}
        >
          {loading && (
            <span style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              border: '2px solid rgba(0,0,0,0.2)',
              borderTopColor: '#000000',
              animation: 'spin 0.8s linear infinite',
            }} />
          )}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
