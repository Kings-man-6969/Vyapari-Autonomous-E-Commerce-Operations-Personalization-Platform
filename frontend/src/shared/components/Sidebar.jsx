import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';

/* ─── DESIGN.MD — Dark Operational Sidebar ───
   Canvas: #000000 pure black · Hairline: #1e2c31
   Nav items: pill shape (border-radius: 9999px)
   Typography: Inter with ss03 feature settings
─────────────────────────────────────────────── */

const NAV_ITEMS = [
  { icon: <OverviewIcon />, label: 'Overview',     to: '/seller/overview' },
  { icon: <BoxIcon />,      label: 'Inventory',    to: '/seller/inventory' },
  { icon: <TagIcon />,      label: 'Pricing',      to: '/seller/pricing' },
  { icon: <OrderIcon />,    label: 'Orders',       to: '/seller/orders' },
  { icon: <FinanceIcon />,  label: 'Finance',      to: '/seller/finance' },
  { icon: <StarIcon />,     label: 'Reviews',      to: '/seller/reviews' },
  { icon: <ChartIcon />,    label: 'Analytics',    to: '/seller/analytics' },
  { icon: <AiIcon />,       label: 'AI Assistant', to: '/seller/ai' },
  { icon: <PlusIcon />,     label: 'Add Product',  to: '/seller/products/add' },
  { icon: <GearIcon />,     label: 'Settings',     to: '/seller/settings' },
];

const HITL_ITEMS = [
  { icon: <BrainIcon />,  label: 'HITL Queue',     to: '/hitl',          badge: true, end: true },
  { icon: <ClockIcon />,  label: 'History',         to: '/hitl/history' },
  { icon: <GraphIcon />,  label: 'HITL Analytics',  to: '/hitl/analytics' },
];

const ADMIN_ITEMS = [
  { icon: <ShieldIcon />, label: 'Platform Vitals', to: '/admin/overview' },
  { icon: <UsersIcon />,  label: 'User Directory',  to: '/admin/users' },
  { icon: <LockIcon />,   label: 'Moderation',      to: '/admin/moderation' },
];

