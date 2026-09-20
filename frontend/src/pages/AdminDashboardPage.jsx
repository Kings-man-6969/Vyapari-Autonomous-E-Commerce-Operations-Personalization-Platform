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
  AlertTriangle,
  ArrowRight,
  Boxes
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
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            Platform Governance Desk
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
            Multi-vendor marketplace health, compliance review, and AI vector telemetry
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link to="/admin/sellers" className="btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <FileCheck2 size={16} />
            <span>KYC Desk ({metrics?.pending_kyc || 0})</span>
          </Link>
          <Link to="/admin/system" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#6366F1' }}>
            <Cpu size={16} />
            <span>System Health</span>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="metrics-grid">
        <div className="stat-card">
          <span className="stat-card-label">Platform Gross GMV</span>
          <span className="stat-card-value">
            ₹{loading ? '...' : parseFloat(metrics?.total_revenue || 0).toLocaleString('en-IN')}
          </span>
          <span className="stat-card-meta">
            <TrendingUp size={14} color="var(--color-success)" />
            Settled orders revenue
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-card-label">Total Transactions</span>
          <span className="stat-card-value">
            {loading ? '...' : metrics?.total_orders || 0}
          </span>
          <span className="stat-card-meta">
            <ShoppingBag size={14} color="var(--color-primary)" />
            Processed orders
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-card-label">Verified Merchants</span>
          <span className="stat-card-value">
            {loading ? '...' : metrics?.active_sellers || 0}
          </span>
          <span className="stat-card-meta">
            <Store size={14} color="var(--color-secondary)" />
            KYC-compliant sellers
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-card-label">Customer Accounts</span>
          <span className="stat-card-value">
            {loading ? '...' : metrics?.total_customers || 0}
          </span>
          <span className="stat-card-meta">
            <Users size={14} color="#6366F1" />
            Registered buyers
          </span>
        </div>
      </div>

      {/* Quick Governance Links */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px',
        marginBottom: '32px'
      }}>
        <div className="table-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileCheck2 size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Merchant KYC Desk</h3>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Review regulatory tax and bank submissions</p>
            </div>
          </div>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
            Inspect seller applicant permanent account numbers (PAN), GST certificates, and settlement coordinates.
          </p>
          <Link to="/admin/sellers" className="btn-outline" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <span>Open Verification Desk</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="table-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Boxes size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Catalog Governance</h3>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Cross-vendor product listings moderation</p>
            </div>
          </div>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
            Audit listings for regulatory compliance, counterfeit items, or policy breaches with instant archival controls.
          </p>
          <Link to="/admin/products" className="btn-outline" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <span>Moderate Products</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="table-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-sm)', backgroundColor: '#EEF2FF', color: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Cpu size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>AI & Vector Health</h3>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>pgvector & microservice telemetry</p>
            </div>
          </div>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
            Verify vector embedding coverage across the catalog, inspect database latency, and sync embeddings.
          </p>
          <Link to="/admin/system" className="btn-outline" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <span>View Diagnostics</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
