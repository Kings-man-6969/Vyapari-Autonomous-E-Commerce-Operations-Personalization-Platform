import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles, 
  Boxes, 
  ArrowRight,
  RefreshCw,
  Clock
} from 'lucide-react';
import api from '../services/api';

export const SellerInventoryPage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [actionMsg, setActionMsg] = useState({ type: '', text: '' });

  const fetchVelocity = async () => {
    try {
      setLoading(true);
      const res = await api.get('/seller/inventory/velocity');
      if (res.data?.success) {
        setItems(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load inventory velocity:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVelocity();
  }, []);

  const handleGenerateAdvisories = async () => {
    try {
      setGenerating(true);
      const res = await api.post('/seller/inventory/advisory');
      if (res.data?.success) {
        setActionMsg({
          type: 'success',
          text: `Generated ${res.data.data.created_count || 1} restock advisories in your AI Approval Queue.`
        });
      }
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to trigger stock velocity agent.'
      });
    } finally {
      setGenerating(false);
    }
  };

  const lowStockItems = items.filter((i) => i.inventory_count <= 10);
  const criticalItems = items.filter((i) => i.inventory_count <= 3);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            Inventory Velocity & Forecasting
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
            Autonomous predictive analysis of sales velocity and stock depletion risks
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link to="/seller/approvals" className="btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span>View Approval Queue</span>
            <ArrowRight size={14} />
          </Link>
          <button
            onClick={handleGenerateAdvisories}
            className="btn-primary"
            disabled={generating}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Sparkles size={16} />
            <span>{generating ? 'Agent Analyzing...' : 'Run Restock Agent'}</span>
          </button>
        </div>
      </div>

      {actionMsg.text && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: actionMsg.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
          color: actionMsg.type === 'success' ? 'var(--color-success)' : 'var(--color-error)',
          fontSize: 'var(--font-size-sm)'
        }}>
          {actionMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{actionMsg.text}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="metrics-grid">
        <div className="stat-card">
          <span className="stat-card-label">Active SKUs Tracked</span>
          <span className="stat-card-value">{items.length}</span>
          <span className="stat-card-meta">
            <Boxes size={14} color="var(--color-secondary)" />
            Real-time catalog stock sync
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-card-label">Depletion Risk SKUs</span>
          <span className="stat-card-value" style={{ color: lowStockItems.length > 0 ? 'var(--color-warning)' : 'inherit' }}>
            {lowStockItems.length}
          </span>
          <span className="stat-card-meta">
            <Clock size={14} color="var(--color-warning)" />
            Stock &lt; 10 units remaining
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-card-label">Critical Stockout Warnings</span>
          <span className="stat-card-value" style={{ color: criticalItems.length > 0 ? 'var(--color-error)' : 'inherit' }}>
            {criticalItems.length}
          </span>
          <span className="stat-card-meta">
            <AlertTriangle size={14} color="var(--color-error)" />
            Immediate replenishment needed
          </span>
        </div>
      </div>

      {/* Inventory Velocity Table */}
      {loading ? (
        <div className="table-card" style={{ padding: '24px' }}>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} style={{ height: '56px', marginBottom: '12px' }} className="skeleton" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="table-card" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <TrendingUp size={40} color="var(--color-text-muted)" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>No catalog inventory data</h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            Publish products to begin tracking predictive velocity.
          </p>
        </div>
      ) : (
        <div className="table-card table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Current Stock</th>
                <th>Daily Velocity</th>
                <th>Runway (Days)</th>
                <th>Advisory Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const stock = item.inventory_count;
                const velocity = parseFloat(item.daily_sales_velocity || 1.2).toFixed(1);
                const runway = Math.floor(stock / Math.max(parseFloat(velocity), 0.1));
                const isCritical = runway <= 5;
                const isWarning = runway <= 14;

                return (
                  <tr key={item.id}>
                    <td>
                      <Link to={`/products/${item.id}`} target="_blank" style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                        {item.title}
                      </Link>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        SKU: {item.sku || item.id.slice(0, 8)}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: stock <= 5 ? 'var(--color-error)' : 'inherit' }}>
                        {stock} units
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                        ~{velocity} / day
                      </span>
                    </td>
                    <td>
                      <span style={{
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 600,
                        color: isCritical ? 'var(--color-error)' : isWarning ? 'var(--color-warning)' : 'var(--color-success)'
                      }}>
                        {runway} days
                      </span>
                    </td>
                    <td>
                      {isCritical ? (
                        <span className="status-pill status-pill-out_of_stock">Critical Reorder</span>
                      ) : isWarning ? (
                        <span className="status-pill status-pill-draft">Order Soon</span>
                      ) : (
                        <span className="status-pill status-pill-active">Stock Healthy</span>
                      )}
                    </td>
                    <td>
                      <Link
                        to={`/seller/products/${item.id}/edit`}
                        className="btn-outline"
                        style={{ padding: '6px 12px', fontSize: 'var(--font-size-xs)' }}
                      >
                        Adjust Stock
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SellerInventoryPage;
