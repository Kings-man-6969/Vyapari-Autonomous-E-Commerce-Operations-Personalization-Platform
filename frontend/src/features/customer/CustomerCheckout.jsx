import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiFetch } from '@/services/api'
import { useToast } from '@/shared/components/Toast'
import Spinner from '@/shared/components/Spinner'

/*
  CUSTOMER CHECKOUT — with 3-step progress bar
  Cart → Shipping → Confirmation
  Playfair Display headings, Source Sans 3 body, warm emerald palette
*/

const STEPS = [
  { label: 'Cart',         id: 'cart' },
  { label: 'Shipping',     id: 'shipping' },
  { label: 'Confirmation', id: 'confirm' },
]

function CheckoutProgress({ currentStep }) {
  return (
    <div className="checkout-progress" aria-label="Checkout progress" role="list">
      {STEPS.map((step, i) => {
        const state = i < currentStep ? 'completed' : i === currentStep ? 'active' : ''
        return (
          <div key={step.id} className={`checkout-step ${state}`} role="listitem" aria-current={i === currentStep ? 'step' : undefined}>
            <div className="checkout-step-dot">
              {i < currentStep
                ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                : i + 1
              }
            </div>
            <span className="checkout-step-label">{step.label}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function CustomerCheckout({ sessionId, token, onCartUpdate }) {
  const toast     = useToast()
  const navigate  = useNavigate()
  const [cart, setCart]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [placingOrder, setPlacingOrder] = useState(false)
  const [address, setAddress]     = useState('')
  const [step, setStep]           = useState(1) // 0=cart, 1=shipping, 2=confirm

  useEffect(() => {
    async function fetchCart() {
      try {
        const data = await apiFetch(`/cart?session_id=${encodeURIComponent(sessionId)}`)
        setCart(data)
        if (data.items?.length === 0) {
          toast.info('Your cart is empty. Redirecting to shop…')
          navigate('/shop')
        }
      } catch {
        toast.error('Failed to load cart')
      } finally {
        setLoading(false)
      }
    }
    fetchCart()
  }, [sessionId, navigate, toast])

  async function handleCheckout(e) {
    e.preventDefault()
    if (!address.trim()) { toast.error('Please provide a shipping address.'); return }
    setPlacingOrder(true)
    try {
      const payload = {
        items: cart.items.map(i => ({ product_id: i.product_id, quantity: i.qty })),
        shipping_address: address,
      }
      await apiFetch('/orders', { method: 'POST', body: JSON.stringify(payload) }, token)

      try {
        await apiFetch(`/cart/clear?session_id=${encodeURIComponent(sessionId)}`, { method: 'DELETE' })
      } catch { /* best effort */ }
      onCartUpdate?.(0)

      setStep(2) // Show confirmation step
      setTimeout(() => {
        toast.success('Order placed successfully! 🎉')
        navigate('/shop/orders')
      }, 1400)
    } catch (e) {
      toast.error(e.message || 'Checkout failed. Please try again.')
    } finally {
      setPlacingOrder(false)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <Spinner size="lg" />
    </div>
  )
  if (!cart) return null

  return (
    <div className="customer-content animate-fade-in">
      <div className="customer-page">
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(167,243,208,.5)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 8, fontFamily: "'Source Sans 3', sans-serif" }}>
            Secure Checkout
          </div>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 32, fontWeight: 900, color: '#ecfdf5', marginBottom: 0 }}>
            {step === 2 ? 'Order Confirmed!' : 'Complete Your Order'}
          </h1>
        </div>

        {/* Progress bar */}
        <CheckoutProgress currentStep={step} />

        {/* Confirmation state */}
        {step === 2 ? (
          <div style={{ textAlign: 'center', padding: '60px 32px' }}>
            <div style={{ fontSize: 64, marginBottom: 16, animation: 'heartPop .5s ease' }}>🎉</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: '#34d399', marginBottom: 8 }}>
              Order placed!
            </h2>
            <p style={{ color: 'rgba(167,243,208,.6)', fontFamily: "'Source Sans 3', sans-serif", marginBottom: 24 }}>
              Redirecting to your orders…
            </p>
            <Spinner size="md" />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,340px)', gap: 32, alignItems: 'start' }}>
            {/* Form */}
            <div className="cust-card">
              <h2 style={{ fontSize: 18, color: '#d1fae5', marginBottom: 20, fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>
                Shipping Details
              </h2>
              <form onSubmit={handleCheckout} noValidate>
                <div style={{ marginBottom: 20 }}>
                  <label
                    htmlFor="checkout-address"
                    style={{ display: 'block', marginBottom: 8, fontSize: 12, color: 'rgba(167,243,208,.6)', fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', fontFamily: "'Source Sans 3', sans-serif" }}
                  >
                    Full Shipping Address
                  </label>
                  <textarea
                    id="checkout-address"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="123 Example Street, City, State, ZIP"
                    style={{
                      width: '100%', padding: 12, borderRadius: 8,
                      background: 'rgba(255,255,255,.05)',
                      border: '1px solid rgba(255,255,255,.1)',
                      color: '#fff', minHeight: 100,
                      resize: 'vertical',
                      fontFamily: "'Source Sans 3', sans-serif", fontSize: 14,
                      transition: 'border-color 180ms',
                      outline: 'none',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(52,211,153,.4)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(52,211,153,.08)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.1)'; e.currentTarget.style.boxShadow = 'none' }}
                    required
                  />
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label
                    style={{ display: 'block', marginBottom: 8, fontSize: 12, color: 'rgba(167,243,208,.6)', fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', fontFamily: "'Source Sans 3', sans-serif" }}
                  >
                    Payment Method
                  </label>
                  <div style={{ padding: 14, borderRadius: 8, background: 'rgba(16,185,129,.07)', border: '1px solid rgba(52,211,153,.25)', color: '#34d399', fontSize: 14, fontFamily: "'Source Sans 3', sans-serif", display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>💳</span>
                    Demo Card — No real charge will be made
                  </div>
                </div>

                {/* Security note */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, padding: '8px 12px', borderRadius: 6, background: 'rgba(52,211,153,.05)', border: '1px solid rgba(52,211,153,.1)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                  <span style={{ fontSize: 11, color: 'rgba(167,243,208,.5)', fontFamily: "'Source Sans 3', sans-serif" }}>
                    256-bit SSL secured. Your data is protected.
                  </span>
                </div>

                <button
                  type="submit"
                  className="cust-btn-primary cust-btn-lg"
                  style={{ width: '100%', justifyContent: 'center' }}
                  disabled={placingOrder || !cart.items?.length}
                  aria-busy={placingOrder}
                >
                  {placingOrder
                    ? <><Spinner size="sm" /> Processing…</>
                    : `Pay ₹${Number(cart.total).toFixed(2)} & Place Order`
                  }
                </button>
              </form>
            </div>

            {/* Order summary */}
            <div className="cust-card" style={{ position: 'sticky', top: 80 }}>
              <h3 style={{ fontSize: 16, color: '#d1fae5', marginBottom: 16, fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>
                Order Summary
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {cart.items.map(item => (
                  <div key={item.product_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#a7f3d0', fontSize: 13, fontFamily: "'Source Sans 3', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.name}
                      </div>
                      <div style={{ color: 'rgba(167,243,208,.35)', fontSize: 11, fontFamily: "'Source Sans 3', sans-serif" }}>
                        Qty: {item.qty}
                      </div>
                    </div>
                    <span style={{ color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: "'Source Sans 3', sans-serif", flexShrink: 0 }}>
                      ₹{Number(item.line_total).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ height: 1, background: 'rgba(255,255,255,.08)', marginBottom: 14 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800, fontSize: 20, color: '#34d399', fontFamily: "'Playfair Display', serif" }}>
                <span>Total</span>
                <span>₹{Number(cart.total).toFixed(2)}</span>
              </div>
              <div style={{ marginTop: 12, fontSize: 11, color: 'rgba(167,243,208,.3)', fontFamily: "'Source Sans 3', sans-serif", textAlign: 'center' }}>
                Including all taxes
              </div>
              <Link to="/shop/cart" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, color: 'rgba(167,243,208,.4)', fontSize: 12, textDecoration: 'none', fontFamily: "'Source Sans 3', sans-serif", transition: 'color 150ms' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'rgba(167,243,208,.7)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(167,243,208,.4)' }}
              >
                ← Edit cart
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