export default function Sidebar({ role, pendingCount = 0 }) {
  const [collapsed, setCollapsed] = useState(false);

  const itemStyle = (isActive) => ({
    display: 'flex',
    alignItems: 'center',
    gap: collapsed ? 0 : 12,
    padding: collapsed ? '10px' : '9px 16px',
    borderRadius: 9999,
    textDecoration: 'none',
    marginBottom: 4,
    fontSize: 14,
    fontWeight: isActive ? 500 : 420,
    color: isActive ? '#000000' : 'rgba(255,255,255,0.7)',
    background: isActive ? '#ffffff' : 'transparent',
    transition: 'all 0.18s ease',
    justifyContent: collapsed ? 'center' : 'flex-start',
    fontFamily: "'Inter', Helvetica, Arial, sans-serif",
    fontFeatureSettings: '"ss03"',
    position: 'relative',
    overflow: 'hidden',
  });

  return (
    <aside style={{
      width: collapsed ? 64 : 240,
      flexShrink: 0,
      background: '#000000',
      borderRight: '1px solid #1e2c31',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
      overflow: 'hidden',
      transition: 'width 0.25s cubic-bezier(0.16,1,0.3,1)',
      zIndex: 50,
      fontFamily: "'Inter', Helvetica, Arial, sans-serif",
      fontFeatureSettings: '"ss03"',
    }}>
      {/* Logo Header */}
      <div style={{
        padding: '16px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        borderBottom: '1px solid #1e2c31',
        minHeight: 64,
      }}>
        {!collapsed && (
          <Link to={role === 'admin' ? '/admin/overview' : '/seller/overview'} style={{ textDecoration: 'none' }}>
            <span style={{
              fontSize: 16,
              fontWeight: 600,
              color: '#ffffff',
              letterSpacing: '0.5px',
              fontFamily: "'Inter', Helvetica, Arial, sans-serif",
              fontFeatureSettings: '"ss03"',
            }}>VYAPARI</span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 9999,
            background: '#0a0a0a',
            border: '1px solid #1e2c31',
            color: '#71717a',
            cursor: 'pointer',
            transition: 'all 0.18s',
            flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#71717a'; e.currentTarget.style.borderColor = '#1e2c31'; }}
          aria-label="Toggle sidebar"
        >
          {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </button>
      </div>

      {/* Nav body */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '16px 12px' }}>
        {/* Admin Navigation (Only for Admin role) */}
        {role === 'admin' && (
          <div style={{ marginBottom: 12 }}>
            {!collapsed && (
              <div style={{
                fontSize: 11, fontWeight: 400, color: '#71717a',
                textTransform: 'uppercase', letterSpacing: '0.72px',
                padding: '4px 12px 8px',
                fontFeatureSettings: '"ss03"',
              }}>Administration</div>
            )}
            {ADMIN_ITEMS.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                style={({ isActive }) => itemStyle(isActive)}
                onMouseEnter={e => {
                  if (!e.currentTarget.style.background.includes('rgb(255, 255, 255)')) {
                    e.currentTarget.style.background = '#0a0a0a';
                    e.currentTarget.style.color = '#ffffff';
                  }
                }}
                onMouseLeave={e => {
                  if (!e.currentTarget.style.background.includes('rgb(255, 255, 255)')) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                  }
                }}
              >
                <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', color: 'inherit' }}>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </div>
        )}

        {/* Seller Navigation (Only for Seller role) */}
        {role === 'seller' && (
          <div style={{ marginBottom: 12 }}>
            {!collapsed && (
              <div style={{
                fontSize: 11, fontWeight: 400, color: '#71717a',
                textTransform: 'uppercase', letterSpacing: '0.72px',
                padding: '4px 12px 8px',
                fontFeatureSettings: '"ss03"',
              }}>Store Operations</div>
            )}
            {NAV_ITEMS.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                style={({ isActive }) => itemStyle(isActive)}
                onMouseEnter={e => {
                  if (!e.currentTarget.style.background.includes('rgb(255, 255, 255)')) {
                    e.currentTarget.style.background = '#0a0a0a';
                    e.currentTarget.style.color = '#ffffff';
                  }
                }}
                onMouseLeave={e => {
                  if (!e.currentTarget.style.background.includes('rgb(255, 255, 255)')) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                  }
                }}
              >
                <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', color: 'inherit' }}>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </div>
        )}

        {/* Hairline Divider */}
        <div style={{ height: 1, background: '#1e2c31', margin: '12px 6px 16px' }} />

        {/* HITL / Autonomous Control (Shared by Admin & Seller) */}
        <div>
          {!collapsed && (
            <div style={{
              fontSize: 11, fontWeight: 400, color: '#71717a',
              textTransform: 'uppercase', letterSpacing: '0.72px',
              padding: '4px 12px 8px',
              fontFeatureSettings: '"ss03"',
            }}>Autonomous Oversight</div>
          )}
          {HITL_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => itemStyle(isActive)}
              onMouseEnter={e => {
                if (!e.currentTarget.style.background.includes('rgb(255, 255, 255)')) {
                  e.currentTarget.style.background = '#0a0a0a';
                  e.currentTarget.style.color = '#ffffff';
                }
              }}
              onMouseLeave={e => {
                if (!e.currentTarget.style.background.includes('rgb(255, 255, 255)')) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                }
              }}
            >
              <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', color: 'inherit' }}>{item.icon}</span>
              {!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}
              {item.badge && pendingCount > 0 && (
                <span style={{
                  background: '#fee2e2',
                  color: '#991b1b',
                  fontSize: 11,
                  fontWeight: 500,
                  borderRadius: 9999,
                  minWidth: 20,
                  height: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 6px',
                  flexShrink: 0,
                  fontFeatureSettings: '"ss03"',
                }}>{pendingCount > 99 ? '99+' : pendingCount}</span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid #1e2c31',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#c1fbd4' }} />
          <span style={{ fontSize: 12, color: '#71717a', fontFeatureSettings: '"ss03"' }}>
            Vyapari Autonomous Ops
          </span>
        </div>
      )}
    </aside>
  );
}

/* ─── SVG Icons ─── */
function OverviewIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>; }
function BoxIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></svg>; }
function TagIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.41 0l7.72-7.72a1 1 0 0 0 0-1.41z"/><path d="M7 7h.01"/></svg>; }
function StarIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>; }
function OrderIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" x2="21" y1="6" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>; }
function FinanceIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>; }
function ChartIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>; }
function AiIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>; }
function PlusIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>; }
function GearIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>; }
function BrainIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/></svg>; }
function ClockIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>; }
function GraphIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>; }
function ShieldIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>; }
function UsersIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function LockIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>; }
function ChevronLeftIcon()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>; }
function ChevronRightIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>; }
