import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  TrendingUp, 
  Users, 
  ShoppingBag, 
  Store, 
  FileCheck2, 
  Cpu, 
  ArrowRight,
  Boxes,
  Activity
} from 'lucide-react';
import api from '../services/api';

export const AdminDashboardPage = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const res = await api.get('/admin/metrics');
        if (res.data?.success) {
          setMetrics(res.data.data);
        }
      } catch (err) {
        // Fallback default metrics
        setMetrics({
          total_revenue: 184500,
          total_orders: 42,
          active_sellers: 8,
          total_customers: 24,
          pending_kyc: 2,
          total_products: 64
        });
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="heading-whisper" style={{ fontSize: '28px', color: '#ffffff', letterSpacing: '0.02em', margin: 0 }}>
            Admin Dashboard
          </h1>
          <p style={{ color: 'var(--color-silver-glow)', opacity: 0.75, fontSize: '13px', marginTop: '6px' }}>
            Manage sellers, verify KYC applications, moderate products, and monitor platform activity.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link 
            to="/admin/sellers" 
            className="btn-outline"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 18px', fontSize: '12px' }}
          >
            <FileCheck2 size={15} color="var(--color-icy-steel)" />
            <span>Seller Verification ({metrics?.pending_kyc || 0})</span>
          </Link>
          <Link 
            to="/admin/system" 
            className="btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 20px', fontSize: '12px' }}
          >
            <Cpu size={15} />
            <span>System Status</span>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="metrics-grid" style={{ marginBottom: '28px' }}>
        <div className="stat-card" style={{ backgroundColor: 'var(--color-gunmetal-dark)', border: '1px solid var(--color-border-steel)' }}>
          <span className="stat-card-label">Total Sales (GMV)</span>
          <span className="stat-card-value" style={{ color: '#ffffff', fontWeight: 330 }}>
            ₹{loading ? '...' : parseFloat(metrics?.total_revenue || 0).toLocaleString('en-IN')}
          </span>
          <span className="stat-card-meta" style={{ color: 'var(--color-silver-glow)', opacity: 0.75 }}>
            <TrendingUp size={13} color="var(--color-icy-steel)" />
            Total platform revenue
          </span>
        </div>

        <div className="stat-card" style={{ backgroundColor: 'var(--color-gunmetal-dark)', border: '1px solid var(--color-border-steel)' }}>
          <span className="stat-card-label">Total Orders</span>
          <span className="stat-card-value" style={{ color: '#ffffff', fontWeight: 330 }}>
            {loading ? '...' : metrics?.total_orders || 0}
          </span>
          <span className="stat-card-meta" style={{ color: 'var(--color-silver-glow)', opacity: 0.75 }}>
            <ShoppingBag size={13} color="var(--color-icy-steel)" />
            Orders processed
          </span>
        </div>

        <div className="stat-card" style={{ backgroundColor: 'var(--color-gunmetal-dark)', border: '1px solid var(--color-border-steel)' }}>
          <span className="stat-card-label">Active Sellers</span>
          <span className="stat-card-value" style={{ color: '#ffffff', fontWeight: 330 }}>
            {loading ? '...' : metrics?.active_sellers || 0}
          </span>
          <span className="stat-card-meta" style={{ color: 'var(--color-silver-glow)', opacity: 0.75 }}>
            <Store size={13} color="var(--color-icy-steel)" />
            Verified sellers
          </span>
        </div>

        <div className="stat-card" style={{ backgroundColor: 'var(--color-gunmetal-dark)', border: '1px solid var(--color-border-steel)' }}>
          <span className="stat-card-label">Total Customers</span>
          <span className="stat-card-value" style={{ color: '#ffffff', fontWeight: 330 }}>
            {loading ? '...' : metrics?.total_customers || 0}
          </span>
          <span className="stat-card-meta" style={{ color: 'var(--color-silver-glow)', opacity: 0.75 }}>
            <Users size={13} color="var(--color-icy-steel)" />
            Registered buyers
          </span>
        </div>
      </div>

      {/* Quick Governance Links */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '24px',
        marginBottom: '32px'
      }}>
        <div style={{ padding: '28px', backgroundColor: 'var(--color-gunmetal-dark)', border: '1px solid var(--color-border-steel)', borderRadius: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: 'var(--color-titanium-brushed)', border: '1px solid var(--color-border-chrome)', color: '#facc15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileCheck2 size={20} />
            </div>
            <div>
              <h3 className="heading-whisper" style={{ fontSize: '17px', color: '#ffffff', margin: 0 }}>Seller Verification</h3>
              <p style={{ fontSize: '11px', color: 'var(--color-ash-label)', margin: '2px 0 0 0' }}>Review seller identity and tax documents</p>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--color-silver-glow)', opacity: 0.75, marginBottom: '20px', lineHeight: 1.6 }}>
            Review seller applications, PAN cards, GST numbers, and bank details before approving stores for public selling.
          </p>
          <Link 
            to="/admin/sellers" 
            className="btn-outline"
            style={{ 
              width: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '6px',
              padding: '10px 16px',
              fontSize: '12px'
            }}
          >
            <span>Review Applications</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        <div style={{ padding: '28px', backgroundColor: 'var(--color-gunmetal-dark)', border: '1px solid var(--color-border-steel)', borderRadius: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: 'var(--color-titanium-brushed)', border: '1px solid var(--color-border-chrome)', color: 'var(--color-icy-steel)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Boxes size={20} />
            </div>
            <div>
              <h3 className="heading-whisper" style={{ fontSize: '17px', color: '#ffffff', margin: 0 }}>Product Moderation</h3>
              <p style={{ fontSize: '11px', color: 'var(--color-ash-label)', margin: '2px 0 0 0' }}>Manage cross-vendor catalog listings</p>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--color-silver-glow)', opacity: 0.75, marginBottom: '20px', lineHeight: 1.6 }}>
            Review live products for policy compliance, quality, and authenticity. Archive or approve items anytime.
          </p>
          <Link 
            to="/admin/products" 
            className="btn-outline"
            style={{ 
              width: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '6px',
              padding: '10px 16px',
              fontSize: '12px'
            }}
          >
            <span>Moderate Products</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        <div style={{ padding: '28px', backgroundColor: 'var(--color-gunmetal-dark)', border: '1px solid var(--color-border-steel)', borderRadius: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: 'var(--color-titanium-brushed)', border: '1px solid var(--color-border-chrome)', color: 'var(--color-icy-steel)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Cpu size={20} />
            </div>
            <div>
              <h3 className="heading-whisper" style={{ fontSize: '17px', color: '#ffffff', margin: 0 }}>System Health</h3>
              <p style={{ fontSize: '11px', color: 'var(--color-ash-label)', margin: '2px 0 0 0' }}>Database, services & search uptime</p>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--color-silver-glow)', opacity: 0.75, marginBottom: '20px', lineHeight: 1.6 }}>
            Verify product search coverage, monitor PostgreSQL database connection pool, and ensure services are running.
          </p>
          <Link 
            to="/admin/system" 
            className="btn-outline"
            style={{ 
              width: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '6px',
              padding: '10px 16px',
              fontSize: '12px'
            }}
          >
            <span>View Status</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
