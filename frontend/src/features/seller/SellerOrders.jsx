import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../shared/hooks/useToast';
import { SpinnerPage } from '../../shared/components/Spinner';

/* ─── DESIGN.MD — Seller Orders ───
   Canvas: #000000 · Container: #0a0a0a · Hairlines: #1e2c31
   Buttons: pill-only · Typography: Inter ss03
──────────────────────────────────── */

const STATUS_BADGES = {
  pending:    { bg: 'rgba(254,243,199,0.15)', color: '#fef3c7' },
  processing: { bg: 'rgba(219,234,254,0.15)', color: '#dbeafe' },
  shipped:    { bg: 'rgba(237,233,254,0.15)', color: '#ede9fe' },
  delivered:  { bg: 'rgba(193,251,212,0.15)', color: '#c1fbd4' },
  cancelled:  { bg: 'rgba(254,226,226,0.15)', color: '#fee2e2' },
};

export default function SellerOrders({ token }) {
  const { showToast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadOrders() {
    setLoading(true);
    try {
      const data = await apiFetch('/seller/orders', {}, token);
      setOrders(data?.orders || (Array.isArray(data) ? data : []));
    } catch (e) {
      showToast(e.message || 'Failed to load orders', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadOrders(); }, [token]);

  async function handleStatusChange(orderId, newStatus) {
    try {
      await apiFetch(`/seller/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      }, token);
      showToast(`Order status updated to ${newStatus}`, 'success');
      loadOrders();
    } catch (e) {
      showToast(e.message || 'Failed to update status', 'error');
    }
  }

  if (loading && orders.length === 0) return <SpinnerPage message="Loading fulfillment queue…" />;

  return (
    <div style={{
      fontFamily: "'Inter', Helvetica, Arial, sans-serif",
      fontFeatureSettings: '"ss03"',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 400, color: '#ffffff', letterSpacing: '0.36px', lineHeight: 1.2, marginBottom: 6, fontFeatureSettings: '"ss03"' }}>
            Order Operations
          </h1>
          <p style={{ color: '#71717a', fontSize: 15, fontWeight: 420, fontFeatureSettings: '"ss03"' }}>
            Manage fulfillment, customer dispatches, and status updates.
          </p>
        </div>
        <button
          onClick={loadOrders}
          disabled={loading}
          style={{
            padding: '9px 20px',
            background: 'transparent',
            color: 'rgba(255,255,255,0.8)',
            borderRadius: 9999,
            border: '1px solid #1e2c31',
            fontWeight: 420,
            fontSize: 14,
            cursor: loading ? 'wait' : 'pointer',
            transition: 'all 0.18s',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontFeatureSettings: '"ss03"',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; e.currentTarget.style.color = '#ffffff'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e2c31'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
        >
          <span>↻</span>
          <span>{loading ? 'Refreshing…' : 'Refresh'}</span>
        </button>
      </div>

      {/* Orders Table Card */}
      <div style={{
        background: '#0a0a0a',
        border: '1px solid #1e2c31',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}>
        {orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 24px' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📦</div>
            <div style={{ fontSize: 18, fontWeight: 500, color: '#ffffff', marginBottom: 4, fontFeatureSettings: '"ss03"' }}>No orders yet</div>
            <div style={{ color: '#71717a', fontSize: 14, fontFeatureSettings: '"ss03"' }}>New customer orders will populate here automatically.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#121212', borderBottom: '1px solid #1e2c31' }}>
                  <th style={thStyle}>Order Ref</th>
                  <th style={thStyle}>Customer</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Items</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Total Amount</th>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Status</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Update Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o, idx) => {
                  const badge = STATUS_BADGES[o.status?.toLowerCase()] || STATUS_BADGES.pending;
                  const orderKey = o.order_id || o.order_item_id;
                  return (
                    <tr
                      key={orderKey}
                      style={{
                        borderBottom: idx < orders.length - 1 ? '1px solid #1e2c31' : 'none',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#141414'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '16px 24px', color: '#ffffff', fontWeight: 500, fontFeatureSettings: '"ss03"' }}>
                        #{orderKey?.slice(-8)?.toUpperCase() || orderKey}
                      </td>
                      <td style={{ padding: '16px 24px', color: '#ffffff', fontFeatureSettings: '"ss03"' }}>
                        {o.customer_name || 'Customer'}
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', color: '#ffffff', fontFeatureSettings: '"ss03"' }}>
                        {o.item_count || o.quantity || 1}
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 500, color: '#c1fbd4', fontFeatureSettings: '"ss03"' }}>
                        ₹{Number(o.total_amount || o.line_total || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '16px 24px', color: '#71717a', fontFeatureSettings: '"ss03"' }}>
                        {new Date(o.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{
                          display: 'inline-flex',
                          padding: '2px 8px',
                          borderRadius: 9999,
                          fontSize: 11,
                          fontWeight: 500,
                          background: badge.bg,
                          color: badge.color,
                          textTransform: 'uppercase',
                          letterSpacing: '0.3px',
                          fontFeatureSettings: '"ss03"',
                        }}>
                          {o.status}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        <select
                          value={o.status?.toLowerCase() || 'pending'}
                          onChange={(e) => handleStatusChange(orderKey, e.target.value)}
                          style={{
                            padding: '6px 12px',
                            background: '#121212',
                            color: '#ffffff',
                            border: '1px solid #1e2c31',
                            borderRadius: 8,
                            fontSize: 13,
                            fontFamily: "'Inter', Helvetica, Arial, sans-serif",
                            fontFeatureSettings: '"ss03"',
                            outline: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          <option value="pending" style={{ background: '#0a0a0a' }}>Pending</option>
                          <option value="processing" style={{ background: '#0a0a0a' }}>Processing</option>
                          <option value="shipped" style={{ background: '#0a0a0a' }}>Shipped</option>
                          <option value="delivered" style={{ background: '#0a0a0a' }}>Delivered</option>
                          <option value="cancelled" style={{ background: '#0a0a0a' }}>Cancelled</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const thStyle = {
  padding: '14px 24px',
  fontSize: 11,
  fontWeight: 500,
  color: '#71717a',
  textTransform: 'uppercase',
  letterSpacing: '0.72px',
  fontFamily: "'Inter', Helvetica, Arial, sans-serif",
  fontFeatureSettings: '"ss03"',
};
