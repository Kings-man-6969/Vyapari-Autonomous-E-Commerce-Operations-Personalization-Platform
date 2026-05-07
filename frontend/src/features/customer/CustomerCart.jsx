import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '@/services/api'
import { useToast } from '@/shared/components/Toast'
import Spinner from '@/shared/components/Spinner'
import EmptyState from '@/shared/components/EmptyState'
import '@/customer.css'

const CAT_EMOJI = { Electronics: '💻', Clothing: '👕', Books: '📚', 'Home & Kitchen': '🏠', Sports: '⚽', default: '📦' }

export default function CustomerCart({ sessionId, onCartUpdate }) {
  const toast = useToast()
  const [cart, setCart] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)

  async function loadCart() {
    setLoading(true)
    try {
      const data = await apiFetch(`/cart?session_id=${encodeURIComponent(sessionId)}`)
      setCart(data)
      onCartUpdate?.(data.items?.length || 0)
    } catch (err) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadCart() }, [sessionId])

  async function updateQty(productId, newQty) {
    if (newQty < 0) return
    setUpdatingId(productId)
    try {
      if (newQty === 0) {
        // Remove item entirely
        await apiFetch(`/cart/remove?session_id=${encodeURIComponent(sessionId)}&product_id=${encodeURIComponent(productId)}`, { method: 'DELETE' })
      } else {
        // Set absolute quantity
        await apiFetch(`/cart/update?session_id=${encodeURIComponent(sessionId)}`, {
          method: 'PUT',
          body: JSON.stringify({ product_id: productId, qty: newQty }),
        })
      }
      await loadCart()
    } catch (err) { toast.error(err.message) }
    finally { setUpdatingId(null) }
  }

  async function removeItem(productId) {
    setUpdatingId(productId)
    try {
      await apiFetch(`/cart/remove?session_id=${encodeURIComponent(sessionId)}&product_id=${encodeURIComponent(productId)}`, { method: 'DELETE' })
      toast.info('Item removed from cart.')
      await loadCart()
    } catch { await loadCart() }
    finally { setUpdatingId(null) }
  }

  const isEmpty = !loading && cart.items.length === 0

  return (
    <div className="customer-content animate-fade-in">
      <div className="customer-page">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 36, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 36, fontWeight: 900, color: '#ecfdf5', letterSpacing: '-0.03em', marginBottom: 4 }}>
              Your Cart
            </h1>
            <p style={{ color: 'rgba(167,243,208,.45)', fontSize: 14, fontFamily: "'Source Sans 3', sans-serif" }}>
              {isEmpty ? 'Your cart is empty' : `${cart.items.length} item${cart.items.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <Link to="/shop" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#34d399', fontSize: 13, fontWeight: 600, textDecoration: 'none', fontFamily: "'Source Sans 3', sans-serif" }}>
            ← Continue Shopping
          </Link>
        </div>

        {loading
          ? <div style={{ display: 'flex', justifyContent: 'center', padding: 72 }}><Spinner size="lg" /></div>
          : isEmpty
            ? (
              <EmptyState
                title="Your cart is empty"
                description="Explore the shop to find products you'll love."
                icon="🛒"
                action={<Link to="/shop" className="cust-btn-primary">Browse Products</Link>}
              />
            )
            : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 28, alignItems: 'start' }}>
                {/* Items */}
                <div className="cust-card" style={{ padding: 0 }}>
                  {cart.items.map((item) => {
                    const isUpdating = updatingId === item.product_id
                    return (
                      <div key={item.product_id} className="cart-item">
                        {/* Icon */}
                        <div style={{
                          width: 68, height: 68, borderRadius: 'var(--r-lg)',
                          background: 'rgba(16,185,129,.07)',
                          border: '1px solid rgba(52,211,153,.12)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 28, flexShrink: 0,
                        }}>
                          {CAT_EMOJI.default}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Link
                            to={`/shop/product/${item.product_id}`}
                            style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, fontSize: 17, color: '#d1fae5', textDecoration: 'none', display: 'block', marginBottom: 4 }}
                          >
                            {item.name}
                          </Link>
                          <div style={{ fontSize: 13, color: 'rgba(167,243,208,.4)', fontFamily: "'Source Sans 3', sans-serif", marginBottom: 12 }}>
                            ₹{Number(item.unit_price).toFixed(2)} each
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                            <div className="qty-stepper">
                              <button
                                onClick={() => updateQty(item.product_id, item.qty - 1)}
                                disabled={isUpdating || item.qty <= 1}
                                aria-label="Decrease quantity"
                              >−</button>
                              <span>{isUpdating ? <Spinner size="sm" /> : item.qty}</span>
                              <button
                                onClick={() => updateQty(item.product_id, item.qty + 1)}
                                disabled={isUpdating}
                                aria-label="Increase quantity"
                              >+</button>
                            </div>
                            <button
                              onClick={() => removeItem(item.product_id)}
                              disabled={isUpdating}
                              style={{ fontSize: 12, color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0, fontFamily: "'Source Sans 3', sans-serif" }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                        {/* Price */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontWeight: 800, fontSize: 20, color: '#ecfdf5' }}>
                            ₹{Number(item.line_total).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Summary */}
                <div style={{ minWidth: 270 }}>
                  <div className="cust-card" style={{ position: 'sticky', top: 80 }}>
                    <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, fontWeight: 800, color: '#ecfdf5', marginBottom: 20 }}>
                      Order Summary
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
                      {cart.items.map((item) => (
                        <div key={item.product_id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                          <span style={{ fontSize: 13, color: 'rgba(167,243,208,.5)', flex: 1, fontFamily: "'Source Sans 3', sans-serif" }}>{item.name} × {item.qty}</span>
                          <span style={{ fontSize: 13, color: '#d1fae5', fontFamily: "'Source Sans 3', sans-serif", fontWeight: 600 }}>₹{Number(item.line_total).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    <div style={{ height: 1, background: 'rgba(52,211,153,.1)', marginBottom: 16 }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: '#d1fae5', fontFamily: "'Source Sans 3', sans-serif" }}>Total</span>
                      <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 900, fontSize: 28, color: '#34d399', letterSpacing: '-0.03em' }}>
                        ₹{Number(cart.total).toFixed(2)}
                      </span>
                    </div>

                    <Link
                      to="/shop/checkout"
                      className="cust-btn-primary cust-btn-lg"
                      style={{ width: '100%', justifyContent: 'center', display: 'flex', textDecoration: 'none' }}
                    >
                      Checkout →
                    </Link>

                    <p style={{ fontSize: 11, color: 'rgba(167,243,208,.25)', textAlign: 'center', marginTop: 12, lineHeight: 1.5, fontFamily: "'Source Sans 3', sans-serif" }}>
                      Demo checkout — no real payment processed.
                    </p>
                  </div>
                </div>
              </div>
            )
        }
      </div>
    </div>
  )
}
