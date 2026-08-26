import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../shared/hooks/useToast';
import { SpinnerPage } from '../../shared/components/Spinner';

/* ─── DESIGN.MD — Seller Pricing Strategy ───
   Canvas: #000000 · Cards: #0a0a0a · Hairlines: #1e2c31
   Buttons: pill-only · Typography: Inter ss03
─────────────────────────────────────────────── */

export default function SellerPricing({ token }) {
  const { showToast } = useToast();
  const [products, setProducts] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [priceHistory, setPriceHistory] = useState([]);
  const [priceDrafts, setPriceDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [updating, setUpdating] = useState(null);

  const selected = useMemo(() => products.find(p => p.product_id === selectedId), [products, selectedId]);

  useEffect(() => { loadProducts(); }, [token]);

  useEffect(() => {
    if (selectedId) loadHistory(selectedId);
  }, [selectedId, token]);

  async function loadProducts() {
    setLoading(true);
    try {
      const payload = await apiFetch('/seller/inventory', {}, token);
      const list = payload.products || [];
      setProducts(list);
      if (!selectedId && list.length > 0) setSelectedId(list[0].product_id);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory(pid) {
    setHistoryLoading(true);
    try {
      const payload = await apiFetch(`/products/${pid}/price-history`, {}, token);
      setPriceHistory(payload.price_history || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setHistoryLoading(false);
    }
  }

  async function updatePrice(productId) {
    const draft = priceDrafts[productId];
    if (!draft || !Number(draft)) { showToast('Enter a valid price first.', 'warning'); return; }
    setUpdating(productId);
    try {
      await apiFetch(`/products/${productId}/price?new_price=${encodeURIComponent(draft)}`, { method: 'POST' }, token);
      showToast(`Price updated for ${products.find(p => p.product_id === productId)?.name || productId}`, 'success');
      setPriceDrafts(c => ({ ...c, [productId]: '' }));
      await loadProducts();
      if (selectedId === productId) await loadHistory(productId);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUpdating(null);
    }
  }

  const avgPrice = products.length ? products.reduce((s, p) => s + Number(p.price || 0), 0) / products.length : 0;

  if (loading && products.length === 0) return <SpinnerPage message="Loading pricing parameters…" />;

  return (
    <div style={{
      fontFamily: "'Inter', Helvetica, Arial, sans-serif",
      fontFeatureSettings: '"ss03"',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 400, color: '#ffffff', letterSpacing: '0.36px', lineHeight: 1.2, marginBottom: 6, fontFeatureSettings: '"ss03"' }}>
            Pricing Strategy
          </h1>
          <p style={{ color: '#71717a', fontSize: 15, fontWeight: 420, fontFeatureSettings: '"ss03"' }}>
            Configure price elasticity and real-time algorithmic price points.
          </p>
        </div>
        <button
          onClick={loadProducts}
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

      {/* KPI Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Tracked SKUs', value: products.length, sub: 'Active price points' },
          { label: 'Catalog Average', value: `₹${avgPrice.toFixed(2)}`, sub: 'Mean listing price' },
          { label: 'Selected Item Price', value: selected ? `₹${Number(selected.price).toFixed(2)}` : '—', sub: selected?.name || 'Select below' },
        ].map((stat, i) => (
          <div
            key={i}
            style={{
              background: '#0a0a0a',
              border: '1px solid #1e2c31',
              borderRadius: 12,
              padding: '20px 24px',
              boxShadow: '0 1px 2px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 400, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.72px', marginBottom: 8, fontFeatureSettings: '"ss03"' }}>
              {stat.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 400, color: '#ffffff', marginBottom: 4, fontFeatureSettings: '"ss03"' }}>
              {stat.value}
            </div>
            <div style={{ fontSize: 12, color: '#71717a', fontFeatureSettings: '"ss03"', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {stat.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid: Bulk Updates (Left) & Price History (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>

        {/* Bulk Updates Panel */}
        <div style={{
          background: '#0a0a0a',
          border: '1px solid #1e2c31',
          borderRadius: 12,
          padding: 28,
          boxShadow: '0 1px 2px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 500, color: '#ffffff', marginBottom: 6, fontFeatureSettings: '"ss03"' }}>
            Direct Price Overrides
          </h2>
          <p style={{ color: '#71717a', fontSize: 14, marginBottom: 24, fontFeatureSettings: '"ss03"' }}>
            Enter new price points to immediately update customer catalog and margin calculations.
          </p>

          {products.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: '#71717a', fontSize: 14 }}>
              No products found in inventory.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {products.map((p) => {
                const draft = priceDrafts[p.product_id] || '';
                const projectedMargin = draft && p.cost ? ((Number(draft) - p.cost) / Number(draft) * 100).toFixed(1) : null;
                return (
                  <div
                    key={p.product_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 16,
                      padding: '16px 20px',
                      background: '#121212',
                      border: '1px solid #1e2c31',
                      borderRadius: 10,
                      transition: 'border-color 0.15s',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 14, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4, fontFeatureSettings: '"ss03"' }}>
                        {p.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontFeatureSettings: '"ss03"' }}>{p.category}</span>
                        <span style={{ fontSize: 12, color: '#71717a' }}>·</span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#ffffff', fontFeatureSettings: '"ss03"' }}>
                          ₹{Number(p.price).toFixed(2)}
                        </span>
                        {projectedMargin !== null && (
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 9999,
                            fontSize: 10,
                            fontWeight: 500,
                            background: Number(projectedMargin) >= 15 ? 'rgba(193,251,212,0.15)' : 'rgba(254,226,226,0.15)',
                            color: Number(projectedMargin) >= 15 ? '#c1fbd4' : '#fee2e2',
                            fontFeatureSettings: '"ss03"',
                          }}>
                            {projectedMargin}% Margin
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="New price"
                        value={draft}
                        onChange={e => setPriceDrafts(c => ({ ...c, [p.product_id]: e.target.value }))}
                        style={{
                          width: 110,
                          padding: '8px 12px',
                          background: '#0a0a0a',
                          border: '1px solid #1e2c31',
                          borderRadius: 8,
                          color: '#ffffff',
                          fontSize: 14,
                          fontFamily: "'Inter', Helvetica, Arial, sans-serif",
                          fontFeatureSettings: '"ss03"',
                          outline: 'none',
                        }}
                        onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.3)'}
                        onBlur={e => e.target.style.borderColor = '#1e2c31'}
                      />
                      <button
                        onClick={() => updatePrice(p.product_id)}
                        disabled={!draft || updating === p.product_id}
                        style={{
                          padding: '8px 18px',
                          background: (!draft || updating === p.product_id) ? '#1e2c31' : '#ffffff',
                          color: (!draft || updating === p.product_id) ? '#71717a' : '#000000',
                          borderRadius: 9999,
                          border: 'none',
                          fontWeight: 500,
                          fontSize: 13,
                          cursor: (!draft || updating === p.product_id) ? 'not-allowed' : 'pointer',
                          fontFamily: "'Inter', Helvetica, Arial, sans-serif",
                          fontFeatureSettings: '"ss03"',
                          transition: 'all 0.15s',
                        }}
                      >
                        {updating === p.product_id ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Price History Timeline */}
        <div style={{
          background: '#0a0a0a',
          border: '1px solid #1e2c31',
          borderRadius: 12,
          padding: 28,
          boxShadow: '0 1px 2px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 500, color: '#ffffff', marginBottom: 20, fontFeatureSettings: '"ss03"' }}>
            Audit Log & History
          </h2>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 400, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.72px', marginBottom: 6, fontFeatureSettings: '"ss03"' }}>
              Select Item
            </label>
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: '#121212',
                border: '1px solid #1e2c31',
                borderRadius: 8,
                color: '#ffffff',
                fontSize: 14,
                fontFamily: "'Inter', Helvetica, Arial, sans-serif",
                fontFeatureSettings: '"ss03"',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {products.map(p => (
                <option key={p.product_id} value={p.product_id} style={{ background: '#0a0a0a', color: '#fff' }}>
                  {p.name} (₹{Number(p.price).toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          <div>
            {historyLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                <SpinnerPage message="Loading history…" />
              </div>
            ) : priceHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', border: '1px dashed #1e2c31', borderRadius: 12 }}>
                <div style={{ fontSize: '2rem', opacity: 0.5, marginBottom: 8 }}>📉</div>
                <div style={{ fontSize: 15, fontWeight: 500, color: '#ffffff', marginBottom: 4, fontFeatureSettings: '"ss03"' }}>No prior price updates</div>
                <div style={{ fontSize: 13, color: '#71717a', fontFeatureSettings: '"ss03"' }}>Historical price shifts will be recorded here.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {priceHistory.map((entry, i) => (
                  <div
                    key={`${entry.changed_at}-${i}`}
                    style={{
                      padding: '14px 18px',
                      background: '#121212',
                      border: '1px solid #1e2c31',
                      borderRadius: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, color: '#71717a', textDecoration: 'line-through', fontFeatureSettings: '"ss03"' }}>
                        ₹{Number(entry.old_price).toFixed(2)}
                      </span>
                      <span style={{ color: '#71717a', fontSize: 13 }}>→</span>
                      <span style={{ fontSize: 16, fontWeight: 500, color: '#c1fbd4', fontFeatureSettings: '"ss03"' }}>
                        ₹{Number(entry.new_price).toFixed(2)}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#71717a', fontFeatureSettings: '"ss03"' }}>
                      {entry.changed_at ? new Date(entry.changed_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Logged'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
