import React from 'react';

/* ─── DESIGN.MD — StatCard ───
   Card: card-feature-cinematic (#0a0a0a bg, rounded-lg 12px, Level 1 top highlight)
   Typography: Inter with ss03
   Label: eyebrow-cap (12px, uppercase, letter-spacing: 0.72px)
   Value: heading-xl / display-md (weight 330-500)
─────────────────────────────── */

const VARIANT_MAP = {
  primary: { color: '#ffffff', tagBg: '#1e2c31', tagColor: '#ffffff' },
  success: { color: '#c1fbd4', tagBg: 'rgba(193,251,212,0.15)', tagColor: '#c1fbd4' },
  warning: { color: '#fef3c7', tagBg: 'rgba(254,243,199,0.15)', tagColor: '#fef3c7' },
  danger:  { color: '#fee2e2', tagBg: 'rgba(254,226,226,0.15)', tagColor: '#fee2e2' },
  teal:    { color: '#c1fbd4', tagBg: 'rgba(193,251,212,0.15)', tagColor: '#c1fbd4' },
  info:    { color: '#dbeafe', tagBg: 'rgba(219,234,254,0.15)', tagColor: '#dbeafe' },
};

export default function StatCard({ label, value, icon, variant = 'primary', sub, trend, prefix = '' }) {
  const v = VARIANT_MAP[variant] || VARIANT_MAP.primary;

  return (
    <div
      style={{
        background: '#0a0a0a',
        border: '1px solid #1e2c31',
        borderRadius: 12,
        padding: '24px',
        boxShadow: '0 1px 2px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'Inter', Helvetica, Arial, sans-serif",
        fontFeatureSettings: '"ss03"',
        transition: 'border-color 0.2s',
      }}
    >
      {/* Top row: Icon + Label */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{
          fontSize: 12,
          fontWeight: 400,
          color: '#71717a',
          textTransform: 'uppercase',
          letterSpacing: '0.72px',
          fontFeatureSettings: '"ss03"',
        }}>
          {label}
        </span>
        {icon && (
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: '#141414',
            border: '1px solid #1e2c31',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.8)',
          }}>
            {icon}
          </div>
        )}
      </div>

      {/* Value */}
      <div style={{
        fontSize: 28,
        fontWeight: 400,
        color: '#ffffff',
        letterSpacing: '0.3px',
        lineHeight: 1.2,
        marginBottom: 8,
        fontFeatureSettings: '"ss03"',
      }}>
        {prefix}{typeof value === 'number' ? value.toLocaleString() : value}
      </div>

      {/* Sub + Trend */}
      {(sub || trend !== undefined) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
          {sub && (
            <span style={{ fontSize: 12, color: '#71717a', fontFeatureSettings: '"ss03"' }}>
              {sub}
            </span>
          )}
          {trend !== undefined && (
            <span style={{
              fontSize: 11,
              fontWeight: 500,
              padding: '2px 8px',
              borderRadius: 9999,
              background: trend >= 0 ? 'rgba(193,251,212,0.15)' : 'rgba(254,226,226,0.15)',
              color: trend >= 0 ? '#c1fbd4' : '#fee2e2',
              fontFeatureSettings: '"ss03"',
            }}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}
