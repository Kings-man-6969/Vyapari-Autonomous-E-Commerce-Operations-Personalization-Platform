import React from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  Users, 
  FileCheck2, 
  Boxes, 
  FolderTree, 
  Cpu, 
  LayoutDashboard,
  ExternalLink
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
          <span className="console-sidebar-title">Governance Desk</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
            <ShieldCheck size={16} color="#6366F1" />
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Super Admin Console
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
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--color-border-card)' }}>
          <div style={{ padding: '8px 12px', background: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-sm)', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            Admin: <strong>{user?.name}</strong>
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
