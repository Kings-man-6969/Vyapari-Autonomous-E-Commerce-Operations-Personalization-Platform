import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../services/api';
import { SpinnerPage } from '../../shared/components/Spinner';
import '../../customer.css';

/* ─── DESIGN.MD — Transactional Track ───
   Canvas: #fbfbf5 cream · Cards: #ffffff with hairline borders
   Status badges: pill-tag style
   CTAs: solid black pill buttons
─────────────────────────────────────────── */

const fmt = (n) => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0 });

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

/* Status pill styles — transactional track (no neon colors) */
const STATUS_STYLES = {
  pending:   { bg: '#fef3c7', color: '#92400e' },
  confirmed: { bg: '#dbeafe', color: '#1e40af' },
  shipped:   { bg: '#ede9fe', color: '#5b21b6' },
  delivered: { bg: '#c1fbd4', color: '#000000' },  /* aloe for success */
  cancelled: { bg: '#fee2e2', color: '#991b1b' },
};

export default function CustomerOrders({ token }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    apiFetch('/orders')
      .then(d => setOrders(d.items || d.orders || []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ background: '#fbfbf5', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <SpinnerPage />
    </div>
  );

  return (
    <div style={{
      background: '#fbfbf5',
      minHeight: '100vh',
      padding: '48px 24px 80px',
      fontFamily: "'Inter', Helvetica, Arial, sans-serif",
      fontFeatureSettings: '"ss03"',
    }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        {/* Page title — display-lg thin */}
        <h1 style={{
          fontSize: 'clamp(2rem, 5vw, 55px)',
          fontWeight: 300, color: '#000000',
          marginBottom: 8, lineHeight: 1.16,
          fontFeatureSettings: '"ss03"',
        }}>
          My Orders
        </h1>
        <p style={{ fontSize: 16, fontWeight: 420, color: '#71717a', marginBottom: 40, fontFeatureSettings: '"ss03"' }}>
          {orders.length} order{orders.length !== 1 ? 's' : ''}
        </p>

        {/* Hairline divider */}
        <div style={{ height: 1, background: '#e4e4e7', marginBottom: 32 }} />

        {orders.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '80px 24px',
            background: '#ffffff', border: '1px solid #e4e4e7',
            borderRadius: 12,
            boxShadow: '0 2px 2px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
          }}>
            <div style={{ fontSize: '3.5rem', marginBottom: 20 }}>📭</div>
            <h2 style={{ fontSize: 24, fontWeight: 400, color: '#000000', marginBottom: 10, fontFeatureSettings: '"ss03"' }}>
              No orders yet
            </h2>
            <p style={{ fontSize: 16, fontWeight: 420, color: '#71717a', marginBottom: 32, fontFeatureSettings: '"ss03"' }}>
              Looks like you haven't placed any orders.
            </p>
            <Link to="/shop" style={{
              display: 'inline-flex', padding: '12px 28px',
              background: '#000000', color: '#ffffff',
              borderRadius: 9999, fontWeight: 420, fontSize: 15,
              textDecoration: 'none', transition: 'background 0.18s',
              fontFeatureSettings: '"ss03"',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#3f3f46'}
            onMouseLeave={e => e.currentTarget.style.background = '#000000'}
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {orders.map(order => {
              const st = STATUS_STYLES[order.status] || STATUS_STYLES.pending;
              const isOpen = expanded === order.order_id;
              return (
                <div key={order.order_id} style={{
                  background: '#ffffff',
                  border: '1px solid #e4e4e7',
                  borderRadius: 12,
                  overflow: 'hidden',
                  boxShadow: '0 2px 2px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
                  transition: 'box-shadow 0.2s',
                }}>
                  {/* Order header row */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : order.order_id)}
                    style={{
                      width: '100%', padding: '20px 24px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
                      background: 'none', border: 'none', cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                      {/* Order ID */}
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#000000', fontFeatureSettings: '"ss03"' }}>
                        #{order.order_id?.slice(-8)?.toUpperCase() || order.order_id}
                      </div>
                      {/* Status pill */}
                      <span style={{
                        padding: '3px 10px', borderRadius: 9999,
                        background: st.bg, color: st.color,
                        fontSize: 12, fontWeight: 420, letterSpacing: '0.3px',
                        textTransform: 'capitalize',
                        fontFeatureSettings: '"ss03"',
                      }}>
                        {order.status}
                      </span>
                      {/* Date */}
                      <span style={{ fontSize: 13, fontWeight: 420, color: '#71717a', fontFeatureSettings: '"ss03"' }}>
                        {timeAgo(order.created_at)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <span style={{ fontSize: 16, fontWeight: 500, color: '#000000', fontFeatureSettings: '"ss03"' }}>
                        {fmt(order.total_amount || 0)}
                      </span>
                      <span style={{ color: '#71717a', fontSize: 12, transition: 'transform 0.2s', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div style={{ borderTop: '1px solid #e4e4e7', padding: '20px 24px' }}>
                      {/* Items */}
                      {(order.items || []).map((item, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 0',
                          borderBottom: i < order.items.length - 1 ? '1px solid #e4e4e7' : 'none',
                        }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 500, color: '#000000', fontFeatureSettings: '"ss03"' }}>{item.name || item.product_name}</div>
                            <div style={{ fontSize: 12, fontWeight: 420, color: '#71717a', fontFeatureSettings: '"ss03"' }}>Qty: {item.quantity || 1}</div>
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 500, color: '#000000', fontFeatureSettings: '"ss03"' }}>
                            {fmt((item.price || 0) * (item.quantity || 1))}
                          </div>
                        </div>
                      ))}

                      {/* Shipping info */}
                      {order.shipping_address && (
                        <div style={{ marginTop: 16, padding: '16px', background: '#fbfbf5', borderRadius: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 400, color: '#71717a', letterSpacing: '0.72px', textTransform: 'uppercase', marginBottom: 8, fontFeatureSettings: '"ss03"' }}>
                            Delivery address
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 420, color: '#000000', lineHeight: 1.6, fontFeatureSettings: '"ss03"' }}>
                            {order.shipping_address.name} · {order.shipping_address.street}, {order.shipping_address.city}, {order.shipping_address.state} – {order.shipping_address.pincode}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
