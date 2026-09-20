import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Package, 
  Truck, 
  CheckCircle2, 
  Clock, 
  Search, 
  AlertCircle, 
  X,
  ExternalLink,
  MapPin
} from 'lucide-react';
import api from '../services/api';

export const SellerOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionMsg, setActionMsg] = useState({ type: '', text: '' });

  // Fulfill modal state
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState('Bluedart');
  const [fulfillStatus, setFulfillStatus] = useState('shipped');
  const [submitting, setSubmitting] = useState(false);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await api.get('/seller/orders');
      if (res.data?.success) {
        setOrders(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch seller orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const openFulfillModal = (order) => {
    setSelectedOrder(order);
    setTrackingNumber(order.tracking_number || '');
    setCarrier(order.carrier || 'Bluedart');
    setFulfillStatus(order.status === 'processing' ? 'shipped' : order.status);
  };

  const handleUpdateFulfillment = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;
    try {
      setSubmitting(true);
      const res = await api.put(`/seller/orders/${selectedOrder.id}/fulfill`, {
        status: fulfillStatus,
        tracking_number: trackingNumber,
        carrier
      });
      if (res.data?.success) {
        setActionMsg({ type: 'success', text: `Order #${selectedOrder.id.slice(0, 8)} updated to ${fulfillStatus}.` });
        setSelectedOrder(null);
        fetchOrders();
      }
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to update order fulfillment.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    return true;
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            Fulfillment Orders
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
            Process customer purchases, generate shipping labels, and dispatch consignments
          </p>
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
          {actionMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{actionMsg.text}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{
        background: '#ffffff',
        border: '1px solid var(--color-border-card)',
        borderRadius: 'var(--radius-md)',
        padding: '14px 20px',
        marginBottom: '20px',
        display: 'flex',
        gap: '8px'
      }}>
        {['all', 'processing', 'shipped', 'delivered', 'cancelled'].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              textTransform: 'capitalize',
              backgroundColor: statusFilter === st ? 'var(--color-primary)' : 'var(--color-surface-subtle)',
              color: statusFilter === st ? '#ffffff' : 'var(--color-text-secondary)',
              transition: 'all var(--transition-fast)'
            }}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="table-card" style={{ padding: '24px' }}>
          {[1, 2, 3].map((n) => (
            <div key={n} style={{ height: '60px', marginBottom: '12px' }} className="skeleton" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="table-card" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <Package size={40} color="var(--color-text-muted)" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '6px' }}>No orders found</h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            There are currently no orders under this status.
          </p>
        </div>
      ) : (
        <div className="table-card table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Date</th>
                <th>Customer & Address</th>
                <th>Items Ordered</th>
                <th>Total Value</th>
                <th>Status</th>
                <th>Fulfillment</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((ord) => {
                const items = Array.isArray(ord.items) ? ord.items : [];
                return (
                  <tr key={ord.id}>
                    <td>
                      <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', fontFamily: 'monospace' }}>
                        #{ord.id.slice(0, 8).toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                        {new Date(ord.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                      </span>
                    </td>
                    <td>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>
                          {ord.customer_name || 'Customer'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <MapPin size={11} />
                          <span>{ord.shipping_city || 'City'}, {ord.shipping_state || 'State'}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {items.map((item, idx) => (
                          <div key={idx} style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                            <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{item.quantity}x</span> {item.product_title}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
                        ₹{parseFloat(ord.seller_subtotal || ord.total_amount).toLocaleString('en-IN')}
                      </div>
                    </td>
                    <td>
                      <span className={`status-pill status-pill-${ord.status}`}>
                        {ord.status}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => openFulfillModal(ord)}
                        className="btn-outline"
                        style={{ padding: '6px 12px', fontSize: 'var(--font-size-xs)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Truck size={14} />
                        <span>Update Status</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Fulfill Modal */}
      {selectedOrder && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Truck size={20} color="var(--color-primary)" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                  Update Order #{selectedOrder.id.slice(0, 8).toUpperCase()}
                </h3>
              </div>
              <button onClick={() => setSelectedOrder(null)} style={{ color: 'var(--color-text-secondary)' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdateFulfillment}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Update Order State</label>
                  <select
                    className="select-field"
                    value={fulfillStatus}
                    onChange={(e) => setFulfillStatus(e.target.value)}
                  >
                    <option value="processing">Processing (In Packing)</option>
                    <option value="shipped">Shipped (Dispatched with Courier)</option>
                    <option value="delivered">Delivered (Completed)</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Logistics Carrier</label>
                  <select
                    className="select-field"
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                  >
                    <option value="Bluedart">Blue Dart Express</option>
                    <option value="Delhivery">Delhivery Surface</option>
                    <option value="DTDC">DTDC Air</option>
                    <option value="IndiaPost">India Post Speed Post</option>
                    <option value="Shadowfax">Shadowfax Hyperlocal</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Airway Bill / Tracking Number (AWB)</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g., BLU98273910IN"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    Customer will receive this tracking code on their order timeline.
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setSelectedOrder(null)} className="btn-outline">
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  <span>{submitting ? 'Saving...' : 'Update Fulfillment'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerOrdersPage;
