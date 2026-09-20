import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  DollarSign, 
  Package, 
  ShoppingBag, 
  Sparkles, 
  AlertTriangle, 
  Bot, 
  ChevronRight,
  TrendingUp,
  Plus
} from 'lucide-react';
import api from '../services/api';

export const SellerDashboardPage = () => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.get('/seller/dashboard');
      if (res.data?.success) {
        setDashboard(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load seller dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await api.put(`/seller/orders/${orderId}/status`, { status: newStatus });
      await fetchDashboard();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to update status');
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '48px 24px' }}>
        <div style={{ height: '240px', marginBottom: '24px' }} className="skeleton" />
      </div>
    );
  }

  const stats = dashboard?.stats || { total_revenue: 0, total_orders: 0, active_products: 0, pending_approvals: 0 };
  const recentOrders = dashboard?.recent_orders || [];
  const lowStock = dashboard?.low_stock_alerts || [];

  return (
    <div className="container" style={{ padding: '40px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800 }}>
            Seller Merchant Console
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            Monitor real-time sales, fulfill shipments, and govern Team B autonomous agent drafts.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <Link to="/seller/approvals" className="btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bot size={18} color="var(--color-secondary)" />
            Approval Queue ({stats.pending_approvals})
          </Link>
          <Link to="/seller/ai/listing" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} />
            Generate Listing with AI
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '36px' }}>
        <div style={{ padding: '24px', backgroundColor: '#ffffff', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-card)', boxShadow: 'var(--shadow-xs)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '8px' }}>
            <span>TOTAL REVENUE</span>
            <DollarSign size={16} color="var(--color-success)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            ₹{stats.total_revenue.toLocaleString('en-IN')}
          </div>
        </div>

        <div style={{ padding: '24px', backgroundColor: '#ffffff', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-card)', boxShadow: 'var(--shadow-xs)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '8px' }}>
            <span>FULFILLED ORDERS</span>
            <Package size={16} color="var(--color-primary)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            {stats.total_orders}
          </div>
        </div>

        <div style={{ padding: '24px', backgroundColor: '#ffffff', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-card)', boxShadow: 'var(--shadow-xs)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '8px' }}>
            <span>ACTIVE PRODUCTS</span>
            <ShoppingBag size={16} color="var(--color-secondary)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            {stats.active_products}
          </div>
        </div>

        <div style={{ padding: '24px', backgroundColor: 'var(--color-primary-light)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-primary)', boxShadow: 'var(--shadow-xs)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-primary)', fontSize: 'var(--font-size-xs)', fontWeight: 700, marginBottom: '8px' }}>
            <span>AGENT APPROVALS</span>
            <Bot size={16} color="var(--color-primary)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-primary)' }}>
            {stats.pending_approvals} Pending
          </div>
        </div>
      </div>

      {/* Grid: Low Stock Alert & Orders */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '32px' }}>
        {/* Recent Orders with Quick Fulfillment Action */}
        <div style={{ backgroundColor: '#ffffff', padding: '28px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-card)' }}>
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: '16px' }}>
            Recent Customer Orders
          </h3>

          {recentOrders.length === 0 ? (
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>No orders placed yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {recentOrders.map((o) => (
                <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--color-border-card)' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
                      #{o.id.slice(0, 8).toUpperCase()} • ₹{parseFloat(o.total_amount).toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                      Customer: {o.customer_name} • Status: <strong style={{ textTransform: 'capitalize' }}>{o.status}</strong>
                    </div>
                  </div>

                  {o.status === 'paid' && (
                    <button
                      onClick={() => handleUpdateStatus(o.id, 'processing')}
                      className="btn-outline"
                      style={{ fontSize: '11px', padding: '6px 10px' }}
                    >
                      Pack Order
                    </button>
                  )}
                  {o.status === 'processing' && (
                    <button
                      onClick={() => handleUpdateStatus(o.id, 'shipped')}
                      className="btn-primary"
                      style={{ fontSize: '11px', padding: '6px 10px' }}
                    >
                      Ship Out
                    </button>
                  )}
                  {o.status === 'shipped' && (
                    <button
                      onClick={() => handleUpdateStatus(o.id, 'delivered')}
                      className="btn-outline"
                      style={{ fontSize: '11px', padding: '6px 10px', color: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                    >
                      Mark Delivered
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Advisor Card */}
        <div style={{ backgroundColor: '#ffffff', padding: '28px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <AlertTriangle size={20} color="var(--color-warning)" />
            <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>
              Inventory Stock Warnings
            </h3>
          </div>

          {lowStock.length === 0 ? (
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              All product lines have healthy stock coverage.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {lowStock.map((p) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: 'var(--color-warning-bg)', borderRadius: 'var(--radius-sm)' }}>
                  <div>
                    <h5 style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{p.title}</h5>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-warning)', fontWeight: 700 }}>
                      Only {p.stock_qty} units left in stock
                    </span>
                  </div>
                  <Link to="/seller/approvals" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-primary)', textDecoration: 'underline' }}>
                    View Advisory
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
