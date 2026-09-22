import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { 
  ShieldCheck, 
  Users, 
  FileCheck2, 
  Boxes, 
  FolderTree, 
  Cpu, 
  LayoutDashboard
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AdminLayout = ({ children }) => {
  const { user } = useAuth();

  const navItems = [
    { to: '/admin', label: 'Platform Overview', icon: LayoutDashboard },
    { to: '/admin/users', label: 'User Governance', icon: Users },
    { to: '/admin/sellers', label: 'Seller KYC Desk', icon: FileCheck2 },
    { to: '/admin/products', label: 'Catalog Moderation', icon: Boxes },
    { to: '/admin/categories', label: 'Category Hierarchy', icon: FolderTree },
    { to: '/admin/system', label: 'System & AI Health', icon: Cpu },
  ];

  return (
    <div className="console-container">
      {/* Persistent Admin Sidebar */}
      <aside className="console-sidebar">
        <div className="console-sidebar-header">
          <span className="console-sidebar-title">Platform Governance</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              backgroundColor: 'var(--color-forest-floor)',
              border: '1px solid var(--color-iron-veil)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-cyan-pulse)'
            }}>
              <ShieldCheck size={16} />
            </div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
              Super Admin Desk
            </span>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
                end={item.to === '/admin'}
              >
                <Icon size={17} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--color-iron-veil)' }}>
          <div style={{ padding: '8px 12px', background: 'var(--color-forest-floor)', borderRadius: '6px', border: '1px solid var(--color-iron-veil)', fontSize: '11px', color: 'var(--color-tide-pool)' }}>
            Admin: <strong style={{ color: '#ffffff' }}>{user?.name || 'Administrator'}</strong>
          </div>
        </div>
      </aside>

      {/* Main Console Content Area */}
      <main className="console-content">
        {children || <Outlet />}
      </main>
    </div>
  );
};

export default AdminLayout;
