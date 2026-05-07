import React, { useState } from 'react'
import { Outlet, Navigate, Link, useLocation } from 'react-router-dom'


export default function AdminLayout({ token, role, onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  if (!token || role !== 'admin') {
    return <Navigate to="/" replace />
  }

  function isActive(path) {
    return location.pathname.startsWith(path)
  }

  return (
    <div className="app-container admin-theme">
      {/* Mobile Header */}
      <header className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="icon-btn" onClick={() => setSidebarOpen(true)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div style={{ fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>Admin Overlord</div>
        </div>
      </header>

      {/* Sidebar Overlay */}
      <div className={`sidebar-overlay${sidebarOpen ? ' visible' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* Sidebar */}
      <aside className={`app-sidebar${sidebarOpen ? ' open' : ''}`}>
        <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid var(--color-border)', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0, boxShadow: '0 0 16px rgba(225,29,72,.4)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.287 1.288L3 12l5.8 1.9a2 2 0 0 1 1.288 1.287L12 21l1.9-5.8a2 2 0 0 1 1.287-1.288L21 12l-5.8-1.9a2 2 0 0 1-1.288-1.287Z"/></svg>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 'var(--fs-md)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>Vyapari</div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-faint)', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>Admin Overlord</div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '8px 10px' }}>
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-faint)', letterSpacing: '.1em', textTransform: 'uppercase', padding: '4px 8px 10px', fontFamily: 'var(--font-mono)' }}>Core</div>
            <Link to="/admin/overview" onClick={() => setSidebarOpen(false)} style={getLinkStyle(isActive('/admin/overview'))}>
              <GridIcon /> Platform Health
            </Link>
            <Link to="/admin/users" onClick={() => setSidebarOpen(false)} style={getLinkStyle(isActive('/admin/users'))}>
              <UsersIcon /> User Management
            </Link>
            <Link to="/admin/moderation" onClick={() => setSidebarOpen(false)} style={getLinkStyle(isActive('/admin/moderation'))}>
              <ShieldIcon /> Moderation
            </Link>
          </div>
        </nav>
        
        <div style={{ padding: '12px 18px 16px', borderTop: '1px solid var(--color-border)' }}>
          <button 
            onClick={onLogout}
            className="btn btn-secondary btn-sm"
            style={{ width: '100%', borderColor: 'rgba(244,63,94,.3)', color: '#fb7185' }}
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="app-main">
        <div className="main-content">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

function getLinkStyle(active) {
  return {
    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
    fontSize: 'var(--fs-sm)', fontWeight: active ? 600 : 500,
    textDecoration: 'none', transition: 'all 150ms ease', marginBottom: 2,
    borderRadius: 'var(--r-md)',
    background: active ? 'rgba(225,29,72,.12)' : 'transparent',
    color: active ? '#fb7185' : 'var(--color-text-muted)',
    borderLeft: active ? '2px solid #e11d48' : '2px solid transparent',
    fontFamily: 'var(--font-display)',
  }
}

function GridIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> }
function UsersIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> }
function ShieldIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> }
