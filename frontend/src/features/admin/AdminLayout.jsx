import React, { useState } from 'react';
import { Outlet, Navigate, Link, useLocation } from 'react-router-dom';

/* ─── DESIGN.MD — Admin Layout ───
   Canvas: #000000 · Sidebar: #000000 / #0a0a0a · Hairlines: #1e2c31
   Buttons & Links: pill-only · Typography: Inter ss03
─────────────────────────────────── */

export default function AdminLayout({ token, role, onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  if (!token || role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  function isActive(path) {
    return location.pathname.startsWith(path);
  }

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: '#000000',
      color: '#ffffff',
      fontFamily: "'Inter', Helvetica, Arial, sans-serif",
      fontFeatureSettings: '"ss03"',
    }}>
      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 40,
          }}
        />
      )}

      {/* Sidebar */}
      <aside style={{
        width: 260,
        background: '#000000',
        borderRight: '1px solid #1e2c31',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        zIndex: 50,
      }}>
        {/* Header */}
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid #1e2c31' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 9999,
              background: '#ffffff',
              color: '#000000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              fontSize: 16,
            }}>
              ⚡
            </div>
            <div>
              <div style={{ fontWeight: 500, fontSize: 15, color: '#ffffff', fontFeatureSettings: '"ss03"' }}>Vyapari</div>
              <div style={{ fontSize: 12, color: '#71717a', fontFeatureSettings: '"ss03"' }}>Platform Admin</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '16px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: '#71717a', letterSpacing: '0.72px', textTransform: 'uppercase', padding: '4px 12px 10px', fontFeatureSettings: '"ss03"' }}>
            Core Operations
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Link to="/admin/overview" onClick={() => setSidebarOpen(false)} style={getLinkStyle(isActive('/admin/overview'))}>
              <GridIcon />
              <span>Platform Health</span>
            </Link>
            <Link to="/admin/users" onClick={() => setSidebarOpen(false)} style={getLinkStyle(isActive('/admin/users'))}>
              <UsersIcon />
              <span>User Directory</span>
            </Link>
            <Link to="/admin/moderation" onClick={() => setSidebarOpen(false)} style={getLinkStyle(isActive('/admin/moderation'))}>
              <ShieldIcon />
              <span>Moderation</span>
            </Link>
          </div>
        </nav>
        
        {/* Footer Logout */}
        <div style={{ padding: '16px 16px 24px', borderTop: '1px solid #1e2c31' }}>
          <button 
            onClick={onLogout}
            style={{
              width: '100%',
              padding: '10px 16px',
              borderRadius: 9999,
              background: 'transparent',
              border: '1px solid #1e2c31',
              color: '#fee2e2',
              fontSize: 13,
              fontWeight: 420,
              cursor: 'pointer',
              transition: 'all 0.18s',
              fontFamily: "'Inter', Helvetica, Arial, sans-serif",
              fontFeatureSettings: '"ss03"',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(254,226,226,0.1)'; e.currentTarget.style.borderColor = 'rgba(254,226,226,0.3)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#1e2c31'; }}
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '36px 40px', overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}

function getLinkStyle(active) {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '9px 14px',
    fontSize: 14,
    fontWeight: active ? 500 : 420,
    textDecoration: 'none',
    transition: 'all 0.15s ease',
    borderRadius: 9999,
    background: active ? '#ffffff' : 'transparent',
    color: active ? '#000000' : 'rgba(255,255,255,0.7)',
    fontFamily: "'Inter', Helvetica, Arial, sans-serif",
    fontFeatureSettings: '"ss03"',
  };
}

function GridIcon()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>; }
function UsersIcon()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function ShieldIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>; }
