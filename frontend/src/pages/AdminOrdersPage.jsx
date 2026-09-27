import React, { useCallback, useEffect, useState } from 'react';
import {
  Search, X, PackageCheck, Truck, AlertTriangle, ChevronLeft, ChevronRight, MapPin, CreditCard
} from 'lucide-react';
import api from '../services/api';

/**
 * Admin order book — F4 and F5.
 *
 * The status control is not a dropdown of every status. The API returns
 * `next_status` for an order, derived from the same whitelist the write route
 * enforces, so the screen offers exactly the transitions that will be accepted.
 * A dropdown of all nine statuses would let an admin pick one that 409s, and
 * reimplementing the flow here is how the UI and the server come to disagree.
 *
 * Cancellation is deliberately absent. It belongs to `PUT /api/orders/:id/cancel`,
 * which is the path that returns stock to inventory; a second, differently
 * implemented cancel in the admin panel would be two ways to restore inventory
 * and one of them would eventually be wrong.
 */

// Mirrors the `orders.status` CHECK constraint in V1, which is the vocabulary
// `PUT /api/admin/orders/:id/status` validates against. There is no `created` or
// `pending_payment` here -- an unpaid order is `pending` -- and no `refunded`,
// because a refund is a row in `refunds` against a payment that stays `paid`.
// The first version of this file offered `created` and `pending_payment` as
// filter chips, and the API answered both with a 400 naming the real list.
const STATUS_ORDER = [
  'paid', 'processing', 'shipped', 'out_for_delivery', 'delivered',
  'pending', 'cancelled'
];

const STATUS_LABEL = {
  pending: 'Awaiting payment',
  paid: 'Paid',
  processing: 'Processing',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled'
};

const STATUS_PILL = {
  pending: 'pending',
  paid: 'paid',
  processing: 'processing',
  shipped: 'shipped',
  out_for_delivery: 'out_for_delivery',
  delivered: 'delivered',
  cancelled: 'cancelled'
};

const money = (n) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const AdminOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [counts, setCounts] = useState({});
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);

  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => { setTerm(search.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 25 };
      if (status) params.status = status;
      if (term) params.search = term;
      const res = await api.get('/admin/orders', { params });
      setOrders(res.data?.data || []);
      setCounts(res.data?.counts || {});
      setPagination(res.data?.pagination || { total: 0, page: 1, pages: 1 });
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Could not load the order book.');
    } finally {
      setLoading(false);
    }
  }, [page, status, term]);

  useEffect(() => { load(); }, [load]);

  const totalOrders = Object.values(counts).reduce((sum, n) => sum + Number(n || 0), 0);

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 className="heading-whisper" style={{ fontSize: '26px', margin: 0 }}>Orders</h1>
        <p style={{ color: 'var(--color-tide-pool)', fontSize: '13px', marginTop: '6px' }}>
          {pagination.total} matching · {totalOrders} total
        </p>
      </div>

      {error && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', marginBottom: '16px', borderRadius: '8px', border: '1px solid #7f1d1d', backgroundColor: '#2a1215', color: '#fecaca', fontSize: '13px' }}>
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <Chip active={status === ''} onClick={() => { setStatus(''); setPage(1); }} label="All" />
        {STATUS_ORDER.filter((s) => counts[s]).map((s) => (
          <Chip
            key={s}
            active={status === s}
            onClick={() => { setStatus(status === s ? '' : s); setPage(1); }}
            label={STATUS_LABEL[s]}
            count={counts[s]}
          />
        ))}
      </div>

      <div style={{ position: 'relative', maxWidth: '420px', marginBottom: '16px' }}>
        <Search size={15} color="var(--color-ash-label)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
        <input
          type="search"
          className="input-field"
          placeholder="Order id, gateway id, customer name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ paddingLeft: '36px', backgroundColor: 'var(--color-deep-canopy)', borderColor: 'var(--color-iron-veil)' }}
        />
      </div>

      <div style={{ backgroundColor: 'var(--color-deep-canopy)', border: '1px solid var(--color-iron-veil)', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Placed</th>
                <th>Items</th>
                <th>Ship to</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && orders.length === 0 ? (
                [1, 2, 3, 4, 5].map((n) => (
                  <tr key={n}><td colSpan={7}><div className="skeleton" style={{ height: '16px' }} /></td></tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--color-tide-pool)' }}>
                    No orders match these filters.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} onClick={() => setSelectedId(o.id)} style={{ cursor: 'pointer' }}>
                    <td>
                      <code style={{ fontSize: '11.5px', color: 'var(--color-silver-glow)' }}>
                        {o.order_number || o.id.slice(0, 8)}
                      </code>
                    </td>
                    <td>
                      <div style={{ color: '#ffffff', fontWeight: 500 }}>{o.customer_name}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--color-tide-pool)' }}>{o.customer_email}</div>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--color-tide-pool)', whiteSpace: 'nowrap' }}>
                      {formatDate(o.created_at)}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--color-silver-glow)' }}>{o.item_count}</td>
                    <td style={{ fontSize: '12px', color: 'var(--color-tide-pool)' }}>
                      {[o.ship_to?.city, o.ship_to?.pincode].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td style={{ color: '#ffffff', whiteSpace: 'nowrap' }}>{money(o.total_amount)}</td>
                    <td>
                      <span className={`status-pill status-pill-${STATUS_PILL[o.status] || 'pending'}`}>
                        {STATUS_LABEL[o.status] || o.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderTop: '1px solid var(--color-iron-veil)', fontSize: '12px', color: 'var(--color-tide-pool)' }}>
          <span>Page {pagination.page} of {pagination.pages}</span>
          <span style={{ display: 'flex', gap: '6px' }}>
            <button type="button" className="btn-small" disabled={pagination.page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft size={12} /> Previous
            </button>
            <button type="button" className="btn-small" disabled={pagination.page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>
              Next <ChevronRight size={12} />
            </button>
          </span>
        </div>
      </div>

      {selectedId && (
        <OrderDrawer orderId={selectedId} onClose={() => setSelectedId(null)} onChanged={load} />
      )}
    </div>
  );
};

