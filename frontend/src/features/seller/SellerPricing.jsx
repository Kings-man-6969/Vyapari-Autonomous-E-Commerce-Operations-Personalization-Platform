import React, { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/services/api'
import { useToast } from '@/shared/components/Toast'
import PageHeader from '@/shared/components/PageHeader'
import StatCard from '@/shared/components/StatCard'
import Badge from '@/shared/components/Badge'
import Spinner from '@/shared/components/Spinner'
import EmptyState from '@/shared/components/EmptyState'

export default function SellerPricing({ token }) {
  const toast = useToast()
  const [products, setProducts] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [priceHistory, setPriceHistory] = useState([])
  const [priceDrafts, setPriceDrafts] = useState({})
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [updating, setUpdating] = useState(null)

  const selected = useMemo(
    () => products.find((p) => p.product_id === selectedId),
    [products, selectedId],
  )

  useEffect(() => { loadProducts() }, [token])

  useEffect(() => {
    if (selectedId) loadHistory(selectedId)
  }, [selectedId, token])

  async function loadProducts() {
    setLoading(true)
    try {
      const payload = await apiFetch('/products/seller/inventory', {}, token)
      const list = payload.products || []
      setProducts(list)
      if (!selectedId && list.length > 0) setSelectedId(list[0].product_id)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadHistory(pid) {
    setHistoryLoading(true)
    try {
      const payload = await apiFetch(`/products/${pid}/price-history`, {}, token)
      setPriceHistory(payload.price_history || [])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setHistoryLoading(false)
    }
  }

  async function updatePrice(productId) {
    const draft = priceDrafts[productId]
    if (!draft || !Number(draft)) { toast.warning('Enter a valid price first.'); return }
    setUpdating(productId)
    try {
      await apiFetch(`/products/${productId}/price?new_price=${encodeURIComponent(draft)}`, { method: 'POST' }, token)
      toast.success(`Price updated for ${products.find(p => p.product_id === productId)?.name || productId}`)
      setPriceDrafts((c) => ({ ...c, [productId]: '' }))
      await loadProducts()
      if (selectedId === productId) await loadHistory(productId)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setUpdating(null)
    }
  }

  const avgPrice = products.length ? products.reduce((s, p) => s + Number(p.price || 0), 0) / products.length : 0

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><Spinner size="lg" /></div>
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Pricing"
        description="Manage price changes across your catalog. Every update is logged for traceability."
        action={
          <button onClick={loadProducts} className="btn btn-secondary btn-sm">
            <RefreshIcon /> Refresh
          </button>
        }
      />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard label="Tracked SKUs" value={products.length} variant="primary" />
        <StatCard label="Average Price" value={`₹${avgPrice.toFixed(2)}`} variant="info" />
        <StatCard label="Selected Price" value={selected ? `₹${Number(selected.price).toFixed(2)}` : '—'} variant="default" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {/* Bulk price updater */}
        <div className="card">
          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--c-text)', marginBottom: 4 }}>Bulk Price Updates</h3>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--c-text-muted)', marginBottom: 18 }}>
            Enter a new price for any product and apply the update immediately.
          </p>

          {products.length === 0
            ? <EmptyState title="No products found" description="Add products in Inventory first." />
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {products.map((p) => {
                  const draft = priceDrafts[p.product_id] || ''
                  const projectedMargin = draft && p.cost
                    ? ((Number(draft) - p.cost) / Number(draft) * 100).toFixed(1)
                    : null
                  return (
                    <div key={p.product_id} style={productRowStyle}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 'var(--fs-sm)', color: 'var(--c-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-text-muted)' }}>{p.category}</span>
                          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-text-faint)' }}>•</span>
                          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--c-text)' }}>₹{Number(p.price).toFixed(2)}</span>
                          {projectedMargin !== null && (
                            <Badge variant={Number(projectedMargin) >= 15 ? 'success' : 'warning'}>{projectedMargin}% margin</Badge>
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
                          onChange={(e) => setPriceDrafts((c) => ({ ...c, [p.product_id]: e.target.value }))}
                          className="form-input"
                          style={{ width: 120 }}
                        />
                        <button
                          onClick={() => updatePrice(p.product_id)}
                          disabled={!draft || updating === p.product_id}
                          className="btn btn-primary btn-sm"
                        >
                          {updating === p.product_id ? <Spinner size="sm" color="#fff" /> : 'Update'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          }
        </div>

        {/* Price History */}
        <div className="card">
          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--c-text)', marginBottom: 16 }}>Price History</h3>

          {/* Product selector */}
          <div className="form-field" style={{ marginBottom: 16 }}>
            <label className="form-label">Select Product</label>
            <select
              className="form-select"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {products.map((p) => (
                <option key={p.product_id} value={p.product_id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Current price pill */}
          {selected && (
            <div style={currentPricePillStyle}>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Current Price</span>
              <span style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--c-text)', letterSpacing: '-0.02em', fontFamily: 'var(--font-mono)' }}>
                ₹{Number(selected.price).toFixed(2)}
              </span>
            </div>
          )}

          {/* History timeline */}
          <div style={{ marginTop: 16 }}>
            {historyLoading
              ? <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Spinner size="md" /></div>
              : priceHistory.length === 0
                ? <EmptyState title="No price changes" description="Price changes will appear here after you make updates." />
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {priceHistory.map((entry, i) => (
                      <div key={`${entry.changed_at}-${i}`} style={timelineItemStyle}>
                        <div style={timelineDotStyle} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--c-text-muted)', fontSize: 'var(--fs-sm)', textDecoration: 'line-through' }}>
                              ₹{Number(entry.old_price).toFixed(2)}
                            </span>
                            <span style={{ color: 'var(--c-text-faint)', fontSize: 12 }}>→</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--c-text)', fontSize: 'var(--fs-md)' }}>
                              ₹{Number(entry.new_price).toFixed(2)}
                            </span>
                          </div>
                          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-text-faint)', marginTop: 2 }}>
                            {entry.changed_at ? new Date(entry.changed_at).toLocaleString() : 'Unknown time'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
            }
          </div>
        </div>
      </div>
    </div>
  )
}

/* ——— Styles ——— */
const productRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 14px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--c-border)',
  background: 'var(--c-surface-2)',
}

const currentPricePillStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: '14px 16px',
  borderRadius: 'var(--radius-md)',
  background: 'var(--c-primary-bg)',
  border: '1px solid rgba(99,102,241,0.2)',
}

const timelineItemStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  padding: '10px 0',
  borderLeft: '2px solid var(--c-border)',
  paddingLeft: 16,
  marginLeft: 6,
  position: 'relative',
}

const timelineDotStyle = {
  position: 'absolute',
  left: -5,
  top: 14,
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: 'var(--c-primary)',
  flexShrink: 0,
}

function RefreshIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
}
