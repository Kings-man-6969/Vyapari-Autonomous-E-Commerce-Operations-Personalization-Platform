import React from 'react';
import { Link, useLocation } from 'react-router-dom';

/* ─── DESIGN.MD — Breadcrumbs ───
   Typography: eyebrow-cap (Inter 11px, letter-spacing: 0.72px)
─────────────────────────────────── */

const PATH_LABELS = {
  seller: 'Seller',
  overview: 'Overview',
  inventory: 'Inventory',
  pricing: 'Pricing',
  reviews: 'Reviews',
  orders: 'Orders',
  analytics: 'Analytics',
  products: 'Products',
  add: 'Add Product',
  settings: 'Settings',
  finance: 'Finance',
  agent: 'AI Assistant',
  hitl: 'HITL Ops',
  history: 'History',
  decision: 'Decision',
  admin: 'Admin',
  users: 'Users',
  moderation: 'Moderation',
};

export default function Breadcrumbs() {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length <= 1) return null;

  const crumbs = segments.map((seg, i) => ({
    label: PATH_LABELS[seg] || seg,
    path: '/' + segments.slice(0, i + 1).join('/'),
    isLast: i === segments.length - 1,
  }));

  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: "'Inter', Helvetica, Arial, sans-serif",
        fontFeatureSettings: '"ss03"',
        fontSize: 12,
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
        marginBottom: 20,
      }}
    >
      {crumbs.map((crumb, i) => (
        <span key={crumb.path} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {i > 0 && <span style={{ color: '#71717a' }}>/</span>}
          {crumb.isLast ? (
            <span style={{ color: '#ffffff', fontWeight: 500 }}>
              {crumb.label}
            </span>
          ) : (
            <Link
              to={crumb.path}
              style={{
                color: '#71717a',
                textDecoration: 'none',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ffffff'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#71717a'; }}
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
