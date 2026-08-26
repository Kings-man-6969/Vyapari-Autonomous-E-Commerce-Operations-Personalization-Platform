import React from 'react';

/* ─── DESIGN.MD — Spinner & Loading ───
   Clean monochrome spinner with subtle stroke
───────────────────────────────────────── */

export function SpinnerPage({ message = 'Loading…' }) {
  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      fontFamily: "'Inter', Helvetica, Arial, sans-serif",
      fontFeatureSettings: '"ss03"',
    }}>
      <div style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        border: '2px solid rgba(255,255,255,0.1)',
        borderTopColor: '#ffffff',
        animation: 'spin 0.8s linear infinite',
      }} />
      {message && (
        <span style={{
          fontSize: 12,
          fontWeight: 400,
          color: '#71717a',
          letterSpacing: '0.72px',
          textTransform: 'uppercase',
        }}>
          {message}
        </span>
      )}
    </div>
  );
}

export default function Spinner({ size = 'md', color = '#ffffff' }) {
  const sz = size === 'sm' ? 14 : size === 'lg' ? 32 : 20;
  return (
    <span style={{
      display: 'inline-block',
      width: sz,
      height: sz,
      borderRadius: '50%',
      border: '2px solid rgba(255,255,255,0.15)',
      borderTopColor: color,
      animation: 'spin 0.8s linear infinite',
      flexShrink: 0,
    }} />
  );
}
