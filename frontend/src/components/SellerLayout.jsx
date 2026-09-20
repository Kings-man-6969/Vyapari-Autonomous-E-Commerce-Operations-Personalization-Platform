import React from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Boxes, 
  PlusCircle, 
  Package, 
  TrendingUp, 
  Sparkles, 
  MessageSquare, 
  FileCheck2, 
  Settings, 
  Store,
  ArrowUpRight,
  Star
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const SellerLayout = ({ children }) => {
  const { user } = useAuth();

  const navItems = [
    { to: '/seller/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/seller/products', label: 'My Catalog', icon: Boxes },
    { to: '/seller/products/new', label: 'Add Product', icon: PlusCircle },
    { to: '/seller/orders', label: 'Orders to Fulfill', icon: Package },
    { to: '/seller/reviews', label: 'Customer Reviews', icon: Star },
    { to: '/seller/inventory', label: 'Inventory Velocity', icon: TrendingUp },
    { to: '/seller/ai/listing', label: 'AI Listing Studio', icon: Sparkles },
    { to: '/seller/ai/chat', label: 'AI Operations Chat', icon: MessageSquare },
    { to: '/seller/approvals', label: 'Approval Queue', icon: FileCheck2 },
    { to: '/seller/settings', label: 'Store Settings', icon: Settings },
  ];

  return (
    <div className="console-container">
      {/* Persistent Seller Sidebar */}
      <aside className="console-sidebar">
        <div className="console-sidebar-header">
          <span className="console-sidebar-title">Merchant Operations</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
            <Store size={16} color="var(--color-secondary)" />
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.store_name || user?.name || 'Seller Store'}
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
                end={item.to === '/seller/dashboard'}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--color-border-card)' }}>
          <Link
            to={user?.seller_id ? `/stores/${user.seller_id}` : '/explore'}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              backgroundColor: 'var(--color-surface-subtle)'
            }}
          >
            <span>View Public Storefront</span>
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </aside>

      {/* Main Console Content Area */}
      <main className="console-content">
        {children || <Outlet />}
      </main>
    </div>
  );
};

export default SellerLayout;
