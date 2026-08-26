import React from 'react';

/* ─── DESIGN.MD — PageHeader ───
   Title: heading-xl (28px, weight 500) or display-md (weight 330)
   Description: body-md (Inter 420w, #71717a)
   Actions: enforces pill buttons
───────────────────────────────── */

export default function PageHeader({ title, description, action }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 16,
      flexWrap: 'wrap',
      marginBottom: 32,
      fontFamily: "'Inter', Helvetica, Arial, sans-serif",
      fontFeatureSettings: '"ss03"',
    }}>
      <div>
        <h1 style={{
          fontSize: 28,
          fontWeight: 400,
          color: '#ffffff',
          letterSpacing: '0.36px',
          lineHeight: 1.2,
          marginBottom: description ? 6 : 0,
          fontFeatureSettings: '"ss03"',
        }}>
          {title}
        </h1>
        {description && (
          <p style={{
            color: '#71717a',
            fontSize: 15,
            fontWeight: 420,
            lineHeight: 1.5,
            maxWidth: 600,
            fontFeatureSettings: '"ss03"',
          }}>
            {description}
          </p>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}
