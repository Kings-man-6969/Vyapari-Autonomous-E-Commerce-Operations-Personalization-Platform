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
  Star,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const SellerLayout = ({ children }) => {
  const { user } = useAuth();
  const sellerStatus = user?.seller_status || (user?.role === 'seller' ? 'active' : 'pending_kyc');

  const navItems = [
    { to: '/seller/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/seller/products', label: 'My Catalog', icon: Boxes },
    { to: '/seller/products/new', label: 'Add Product', icon: PlusCircle },
    { to: '/seller/orders', label: 'Orders to Fulfill', icon: Package },
    { to: '/seller/reviews', label: 'Customer Reviews', icon: Star },
    { to: '/seller/inventory', label: 'Inventory Velocity', icon: TrendingUp },
    { to: '/seller/ai/listing', label: 'AI Listing Studio', icon: Sparkles },
    { to: '/seller/ai', label: 'AI Operations Chat', icon: MessageSquare },
    { to: '/seller/approvals', label: 'Approval Queue', icon: FileCheck2 },
    { to: '/seller/settings', label: 'Store Settings', icon: Settings },
  ];

  return (
    <div className="console-container">
      {/* Persistent Dark Seller Sidebar */}
      <aside className="console-sidebar">
        <div className="console-sidebar-header">
          <span className="console-sidebar-title">Merchant Operations</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              backgroundColor: 'var(--color-gunmetal-dark)',
              border: '1px solid var(--color-border-steel)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-icy-steel)'
            }}>
              <Store size={15} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.store_name || user?.name || 'Seller Store'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                {sellerStatus === 'active' ? (
                  <span style={{ fontSize: '10px', color: 'var(--color-icy-steel)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <ShieldCheck size={11} /> Verified Active
                  </span>
                ) : (
                  <span style={{ fontSize: '10px', color: 'var(--color-warning)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <ShieldAlert size={11} /> KYC Pending
                  </span>
                )}
              </div>
            </div>
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
                <Icon size={17} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--color-iron-veil)' }}>
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
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--color-tide-pool)',
              backgroundColor: 'var(--color-forest-floor)',
              border: '1px solid var(--color-iron-veil)'
            }}
          >
            <span>Public Storefront</span>
            <ArrowUpRight size={14} color="var(--color-ash-label)" />
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
