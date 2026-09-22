import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Package, 
  Truck, 
  CheckCircle2, 
  AlertCircle, 
  X,
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
  const [carrier, setCarrier] = useState('delhivery');
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
    setCarrier(order.carrier || 'delhivery');
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
          <h1 className="heading-whisper" style={{ fontSize: '26px' }}>
            Merchant Fulfillment Desk
          </h1>
          <p style={{ color: 'var(--color-tide-pool)', fontSize: '13px', marginTop: '4px' }}>
            Process customer purchases, assign courier logistics, and dispatch consignments
          </p>
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
          backgroundColor: actionMsg.type === 'success' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(244, 63, 94, 0.12)',
          color: actionMsg.type === 'success' ? 'var(--color-icy-steel)' : 'var(--color-error)',
          border: actionMsg.type === 'success' ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(244, 63, 94, 0.3)',
          fontSize: '13px'
        }}>
          {actionMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{actionMsg.text}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{
        background: 'var(--color-forest-floor)',
        border: '1px solid var(--color-iron-veil)',
        borderRadius: '12px',
        padding: '12px 18px',
        marginBottom: '20px',
        display: 'flex',
        gap: '8px',
        overflowX: 'auto'
      }}>
        {['all', 'paid', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-pills)',
              fontSize: '12px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
              backgroundColor: statusFilter === st ? '#ffffff' : 'var(--color-deep-canopy)',
              color: statusFilter === st ? '#02090a' : 'var(--color-tide-pool)',
              border: statusFilter === st ? '1px solid #ffffff' : '1px solid var(--color-iron-veil)',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {st.replace(/_/g, ' ')}
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
          <Package size={36} color="var(--color-ash-label)" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff', marginBottom: '6px' }}>No orders found</h3>
          <p style={{ color: 'var(--color-tide-pool)', fontSize: '13px' }}>
            There are currently no orders under this status filter.
          </p>
        </div>
      ) : (
        <div className="table-card table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order Ref</th>
                <th>Date</th>
                <th>Destination</th>
                <th>Items Ordered</th>
                <th>Subtotal</th>
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
                      <span style={{ fontWeight: 600, fontSize: '12px', fontFamily: 'monospace', color: '#ffffff' }}>
                        #{ord.id.slice(0, 8).toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', color: 'var(--color-ash-label)' }}>
                        {new Date(ord.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                      </span>
                    </td>
                    <td>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: '12px', color: '#ffffff' }}>
                          {ord.customer_name || 'Customer'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-tide-pool)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <MapPin size={11} />
                          <span>{ord.shipping_city || 'City'}, {ord.shipping_state || 'State'}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {items.map((item, idx) => (
                          <div key={idx} style={{ fontSize: '12px', color: 'var(--color-tide-pool)' }}>
                            <span style={{ fontWeight: 600, color: '#ffffff' }}>{item.quantity}x</span> {item.product_title}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: '#ffffff' }}>
                        ₹{parseFloat(ord.seller_subtotal || ord.total_amount).toLocaleString('en-IN')}
                      </div>
                    </td>
                    <td>
                      <span className={`status-pill status-pill-${ord.status}`}>
                        {ord.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => openFulfillModal(ord)}
                        className="btn-small"
                      >
                        <Truck size={13} color="var(--color-icy-steel)" />
                        <span>Dispatch</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Dispatch Modal */}
      {selectedOrder && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Truck size={18} color="var(--color-icy-steel)" />
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff' }}>
                  Dispatch Order #{selectedOrder.id.slice(0, 8).toUpperCase()}
                </h3>
              </div>
              <button onClick={() => setSelectedOrder(null)} style={{ color: 'var(--color-ash-label)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUpdateFulfillment}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Order Lifecycle State</label>
                  <select
                    className="select-field"
                    value={fulfillStatus}
                    onChange={(e) => setFulfillStatus(e.target.value)}
                  >
                    <option value="processing">Processing (In Merchant Packing)</option>
                    <option value="shipped">Shipped (Handed to Logistics Partner)</option>
                    <option value="out_for_delivery">Out for Delivery</option>
                    <option value="delivered">Delivered (Completed)</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Logistics Provider</label>
                  <select
                    className="select-field"
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                  >
                    <option value="delhivery">Delhivery Express</option>
                    <option value="bluedart">Blue Dart Aviation</option>
                    <option value="dtdc">DTDC Express</option>
                    <option value="india_post">India Post Speed Post</option>
                    <option value="self">Local Merchant Courier</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Airway Bill / Tracking Reference (AWB)</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g., DEL98273910IN"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--color-tide-pool)', marginTop: '4px', display: 'block' }}>
                    Tracking code is surfaced on customer order timeline.
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setSelectedOrder(null)} className="btn-outline">
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  <span>{submitting ? 'Updating...' : 'Confirm Dispatch'}</span>
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
