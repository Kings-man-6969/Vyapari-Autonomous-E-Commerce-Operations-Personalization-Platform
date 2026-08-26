import React from 'react';

/* ─── DESIGN.MD — EmptyState ───
   Container: #0a0a0a card with #1e2c31 border and Level 1 elevation
   Typography: Inter ss03
───────────────────────────────── */

export default function EmptyState({ icon = '📦', title = 'No items found', description = '', action }) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '64px 24px',
        background: '#0a0a0a',
        border: '1px solid #1e2c31',
        borderRadius: 12,
        boxShadow: '0 1px 2px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
        fontFamily: "'Inter', Helvetica, Arial, sans-serif",
        fontFeatureSettings: '"ss03"',
      }}
    >
      <div style={{ fontSize: '3rem', marginBottom: 16 }}>{icon}</div>
      <div style={{ fontSize: 18, fontWeight: 500, color: '#ffffff', marginBottom: 8, fontFeatureSettings: '"ss03"' }}>
        {title}
      </div>
      {description && (
        <div style={{ fontSize: 14, color: '#71717a', maxWidth: 440, margin: '0 auto 24px', lineHeight: 1.5, fontFeatureSettings: '"ss03"' }}>
          {description}
        </div>
      )}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}
