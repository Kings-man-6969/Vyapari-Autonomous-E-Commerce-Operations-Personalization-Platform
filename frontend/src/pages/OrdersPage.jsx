import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Package, ChevronRight, Clock, CheckCircle, Truck, ArrowRight } from 'lucide-react';
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
        return <span className="status-pill status-pill-delivered">Delivered</span>;
      case 'shipped':
      case 'out_for_delivery':
        return <span className="status-pill status-pill-active">In Transit</span>;
      case 'paid':
      case 'processing':
        return <span className="status-pill status-pill-processing">Processing</span>;
      case 'cancelled':
        return <span className="status-pill status-pill-out_of_stock">Cancelled</span>;
      default:
        return <span className="status-pill status-pill-draft">{status.replace('_', ' ')}</span>;
    }
  };

  if (loading) {
    return (
      <div style={{ backgroundColor: 'var(--color-obsidian-graphite)', minHeight: 'calc(100vh - 76px)', padding: '52px 24px' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <h1 className="heading-whisper" style={{ fontSize: '32px', color: '#ffffff', marginBottom: '24px' }}>My Orders</h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[1, 2, 3].map(n => <div key={n} style={{ height: '96px', backgroundColor: 'var(--color-gunmetal-dark)', borderRadius: '12px', border: '1px solid var(--color-border-steel)' }} className="skeleton" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: 'var(--color-obsidian-graphite)', minHeight: 'calc(100vh - 76px)', padding: '52px 24px 80px' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        <div style={{ marginBottom: '36px' }}>
          <h1 className="heading-whisper" style={{ fontSize: '32px', color: '#ffffff', letterSpacing: '0.02em', margin: 0 }}>
            My Orders
          </h1>
          <p style={{ color: 'var(--color-silver-glow)', opacity: 0.75, fontSize: '13px', marginTop: '6px' }}>
            Track shipments and view details of your past orders
          </p>
        </div>

        {orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 20px', border: '1px dashed var(--color-border-steel)', borderRadius: '16px', backgroundColor: 'var(--color-gunmetal-dark)' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'var(--color-titanium-brushed)', border: '1px solid var(--color-border-steel)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
              <Package size={28} color="var(--color-ash-label)" />
            </div>
            <h3 className="heading-whisper" style={{ fontSize: '20px', color: '#ffffff', marginBottom: '8px' }}>No orders placed yet</h3>
            <p style={{ color: 'var(--color-silver-glow)', opacity: 0.75, fontSize: '13px', marginBottom: '24px', maxWidth: '440px', margin: '0 auto 24px', lineHeight: 1.5 }}>
              When you place an order, tracking updates and order details will appear here.
            </p>
            <Link 
              to="/explore" 
              className="btn-primary"
              style={{ display: 'inline-block', padding: '12px 28px' }}
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {orders.map((order) => (
              <Link
                key={order.id}
                to={`/orders/${order.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '22px 24px',
                  borderRadius: '14px',
                  border: '1px solid var(--color-border-steel)',
                  backgroundColor: 'var(--color-gunmetal-dark)',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border-chrome)';
                  e.currentTarget.style.backgroundColor = 'var(--color-titanium-brushed)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border-steel)';
                  e.currentTarget.style.backgroundColor = 'var(--color-gunmetal-dark)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                  <div style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--color-titanium-brushed)',
                    border: '1px solid var(--color-border-steel)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-icy-steel)'
                  }}>
                    <Package size={22} />
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, fontSize: '15px', color: '#ffffff', letterSpacing: '0.01em' }}>
                        Order #{order.id.slice(0, 8).toUpperCase()}
                      </span>
                      {getStatusBadge(order.status)}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-silver-glow)', opacity: 0.75 }}>
                      Placed on {new Date(order.created_at).toLocaleDateString()} • {order.item_count} item{order.item_count > 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <span style={{ fontWeight: 600, fontSize: '17px', color: '#ffffff', letterSpacing: '0.01em' }}>
                    ₹{parseFloat(order.total_amount).toLocaleString('en-IN')}
                  </span>
                  <ChevronRight size={18} color="var(--color-ash-label)" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrdersPage;
