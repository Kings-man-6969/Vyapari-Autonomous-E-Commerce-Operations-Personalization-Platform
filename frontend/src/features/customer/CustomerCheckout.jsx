import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../services/api';
import { useToast } from '../../shared/hooks/useToast';
import { SpinnerPage } from '../../shared/components/Spinner';
import '../../customer.css';

/* ─── DESIGN.MD — Transactional Track (Checkout) ───
   Canvas: #fbfbf5 cream
   Form card: #ffffff white, hairline border, rounded-lg 12px
   Summary card: #c1fbd4 aloe, Level-3 stacked shadows
   Buttons: button-primary-pill (solid black pill)
   Inputs: text-input spec (white bg, hairline border, rounded-md 8px)
───────────────────────────────────────────────────── */

const fmt = (n) => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0 });

const FONT = "'Inter Variable', Inter, Helvetica, Arial, sans-serif";
const FF = '"ss03"';

export default function CustomerCheckout({ sessionId, token, onCartChange }) {
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [success, setSuccess] = useState(null);

  // Shipping form
  const [form, setForm] = useState({
    name: '', street: '', city: '', state: '', pincode: '', phone: '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    apiFetch(`/cart?session_id=${sessionId}`)
      .then(d => setCart(d))
      .catch(() => setCart({ items: [] }))
      .finally(() => setLoading(false));
  }, [sessionId]);

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.street.trim()) e.street = 'Address is required';
    if (!form.city.trim()) e.city = 'City is required';
    if (!form.state.trim()) e.state = 'State is required';
    if (!form.pincode.trim() || !/^\d{6}$/.test(form.pincode)) {
      e.pincode = 'Valid 6-digit pincode required';
    }
    if (!form.phone.trim() || !/^\d{10}$/.test(form.phone)) {
      e.phone = 'Valid 10-digit phone required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handlePlaceOrder(e) {
    e.preventDefault();
    if (!validate()) return;
    setPlacing(true);
    try {
      const items = (cart?.items || []).map(i => ({
        product_id: i.product_id,
        quantity: i.quantity || 1,
      }));
      const data = await apiFetch('/orders', {
        method: 'POST',
        body: JSON.stringify({
          session_id: sessionId,
          items,
          shipping_address: {
            name: form.name,
            street: form.street,
            city: form.city,
            state: form.state,
            pincode: form.pincode,
            phone: form.phone,
          },
          payment_method: 'cash_on_delivery',
        }),
      });
      setSuccess(data);
      onCartChange?.();
    } catch (err) {
      showToast(err.message || 'Failed to place order', 'error');
    } finally { setPlacing(false); }
  }

  function setField(key, val) {
    setForm(f => ({ ...f, [key]: val }));
    setErrors(e => ({ ...e, [key]: '' }));
  }

  if (loading) {
    return (
      <div style={{ background: '#fbfbf5', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <SpinnerPage />
      </div>
    );
  }

  const items = cart?.items || [];
  const subtotal = items.reduce((s, i) => s + (i.price || 0) * (i.quantity || 1), 0);

  /* ── Success State ── */
  if (success) {
    return (
      <div style={{
        background: '#fbfbf5',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: FONT,
        fontFeatureSettings: FF,
      }}>
        <div style={{
          background: '#ffffff',
          border: '1px solid #e4e4e7',
          borderRadius: 12,
          padding: 48,
          textAlign: 'center',
          maxWidth: 480,
          width: '100%',
          boxShadow: '0 8px 8px rgba(0,0,0,0.08), 0 4px 4px rgba(0,0,0,0.07), 0 2px 2px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)',
        }}>
          <h1 style={{
            fontSize: 32,
            fontWeight: 300,
            color: '#000000',
            marginBottom: 12,
            lineHeight: 1.2,
            fontFeatureSettings: FF,
          }}>
            Order placed!
          </h1>

          <p style={{
            fontSize: 16,
            fontWeight: 420,
            color: '#71717a',
            marginBottom: 32,
            lineHeight: 1.5,
            fontFeatureSettings: FF,
          }}>
            Thank you — we'll get your order delivered soon.
          </p>

          <div style={{ marginBottom: 40 }}>
            <div style={{
              fontSize: 11,
              fontWeight: 400,
              color: '#71717a',
              textTransform: 'uppercase',
              letterSpacing: '0.72px',
              marginBottom: 8,
              fontFeatureSettings: FF,
            }}>
              Order ID
            </div>
            <span style={{
              display: 'inline-block',
              background: '#c1fbd4',
              color: '#000000',
              borderRadius: 9999,
              padding: '6px 16px',
              fontSize: 14,
              fontWeight: 500,
              fontFeatureSettings: FF,
            }}>
              {success.order_id || success.id || '—'}
            </span>
          </div>

          <button
            onClick={() => navigate('/shop/orders')}
            style={{
              width: '100%',
              background: '#000000',
              color: '#ffffff',
              border: 'none',
              borderRadius: 9999,
              padding: '14px 24px',
              fontSize: 15,
              fontWeight: 420,
              cursor: 'pointer',
              transition: 'background 0.18s',
              fontFamily: FONT,
              fontFeatureSettings: FF,
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#3f3f46'}
            onMouseLeave={e => e.currentTarget.style.background = '#000000'}
          >
            View my orders
          </button>
        </div>
      </div>
    );
  }

  /* ── Empty Cart ── */
  if (items.length === 0) {
    return (
      <div style={{
        background: '#fbfbf5',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: FONT,
        fontFeatureSettings: FF,
      }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🛒</div>
        <div style={{
          fontSize: 22,
          fontWeight: 300,
          color: '#000000',
          marginBottom: 24,
          fontFeatureSettings: FF,
        }}>
          Your cart is empty
        </div>
        <Link to="/shop" style={{
          display: 'inline-block',
          background: '#000000',
          color: '#ffffff',
          borderRadius: 9999,
          padding: '12px 28px',
          fontSize: 15,
          fontWeight: 420,
          textDecoration: 'none',
          fontFamily: FONT,
          fontFeatureSettings: FF,
        }}>
          Shop now
        </Link>
      </div>
    );
  }

  /* ── Main Checkout Form ── */
  return (
    <div style={{
      background: '#fbfbf5',
      minHeight: '100vh',
      padding: '48px 24px 80px',
      fontFamily: FONT,
      fontFeatureSettings: FF,
    }}>
      <style>{`
        .cc-grid {
          display: grid;
          grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
          gap: 40px;
          align-items: start;
        }
        @media (max-width: 768px) {
          .cc-grid { grid-template-columns: 1fr; gap: 24px; }
          .cc-summary { position: static !important; }
        }
      `}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Page heading — display-md 300w */}
        <h1 style={{
          fontSize: 'clamp(2rem, 5vw, 48px)',
          fontWeight: 300,
          color: '#000000',
          marginBottom: 32,
          lineHeight: 1.14,
          fontFeatureSettings: FF,
        }}>
          Checkout
        </h1>

        <form onSubmit={handlePlaceOrder} noValidate>
          <div className="cc-grid">

            {/* Left: Shipping + Payment */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* Shipping card */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #e4e4e7',
                borderRadius: 12,
                padding: 32,
                boxShadow: '0 2px 2px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
              }}>
                <h2 style={{
                  fontSize: 18,
                  fontWeight: 500,
                  color: '#000000',
                  marginBottom: 24,
                  lineHeight: 1.4,
                  fontFeatureSettings: FF,
                }}>
                  Shipping address
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  {/* Full name */}
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={labelStyle}>Full name</label>
                    <input
                      style={inputStyle(!!errors.name)}
                      value={form.name}
                      onChange={e => setField('name', e.target.value)}
                      placeholder="Priya Sharma"
                      autoComplete="name"
                      onFocus={e => e.target.style.borderColor = '#000000'}
                      onBlur={e => e.target.style.borderColor = errors.name ? '#991b1b' : '#e4e4e7'}
                    />
                    {errors.name && <div style={errorStyle}>{errors.name}</div>}
                  </div>

                  {/* Street */}
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={labelStyle}>Street address</label>
                    <input
                      style={inputStyle(!!errors.street)}
                      value={form.street}
                      onChange={e => setField('street', e.target.value)}
                      placeholder="42 Marine Drive, Apt 3B"
                      autoComplete="street-address"
                      onFocus={e => e.target.style.borderColor = '#000000'}
                      onBlur={e => e.target.style.borderColor = errors.street ? '#991b1b' : '#e4e4e7'}
                    />
                    {errors.street && <div style={errorStyle}>{errors.street}</div>}
                  </div>

                  {/* City */}
                  <div>
                    <label style={labelStyle}>City</label>
                    <input
                      style={inputStyle(!!errors.city)}
                      value={form.city}
                      onChange={e => setField('city', e.target.value)}
                      placeholder="Mumbai"
                      autoComplete="address-level2"
                      onFocus={e => e.target.style.borderColor = '#000000'}
                      onBlur={e => e.target.style.borderColor = errors.city ? '#991b1b' : '#e4e4e7'}
                    />
                    {errors.city && <div style={errorStyle}>{errors.city}</div>}
                  </div>

                  {/* State */}
                  <div>
                    <label style={labelStyle}>State</label>
                    <input
                      style={inputStyle(!!errors.state)}
                      value={form.state}
                      onChange={e => setField('state', e.target.value)}
                      placeholder="Maharashtra"
                      autoComplete="address-level1"
                      onFocus={e => e.target.style.borderColor = '#000000'}
                      onBlur={e => e.target.style.borderColor = errors.state ? '#991b1b' : '#e4e4e7'}
                    />
                    {errors.state && <div style={errorStyle}>{errors.state}</div>}
                  </div>

                  {/* Pincode */}
                  <div>
                    <label style={labelStyle}>Pincode</label>
                    <input
                      style={inputStyle(!!errors.pincode)}
                      value={form.pincode}
                      onChange={e => setField('pincode', e.target.value)}
                      placeholder="400001"
                      maxLength={6}
                      inputMode="numeric"
                      autoComplete="postal-code"
                      onFocus={e => e.target.style.borderColor = '#000000'}
                      onBlur={e => e.target.style.borderColor = errors.pincode ? '#991b1b' : '#e4e4e7'}
                    />
                    {errors.pincode && <div style={errorStyle}>{errors.pincode}</div>}
                  </div>

                  {/* Phone */}
                  <div>
                    <label style={labelStyle}>Phone</label>
                    <input
                      style={inputStyle(!!errors.phone)}
                      value={form.phone}
                      onChange={e => setField('phone', e.target.value)}
                      placeholder="9876543210"
                      maxLength={10}
                      inputMode="tel"
                      autoComplete="tel"
                      onFocus={e => e.target.style.borderColor = '#000000'}
                      onBlur={e => e.target.style.borderColor = errors.phone ? '#991b1b' : '#e4e4e7'}
                    />
                    {errors.phone && <div style={errorStyle}>{errors.phone}</div>}
                  </div>
                </div>
              </div>

              {/* Payment method card */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #e4e4e7',
                borderRadius: 12,
                padding: 32,
                boxShadow: '0 2px 2px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
              }}>
                <h2 style={{
                  fontSize: 18,
                  fontWeight: 500,
                  color: '#000000',
                  marginBottom: 20,
                  lineHeight: 1.4,
                  fontFeatureSettings: FF,
                }}>
                  Payment method
                </h2>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    border: '1px solid #000000',
                    borderRadius: 9999,
                    padding: '8px 16px',
                    background: '#fbfbf5',
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#000000',
                    fontFeatureSettings: FF,
                  }}>
                    <span style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#000000',
                      flexShrink: 0,
                    }} />
                    Cash on delivery
                  </span>
                  <span style={{
                    fontSize: 13,
                    color: '#71717a',
                    fontWeight: 420,
                    fontFeatureSettings: FF,
                  }}>
                    Pay when your order arrives
                  </span>
                </div>
              </div>

            </div>

            {/* Right: Order summary card (card-pricing-featured in aloe) */}
            <div className="cc-summary" style={{ position: 'sticky', top: 88 }}>
              <div style={{
                background: '#c1fbd4',
                borderRadius: 12,
                padding: 32,
                boxShadow: '0 8px 8px rgba(0,0,0,0.08), 0 4px 4px rgba(0,0,0,0.07), 0 2px 2px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.06)',
              }}>
                <h3 style={{
                  fontSize: 18,
                  fontWeight: 500,
                  color: '#000000',
                  marginBottom: 24,
                  lineHeight: 1.4,
                  fontFeatureSettings: FF,
                }}>
                  Order summary
                </h3>

                {/* Items list */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {items.map((item, idx) => (
                    <div
                      key={item.product_id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 12,
                        padding: '12px 0',
                        borderBottom: idx < items.length - 1 ? '1px solid rgba(0,0,0,0.08)' : 'none',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 14,
                          fontWeight: 420,
                          color: '#000000',
                          lineHeight: 1.4,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontFeatureSettings: FF,
                        }}>
                          {item.name}
                        </div>
                        <div style={{
                          fontSize: 12,
                          fontWeight: 400,
                          color: '#52525b',
                          marginTop: 2,
                          fontFeatureSettings: FF,
                        }}>
                          Qty: {item.quantity || 1}
                        </div>
                      </div>
                      <div style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#000000',
                        whiteSpace: 'nowrap',
                        fontFeatureSettings: FF,
                      }}>
                        {fmt((item.price || 0) * (item.quantity || 1))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: 'rgba(0,0,0,0.08)', margin: '16px 0' }} />

                {/* Totals */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 14,
                    fontWeight: 420,
                    color: '#000000',
                    fontFeatureSettings: FF,
                  }}>
                    <span>Subtotal</span>
                    <span>{fmt(subtotal)}</span>
                  </div>

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 14,
                    fontWeight: 420,
                    color: '#000000',
                    fontFeatureSettings: FF,
                  }}>
                    <span>Delivery</span>
                    <span>Free</span>
                  </div>

                  <div style={{ height: 1, background: 'rgba(0,0,0,0.08)', margin: '4px 0' }} />

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 18,
                    fontWeight: 500,
                    color: '#000000',
                    fontFeatureSettings: FF,
                  }}>
                    <span>Total</span>
                    <span>{fmt(subtotal)}</span>
                  </div>
                </div>

                {/* Place Order CTA — button-primary-pill */}
                <button
                  type="submit"
                  disabled={placing}
                  style={{
                    width: '100%',
                    background: placing ? '#3f3f46' : '#000000',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 9999,
                    padding: '14px 24px',
                    fontSize: 15,
                    fontWeight: 420,
                    cursor: placing ? 'wait' : 'pointer',
                    transition: 'background 0.18s',
                    lineHeight: 1.5,
                    fontFamily: FONT,
                    fontFeatureSettings: FF,
                  }}
                  onMouseEnter={e => { if (!placing) e.currentTarget.style.background = '#3f3f46'; }}
                  onMouseLeave={e => { if (!placing) e.currentTarget.style.background = '#000000'; }}
                >
                  {placing ? 'Placing order…' : `Place order · ${fmt(subtotal)}`}
                </button>

              </div>
            </div>

          </div>
        </form>
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: 12,
  fontWeight: 400,
  color: '#71717a',
  textTransform: 'uppercase',
  letterSpacing: '0.72px',
  lineHeight: 1.2,
  marginBottom: 6,
  fontFamily: FONT,
  fontFeatureSettings: FF,
};

const inputStyle = (hasError) => ({
  width: '100%',
  background: '#ffffff',
  border: `1px solid ${hasError ? '#991b1b' : '#e4e4e7'}`,
  borderRadius: 8,
  padding: '10px 12px',
  color: '#000000',
  fontSize: 16,
  fontWeight: 420,
  fontFamily: FONT,
  fontFeatureSettings: FF,
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
});

const errorStyle = {
  fontSize: 12,
  color: '#991b1b',
  marginTop: 4,
  fontFamily: FONT,
  fontFeatureSettings: FF,
};