function Chip({ active, onClick, label, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '7px',
        padding: '7px 13px',
        borderRadius: '9999px',
        border: `1px solid ${active ? 'var(--color-cyan-pulse)' : 'var(--color-iron-veil)'}`,
        backgroundColor: active ? 'var(--color-forest-floor)' : 'transparent',
        color: active ? '#ffffff' : 'var(--color-tide-pool)',
        fontSize: '12.5px',
        fontWeight: active ? 600 : 500,
        cursor: 'pointer'
      }}
    >
      {label}
      {typeof count === 'number' && (
        <span style={{ minWidth: '18px', padding: '0 5px', borderRadius: '9999px', backgroundColor: active ? 'var(--color-cyan-pulse)' : 'var(--color-forest-floor)', color: active ? '#0b0f14' : 'var(--color-tide-pool)', fontSize: '11px', fontWeight: 700, textAlign: 'center' }}>
          {count}
        </span>
      )}
    </button>
  );
}

function OrderDrawer({ orderId, onClose, onChanged }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/orders/${orderId}`);
      setOrder(res.data?.data || null);
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Could not load this order.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const advance = async (next) => {
    setBusy(true);
    setError(null);
    try {
      await api.put(`/admin/orders/${orderId}/status`, { status: next });
      await load();
      if (onChanged) await onChanged();
    } catch (err) {
      const detail = err?.response?.data?.error;
      setError(detail?.message || 'That status change was refused.');
    } finally {
      setBusy(false);
    }
  };

  const address = order?.shipping_address || {};

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(5, 7, 10, 0.72)', zIndex: 60, display: 'flex', justifyContent: 'flex-end' }}>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Order detail"
        style={{ width: 'min(640px, 100%)', height: '100%', overflowY: 'auto', backgroundColor: 'var(--color-abyssal-ink)', borderLeft: '1px solid var(--color-iron-veil)', padding: '24px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div>
            <h2 className="heading-whisper" style={{ fontSize: '20px', margin: 0 }}>
              {order?.order_number || 'Order'}
            </h2>
            <div style={{ fontSize: '12.5px', color: 'var(--color-tide-pool)', marginTop: '4px' }}>
              {formatDate(order?.created_at)}
            </div>
          </div>
          <button type="button" className="btn-small" onClick={onClose} aria-label="Close"><X size={14} /></button>
        </div>

        {error && (
          <div role="alert" style={{ marginTop: '14px', padding: '10px 12px', borderRadius: '8px', border: '1px solid #7f1d1d', backgroundColor: '#2a1215', color: '#fecaca', fontSize: '12.5px' }}>
            {error}
          </div>
        )}

        {loading && !order ? (
          <div className="skeleton" style={{ height: '200px', marginTop: '18px', borderRadius: '10px' }} />
        ) : order && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
              <span className={`status-pill status-pill-${STATUS_PILL[order.status] || 'pending'}`}>
                {STATUS_LABEL[order.status] || order.status}
              </span>
              {/* Only what the API says is allowed. See the module comment. */}
              {order.status === 'cancelled' ? (
                <span style={{ fontSize: '12px', color: 'var(--color-tide-pool)' }}>
                  Cancelled orders are not advanced from here.
                </span>
              ) : order.next_status ? (
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busy}
                  onClick={() => advance(order.next_status)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '9px 16px', opacity: busy ? 0.6 : 1 }}
                >
                  <Truck size={14} /> Move to {STATUS_LABEL[order.next_status] || order.next_status}
                </button>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--color-tide-pool)' }}>
                  <PackageCheck size={13} /> No further transitions.
                </span>
              )}
            </div>

            <Section title="Items">
              {(order.items || []).map((item) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '9px 0', borderBottom: '1px solid var(--color-iron-veil)' }}>
                  <div>
                    <div style={{ color: '#ffffff', fontSize: '13px' }}>{item.product_title || 'Removed product'}</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--color-tide-pool)', marginTop: '2px' }}>
                      {item.seller_name}
                      {item.variant_snapshot && Object.keys(item.variant_snapshot || {}).length > 0 &&
                        ` · ${Object.entries(item.variant_snapshot).map(([k, v]) => `${k}: ${v}`).join(', ')}`}
                      {item.sku_at_purchase && ` · ${item.sku_at_purchase}`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--color-silver-glow)', fontSize: '12.5px' }}>
                    {item.quantity} × {money(item.price_at_purchase)}
                    <div style={{ color: '#ffffff' }}>{money(item.line_total)}</div>
                  </div>
                </div>
              ))}
            </Section>

            <Section title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><MapPin size={13} /> Shipping address</span>}>
              <div style={{ fontSize: '12.5px', color: 'var(--color-ghost-white)', lineHeight: 1.7 }}>
                {[address.full_name, address.line1, address.line2, address.city, address.state, address.pincode, address.phone]
                  .filter(Boolean)
                  .map((line, i) => <div key={i}>{line}</div>)}
                {Object.keys(address).length === 0 && <span style={{ color: 'var(--color-tide-pool)' }}>No address on this order.</span>}
              </div>
            </Section>

            <Section title="Totals">
              <div style={{ display: 'grid', gap: '6px', fontSize: '13px' }}>
                <Line label="Order total" value={money(order.totals?.order_total)} />
                {order.totals?.refunded > 0 && <Line label="Refunded" value={money(order.totals.refunded)} />}
                {order.totals?.refund_pending > 0 && <Line label="Refund pending" value={money(order.totals.refund_pending)} />}
                <Line label="Still refundable" value={money(order.totals?.refundable)} strong />
              </div>
            </Section>

            {(order.payments || []).length > 0 && (
              <Section title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><CreditCard size={13} /> Payments</span>}>
                {order.payments.map((p) => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '12.5px', padding: '6px 0' }}>
                    <span style={{ color: 'var(--color-tide-pool)' }}>
                      {p.gateway || 'gateway'} · {p.status}
                      {p.razorpay_payment_id && <code style={{ marginLeft: '6px', fontSize: '11px' }}>{p.razorpay_payment_id}</code>}
                    </span>
                    <span style={{ color: '#ffffff' }}>{money(p.amount)}</span>
                  </div>
                ))}
              </Section>
            )}

            {(order.status_history || []).length > 0 && (
              <Section title="History">
                {order.status_history.map((h, i) => (
                  <div key={i} style={{ fontSize: '12px', color: 'var(--color-tide-pool)', padding: '5px 0' }}>
                    <span style={{ color: 'var(--color-silver-glow)' }}>{h.status}</span>
                    {' · '}{formatDate(h.created_at)}
                    {h.note && <div style={{ marginTop: '2px' }}>{h.note}</div>}
                  </div>
                ))}
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: '22px' }}>
      <div style={{ fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-ash-label)', marginBottom: '8px' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Line({ label, value, strong }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--color-ash-label)' }}>{label}</span>
      <span style={{ color: strong ? '#ffffff' : 'var(--color-silver-glow)', fontWeight: strong ? 600 : 400 }}>{value}</span>
    </div>
  );
}

export default AdminOrdersPage;
