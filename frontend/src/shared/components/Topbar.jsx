import React from 'react';
import { Link } from 'react-router-dom';

/* ─── DESIGN.MD — Topbar Component ───
   Canvas: #000000 pure black · Hairline: #1e2c31
   Pill elements throughout · Inter typography with ss03
──────────────────────────────────────── */

export default function Topbar({ role, userName, onLogout }) {
  const roleLabel = role === 'admin' ? 'Admin' : role === 'seller' ? 'Seller' : 'Operator';
  const roleBg = role === 'admin' ? '#fee2e2' : '#1e2c31';
  const roleColor = role === 'admin' ? '#991b1b' : '#ffffff';

  return (
    <header style={{
      height: 64,
      background: '#000000',
      borderBottom: '1px solid #1e2c31',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 28px',
      flexShrink: 0,
      zIndex: 40,
      position: 'sticky',
      top: 0,
      fontFamily: "'Inter', Helvetica, Arial, sans-serif",
      fontFeatureSettings: '"ss03"',
    }}>
      {/* Left: status indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          borderRadius: 9999,
          background: '#0a0a0a',
          border: '1px solid #1e2c31',
        }}>
          <div style={{
            width: 6, height: 6,
            borderRadius: '50%',
            background: '#c1fbd4',
          }} />
          <span style={{
            fontSize: 11,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.7)',
            textTransform: 'uppercase',
            letterSpacing: '0.72px',
            fontFeatureSettings: '"ss03"',
          }}>System Active</span>
        </div>
      </div>

      {/* Right: navigation link + user info + logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Customer store preview link */}
        <Link
          to="/shop"
          style={{
            padding: '7px 16px',
            borderRadius: 9999,
            background: 'transparent',
            border: '1px solid #1e2c31',
            color: 'rgba(255,255,255,0.8)',
            fontSize: 13,
            fontWeight: 420,
            textDecoration: 'none',
            transition: 'all 0.18s',
            fontFeatureSettings: '"ss03"',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; e.currentTarget.style.color = '#ffffff'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e2c31'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
        >
          <span>Storefront</span>
          <span style={{ fontSize: 11 }}>↗</span>
        </Link>

        {/* Role badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          borderRadius: 9999,
          background: roleBg,
          color: roleColor,
          fontSize: 11,
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: '0.72px',
          fontFeatureSettings: '"ss03"',
        }}>
          <span>{roleLabel}</span>
        </div>

        {/* User name */}
        {userName && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 14px 4px 6px',
            borderRadius: 9999,
            background: '#0a0a0a',
            border: '1px solid #1e2c31',
          }}>
            <div style={{
              width: 24, height: 24,
              borderRadius: '50%',
              background: '#c1fbd4',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 600, color: '#000000',
              flexShrink: 0,
            }}>
              {userName.charAt(0).toUpperCase()}
            </div>
            <span style={{
              fontSize: 13,
              fontWeight: 420,
              color: '#ffffff',
              maxWidth: 120,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontFeatureSettings: '"ss03"',
            }}>
              {userName}
            </span>
          </div>
        )}

        {/* Logout button — button-outline-on-dark */}
        <button
          onClick={onLogout}
          style={{
            padding: '7px 16px',
            borderRadius: 9999,
            background: 'transparent',
            border: '1px solid #1e2c31',
            color: '#71717a',
            fontSize: 13,
            fontWeight: 420,
            cursor: 'pointer',
            transition: 'all 0.18s',
            fontFamily: "'Inter', Helvetica, Arial, sans-serif",
            fontFeatureSettings: '"ss03"',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#71717a'; e.currentTarget.style.borderColor = '#1e2c31'; }}
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
