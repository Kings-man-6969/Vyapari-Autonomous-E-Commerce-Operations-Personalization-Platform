import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  DollarSign, 
  Package, 
  TrendingUp, 
  Bot, 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  ShieldAlert, 
  ShoppingBag,
  Zap,
  Activity
} from 'lucide-react';
import api from '../services/api';

export const SellerDashboardPage = () => {
  const [dashboard, setDashboard] = useState(null);
  const [sellerStatus, setSellerStatus] = useState('active');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const [dashRes, profileRes] = await Promise.all([
          api.get('/seller/dashboard'),
          api.get('/seller/profile')
        ]);

        if (dashRes.data?.success) {
          setDashboard(dashRes.data.data);
        }
        if (profileRes.data?.success) {
          setSellerStatus(profileRes.data.data.seller?.status || 'active');
        }
      } catch (err) {
        console.error('Failed to load seller telemetry:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await api.patch(`/seller/orders/${orderId}/status`, { status: newStatus });
      const res = await api.get('/seller/dashboard');
      if (res.data?.success) {
        setDashboard(res.data.data);
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ height: '70px', backgroundColor: 'var(--color-gunmetal-dark)', borderRadius: '12px', border: '1px solid var(--color-border-steel)' }} className="skeleton" />
        <div className="metrics-grid">
          {[1, 2, 3, 4].map(n => (
            <div key={n} style={{ height: '110px', backgroundColor: 'var(--color-gunmetal-dark)', borderRadius: '12px', border: '1px solid var(--color-border-steel)' }} className="skeleton" />
          ))}
        </div>
      </div>
    );
  }

  const stats = dashboard?.stats || { total_revenue: 0, total_orders: 0, active_products: 0, pending_approvals: 0 };
  const recentOrders = dashboard?.recent_orders || [];
  const lowStock = dashboard?.low_stock_alerts || [];

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="heading-whisper" style={{ fontSize: '28px', color: '#ffffff', letterSpacing: '0.02em', margin: 0 }}>
            Seller Dashboard
          </h1>
          <p style={{ color: 'var(--color-silver-glow)', opacity: 0.75, fontSize: '13px', marginTop: '6px' }}>
            Monitor your sales, fulfill orders, and manage inventory and product listings.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <Link to="/seller/approvals" className="btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', padding: '8px 16px' }}>
            <Bot size={15} color="var(--color-icy-steel)" />
            Action Queue ({stats.pending_approvals})
          </Link>
          <Link to="/seller/ai/listing" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 20px', fontSize: '12px' }}>
            <Sparkles size={15} />
            AI Product Studio
          </Link>
        </div>
      </div>

      {/* KYC Status Resolution Banner */}
      {sellerStatus === 'pending_kyc' ? (
        <div style={{
          padding: '16px 20px',
          backgroundColor: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          borderRadius: '14px',
          marginBottom: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ShieldAlert size={20} color="var(--color-warning)" />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                Store Verification Pending (Admin KYC Desk)
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-silver-glow)', opacity: 0.75, marginTop: '2px' }}>
                You have full access to draft catalog items and run AI Studio forecasts. Live checkout unlocks upon verification.
              </div>
            </div>
          </div>
          <span className="badge badge-warning">pending_kyc</span>
        </div>
      ) : (
        <div style={{
          padding: '14px 20px',
          backgroundColor: 'var(--color-titanium-brushed)',
          border: '1px solid var(--color-border-steel)',
          borderRadius: '14px',
          marginBottom: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={18} color="var(--color-icy-steel)" />
            <span style={{ fontSize: '13px', fontWeight: 500, color: '#ffffff' }}>
              Seller Account Verified • Store is Active
            </span>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: 'var(--radius-pills)', backgroundColor: 'rgba(56, 189, 248, 0.12)', color: 'var(--color-icy-steel)', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
            <Activity size={12} />
            ACTIVE
          </span>
        </div>
      )}

      {/* KPI Stat Cards */}
      <div className="metrics-grid">
        <div className="stat-card" style={{ backgroundColor: 'var(--color-gunmetal-dark)', border: '1px solid var(--color-border-steel)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-card-label">Total Sales</span>
            <DollarSign size={16} color="var(--color-icy-steel)" />
          </div>
          <div className="stat-card-value">
            ₹{stats.total_revenue.toLocaleString('en-IN')}
          </div>
          <div className="stat-card-meta">
            <span>Lifetime revenue</span>
          </div>
        </div>

        <div className="stat-card" style={{ backgroundColor: 'var(--color-gunmetal-dark)', border: '1px solid var(--color-border-steel)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-card-label">Total Orders</span>
            <Package size={16} color="var(--color-silver-glow)" />
          </div>
          <div className="stat-card-value">
            {stats.total_orders}
          </div>
          <div className="stat-card-meta">
            <span>Orders received</span>
          </div>
        </div>

        <div className="stat-card" style={{ backgroundColor: 'var(--color-gunmetal-dark)', border: '1px solid var(--color-border-steel)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-card-label">Active Products</span>
            <ShoppingBag size={16} color="var(--color-silver-glow)" />
          </div>
          <div className="stat-card-value">
            {stats.active_products}
          </div>
          <div className="stat-card-meta">
            <span>Live in store</span>
          </div>
        </div>

        <div className="stat-card" style={{ backgroundColor: 'var(--color-gunmetal-dark)', border: '1px solid var(--color-border-steel)', borderLeft: '3px solid var(--color-icy-steel)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-card-label" style={{ color: 'var(--color-icy-steel)' }}>Pending Actions</span>
            <Bot size={16} color="var(--color-icy-steel)" />
          </div>
          <div className="stat-card-value" style={{ color: 'var(--color-icy-steel)' }}>
            {stats.pending_approvals}
          </div>
          <div className="stat-card-meta">
            <span>Awaiting your review</span>
          </div>
        </div>
      </div>

      {/* Grid: Low Stock Alert & Recent Orders */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '28px', marginTop: '28px' }}>
        {/* Recent Orders */}
        <div style={{ backgroundColor: 'var(--color-gunmetal-dark)', padding: '28px', borderRadius: '16px', border: '1px solid var(--color-border-steel)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 className="heading-whisper" style={{ fontSize: '18px', color: '#ffffff', margin: 0 }}>
              Recent Orders
            </h3>
            <Link to="/seller/orders" style={{ fontSize: '12px', color: 'var(--color-icy-steel)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              View All <ArrowRight size={13} />
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--color-silver-glow)', opacity: 0.75 }}>No orders placed yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {recentOrders.map((o) => (
                <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '14px', borderBottom: '1px solid var(--color-border-steel)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#ffffff' }}>
                      #{o.id.slice(0, 8).toUpperCase()} • ₹{parseFloat(o.total_amount).toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-silver-glow)', opacity: 0.75, marginTop: '2px' }}>
                      Customer: {o.customer_name} • State: <strong style={{ textTransform: 'capitalize', color: '#ffffff' }}>{o.status}</strong>
                    </div>
                  </div>

                  {o.status === 'paid' && (
                    <button
                      onClick={() => handleUpdateStatus(o.id, 'processing')}
                      className="btn-small"
                      style={{ backgroundColor: '#ffffff', color: '#090a0d', fontWeight: 600 }}
                    >
                      Acknowledge
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div style={{ backgroundColor: 'var(--color-gunmetal-dark)', padding: '28px', borderRadius: '16px', border: '1px solid var(--color-border-steel)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 className="heading-whisper" style={{ fontSize: '18px', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <TrendingUp size={18} color="var(--color-warning)" />
              <span>Low Stock Alerts</span>
            </h3>
            <Link to="/seller/inventory" style={{ fontSize: '12px', color: 'var(--color-icy-steel)' }}>
              Manage Inventory
            </Link>
          </div>

          {lowStock.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--color-silver-glow)', opacity: 0.75 }}>
              All products currently have healthy inventory levels.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {lowStock.map((prod) => (
                <div key={prod.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--color-border-steel)' }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '13px', color: '#ffffff' }}>
                      {prod.title}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-warning)', marginTop: '2px' }}>
                      Only {prod.inventory_count} left in stock
                    </div>
                  </div>
                  <Link
                    to={`/seller/products/${prod.id}/edit`}
                    className="btn-outline"
                    style={{ padding: '4px 10px', fontSize: '11px' }}
                  >
                    Restock
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SellerDashboardPage;
