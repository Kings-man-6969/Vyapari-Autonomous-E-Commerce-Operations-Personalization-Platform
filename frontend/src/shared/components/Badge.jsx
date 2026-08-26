import React from 'react';

/* ─── DESIGN.MD — Badge & Tag ───
   Geometry: pill (border-radius: 9999px) is strictly enforced
   Typography: eyebrow-cap (fontSize: 11-12px, letter-spacing: 0.72px)
   Palette: Semantic tones mapped to DESIGN.md
─────────────────────────────────── */

export function riskVariant(level) {
  const map = { high: 'danger', medium: 'warning', low: 'success' };
  return map[level] || 'neutral';
}

export function statusVariant(status) {
  const map = {
    approved: 'success',
    rejected: 'danger',
    pending:  'warning',
    escalated: 'danger',
    executed:  'success',
    auto_executed: 'success',
  };
  return map[status] || 'neutral';
}

export function stockVariant(qty) {
  if (qty <= 0) return 'danger';
  if (qty <= 5) return 'danger';
  if (qty <= 20) return 'warning';
  return 'success';
}

const BADGE_STYLES = {
  success: { bg: 'rgba(193,251,212,0.15)', color: '#c1fbd4', border: '1px solid rgba(193,251,212,0.3)' },
  warning: { bg: 'rgba(254,243,199,0.15)', color: '#fef3c7', border: '1px solid rgba(254,243,199,0.3)' },
  danger:  { bg: 'rgba(254,226,226,0.15)', color: '#fee2e2', border: '1px solid rgba(254,226,226,0.3)' },
  info:    { bg: 'rgba(219,234,254,0.15)', color: '#dbeafe', border: '1px solid rgba(219,234,254,0.3)' },
  teal:    { bg: 'rgba(193,251,212,0.15)', color: '#c1fbd4', border: '1px solid rgba(193,251,212,0.3)' },
  neutral: { bg: '#1e2c31', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.1)' },
};

export default function Badge({ type = 'neutral', variant, children, style }) {
  const v = variant || type;
  const s = BADGE_STYLES[v] || BADGE_STYLES.neutral;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 9999,
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
        fontFamily: "'Inter', Helvetica, Arial, sans-serif",
        fontFeatureSettings: '"ss03"',
        background: s.bg,
        color: s.color,
        border: s.border,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </span>
  );
}
