import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles, 
  Boxes, 
  ArrowRight,
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
    <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff' }}>
            Inventory Velocity & Runway
          </h1>
          <p style={{ color: 'var(--color-tide-pool)', fontSize: '0.875rem', marginTop: '4px' }}>
            Predictive stock burn-rate monitoring and autonomous replenishment drafting
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link 
            to="/seller/approvals" 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '9999px',
              backgroundColor: 'var(--color-forest-floor)',
              border: '1px solid var(--color-iron-veil)',
              color: 'var(--color-tide-pool)',
              fontSize: '13px',
              textDecoration: 'none'
            }}
          >
            <span>Approval Queue</span>
            <ArrowRight size={14} />
          </Link>
          <button
            onClick={handleGenerateAdvisories}
            disabled={generating}
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '8px 20px',
              borderRadius: '9999px',
              backgroundColor: '#ffffff',
              color: '#02090a',
              fontSize: '13px',
              fontWeight: 600,
              border: 'none',
              cursor: generating ? 'not-allowed' : 'pointer'
            }}
          >
            <Sparkles size={15} />
            <span>{generating ? 'Agent Analyzing...' : 'Run Restock Agent'}</span>
          </button>
        </div>
      </div>

      {actionMsg.text && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: actionMsg.type === 'success' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${actionMsg.type === 'success' ? 'rgba(56, 189, 248, 0.3)' : 'var(--color-status-cancelled)'}`,
          color: actionMsg.type === 'success' ? 'var(--color-icy-steel)' : '#fca5a5',
          fontSize: '0.875rem'
        }}>
          {actionMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{actionMsg.text}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="metrics-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card" style={{ backgroundColor: 'var(--color-gunmetal-dark)', border: '1px solid var(--color-border-steel)' }}>
          <span className="stat-card-label" style={{ color: 'var(--color-slate-caption)' }}>Tracked SKUs</span>
          <span className="stat-card-value" style={{ color: '#ffffff', fontWeight: 330 }}>{items.length}</span>
          <span className="stat-card-meta" style={{ color: 'var(--color-steel-mist)' }}>
            <Boxes size={13} color="var(--color-icy-steel)" />
            Continuous catalog stock sync
          </span>
        </div>

        <div className="stat-card" style={{ backgroundColor: 'var(--color-gunmetal-dark)', border: '1px solid var(--color-border-steel)' }}>
          <span className="stat-card-label" style={{ color: 'var(--color-ash-label)' }}>Low Runway SKUs</span>
          <span className="stat-card-value" style={{ color: lowStockItems.length > 0 ? '#facc15' : '#ffffff', fontWeight: 330 }}>
            {lowStockItems.length}
          </span>
          <span className="stat-card-meta" style={{ color: 'var(--color-tide-pool)' }}>
            <Clock size={13} color="#facc15" />
            Stock &lt; 10 units buffer threshold
          </span>
        </div>

        <div className="stat-card" style={{ backgroundColor: 'var(--color-forest-floor)', border: '1px solid var(--color-iron-veil)' }}>
          <span className="stat-card-label" style={{ color: 'var(--color-ash-label)' }}>Critical Stockout Alert</span>
          <span className="stat-card-value" style={{ color: criticalItems.length > 0 ? '#f87171' : '#ffffff', fontWeight: 330 }}>
            {criticalItems.length}
          </span>
          <span className="stat-card-meta" style={{ color: 'var(--color-tide-pool)' }}>
            <AlertTriangle size={13} color="#f87171" />
            Immediate reorder advisory
          </span>
        </div>
      </div>

      {/* Inventory Velocity Table */}
      {loading ? (
        <div className="table-card" style={{ padding: '24px', backgroundColor: 'var(--color-forest-floor)', border: '1px solid var(--color-iron-veil)' }}>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} style={{ height: '56px', marginBottom: '12px' }} className="skeleton" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="table-card" style={{ textAlign: 'center', padding: '60px 24px', backgroundColor: 'var(--color-forest-floor)', border: '1px solid var(--color-iron-veil)' }}>
          <TrendingUp size={40} color="var(--color-ash-label)" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff' }}>
            No velocity metrics available
          </h3>
          <p style={{ color: 'var(--color-tide-pool)', fontSize: '0.875rem' }}>
            Active listings will record velocity data upon shopper transaction completion.
          </p>
        </div>
      ) : (
        <div className="table-card table-responsive" style={{ backgroundColor: 'var(--color-forest-floor)', border: '1px solid var(--color-iron-veil)' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Listing SKU</th>
                <th>Available Units</th>
                <th>Daily Velocity</th>
                <th>Runway (Days)</th>
                <th>Health Status</th>
                <th>Action</th>
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
                      <Link to={`/products/${item.id}`} target="_blank" style={{ fontWeight: 500, fontSize: '0.875rem', color: '#ffffff', textDecoration: 'none' }}>
                        {item.title}
                      </Link>
                      <div style={{ fontSize: '11px', color: 'var(--color-ash-label)', marginTop: '2px' }}>
                        SKU: {item.sku || item.id.slice(0, 8)}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem', color: stock <= 5 ? '#f87171' : '#ffffff' }}>
                        {stock} units
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--color-tide-pool)' }}>
                        ~{velocity} / day
                      </span>
                    </td>
                    <td>
                      <span style={{
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: isCritical ? '#f87171' : isWarning ? '#facc15' : 'var(--color-icy-steel)'
                      }}>
                        {runway} days
                      </span>
                    </td>
                    <td>
                      {isCritical ? (
                        <span className="status-pill status-cancelled">Critical Stockout</span>
                      ) : isWarning ? (
                        <span className="status-pill status-draft">Order Advisory</span>
                      ) : (
                        <span className="status-pill status-active">Optimal Runway</span>
                      )}
                    </td>
                    <td>
                      <Link
                        to={`/seller/products/${item.id}/edit`}
                        style={{
                          padding: '5px 12px',
                          fontSize: '12px',
                          color: '#ffffff',
                          backgroundColor: 'var(--color-deep-canopy)',
                          border: '1px solid var(--color-iron-veil)',
                          borderRadius: '6px',
                          textDecoration: 'none'
                        }}
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
