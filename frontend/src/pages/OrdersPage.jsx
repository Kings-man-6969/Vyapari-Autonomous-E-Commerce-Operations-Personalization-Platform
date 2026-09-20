import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Package, ChevronRight, Clock, CheckCircle, Truck } from 'lucide-react';
import api from '../services/api';

export const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await api.get('/orders');
        if (res.data?.success) {
          setOrders(res.data.data.orders || []);
        }
      } catch (err) {
        console.error('Failed to load orders:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'delivered':
        return <span className="badge badge-success">Delivered</span>;
      case 'shipped':
        return <span className="badge badge-primary">In Transit</span>;
      case 'paid':
      case 'processing':
        return <span className="badge badge-warning">Processing</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '48px 24px' }}>
        <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, marginBottom: '24px' }}>My Orders</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[1, 2, 3].map(n => <div key={n} style={{ height: '100px' }} className="skeleton" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '40px 24px', maxWidth: '900px' }}>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, marginBottom: '8px' }}>
        My Orders
      </h1>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: '32px' }}>
        Track shipments, view timelines, and write verified purchase reviews.
      </p>

      {orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', border: '1px dashed var(--color-border-subtle)', borderRadius: 'var(--radius-md)' }}>
          <Package size={48} color="var(--color-text-muted)" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: '8px' }}>No orders yet</h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: '20px' }}>
            When you purchase products, your order status and courier tracking will appear here.
          </p>
          <Link to="/explore" className="btn-primary">
            Explore Marketplace
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {orders.map((order) => (
            <Link
              key={order.id}
              to={`/orders/${order.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '24px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-card)',
                backgroundColor: '#ffffff',
                boxShadow: 'var(--shadow-xs)',
                transition: 'all var(--transition-fast)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-surface-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-primary)'
                }}>
                  <Package size={24} />
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, fontSize: 'var(--font-size-base)' }}>
                      Order #{order.id.slice(0, 8).toUpperCase()}
                    </span>
                    {getStatusBadge(order.status)}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    Placed on {new Date(order.created_at).toLocaleDateString()} • {order.item_count} item{order.item_count > 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                <span style={{ fontWeight: 800, fontSize: 'var(--font-size-lg)' }}>
                  ₹{parseFloat(order.total_amount).toLocaleString('en-IN')}
                </span>
                <ChevronRight size={20} color="var(--color-text-muted)" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
