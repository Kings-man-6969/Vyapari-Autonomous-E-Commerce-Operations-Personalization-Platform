import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../services/api';
import { useToast } from '../../shared/hooks/useToast';
import { SpinnerPage } from '../../shared/components/Spinner';
import '../../customer.css';

/* ─── helpers ─────────────────────────────────────────────────── */
const fmt = (n) => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0 });

const CATEGORY_EMOJI = {
  Electronics:     '⚡',
  Clothing:        '👗',
  Books:           '📚',
  'Home & Kitchen':'🏠',
  Sports:          '🏃',
};

/* ─── design tokens ────────────────────────────────────────────── */
const FONT = "'Inter', sans-serif";
const FF   = '"ss03"';

const CARD_SHADOW = [
  '0 8px 8px rgba(0,0,0,0.08)',
  '0 4px 4px rgba(0,0,0,0.07)',
  '0 2px 2px rgba(0,0,0,0.06)',
  '0 0 0 1px rgba(0,0,0,0.06)',
].join(', ');

const LVL3_SHADOW = [
  '0 4px 16px rgba(0,0,0,0.08)',
  '0 2px 6px rgba(0,0,0,0.06)',
  '0 0 0 1px rgba(0,0,0,0.05)',
].join(', ');

/* ─── component ────────────────────────────────────────────────── */
export default function CustomerCart({ sessionId, token, onCartChange }) {
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [cart, setCart]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  async function fetchCart() {
    setLoading(true);
    try {
      const data = await apiFetch(`/cart?session_id=${sessionId}`);
      setCart(data);
    } catch {
      setCart({ items: [] });
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchCart(); }, [sessionId]);

  async function updateQty(item, newQty) {
    if (newQty < 1) return handleRemove(item);
    setUpdatingId(item.product_id);
    try {
      await apiFetch(`/cart/item/${item.cart_item_id}?session_id=${sessionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ qty: newQty }),
      });
      await fetchCart();
      onCartChange?.();
    } catch (err) {
      showToast(err.message || 'Failed to update', 'error');
    } finally { setUpdatingId(null); }
  }

  async function handleRemove(item) {
    setUpdatingId(item.product_id);
    try {
      await apiFetch(`/cart/item/${item.cart_item_id}?session_id=${sessionId}`, { method: 'DELETE' });
      await fetchCart();
      onCartChange?.();
      showToast('Item removed', 'info');
    } catch (err) {
      showToast(err.message || 'Failed to remove', 'error');
    } finally { setUpdatingId(null); }
  }

  if (loading) return (
    <div style={{ background: '#fbfbf5', minHeight: '100vh' }}>
      <SpinnerPage />
    </div>
  );

  const items    = cart?.items || [];
  const subtotal = cart?.total ?? items.reduce((s, i) => s + (i.price || 0) * (i.qty || i.quantity || 1), 0);

  /* ── empty state ──────────────────────────────────────────────── */
  if (items.length === 0) {
    return (
      <div style={{
        background: '#fbfbf5', minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '60px 24px',
        fontFamily: FONT, fontFeatureSettings: FF,
      }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: '4rem', marginBottom: 20 }}>🛒</div>
          <h2 style={{
            fontSize: 28, fontWeight: 300, color: '#000',
            marginBottom: 12, letterSpacing: '-0.5px', lineHeight: 1.2,
            fontFamily: FONT, fontFeatureSettings: FF,
          }}>
            Your cart is empty
          </h2>
          <p style={{
            color: '#71717a', fontSize: 15, marginBottom: 32, lineHeight: 1.6,
            fontFamily: FONT, fontFeatureSettings: FF,
          }}>
            Looks like you haven't added anything yet.
          </p>
          <Link
            to="/shop"
            style={{
              display: 'inline-block', padding: '14px 28px',
              background: '#000000', color: '#fff',
              borderRadius: 9999, fontWeight: 420, fontSize: 15,
              textDecoration: 'none',
              fontFamily: FONT, fontFeatureSettings: FF,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  /* ── filled cart ──────────────────────────────────────────────── */
  return (
    <div style={{
      background: '#fbfbf5', minHeight: '100vh',
      padding: '56px 24px 80px',
      fontFamily: FONT, fontFeatureSettings: FF,
    }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>

        {/* Page heading */}
        <h1 style={{
          fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 500,
          color: '#000', letterSpacing: '-0.5px', marginBottom: 36,
          fontFamily: FONT, fontFeatureSettings: FF,
        }}>
          Your Cart
          <span style={{
            fontSize: 14, fontWeight: 400, color: '#71717a',
            marginLeft: 12, verticalAlign: 'middle',
            fontFamily: FONT, fontFeatureSettings: FF,
          }}>
            ({items.length} {items.length === 1 ? 'item' : 'items'})
          </span>
        </h1>

        {/* Two-column grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(300px, 2fr) minmax(280px, 1fr)',
          gap: 32, alignItems: 'start',
        }}>

          {/* ── Cart items card ──────────────────────────────────── */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e4e4e7',
            borderRadius: 12,
            boxShadow: CARD_SHADOW,
            overflow: 'hidden',
          }}>
            {items.map((item, idx) => {
              const isUpdating = updatingId === item.product_id;
              const emoji      = CATEGORY_EMOJI[item.category] || '📦';
              const itemQty    = item.qty || item.quantity || 1;
              const lineTotal  = item.subtotal ?? ((item.price || 0) * itemQty);

              return (
                <div
                  key={item.cart_item_id || item.product_id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 20,
                    padding: '20px 24px',
                    borderTop: idx === 0 ? 'none' : '1px solid #e4e4e7',
                    opacity: isUpdating ? 0.5 : 1,
                    transition: 'opacity 0.2s',
                  }}
                >
                  {/* Thumbnail */}
                  <div
                    onClick={() => navigate(`/shop/product/${item.product_id}`)}
                    style={{
                      width: 80, height: 80, borderRadius: 8,
                      background: '#f4f4f5',
                      border: '1px solid #e4e4e7',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, cursor: 'pointer', overflow: 'hidden',
                    }}
                  >
                    {item.image_url && item.image_url.startsWith('http') ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span style={{ fontSize: '2rem' }}>{emoji}</span>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      onClick={() => navigate(`/shop/product/${item.product_id}`)}
                      style={{
                        fontSize: 15, fontWeight: 500, color: '#000',
                        marginBottom: 4, cursor: 'pointer',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        fontFamily: FONT, fontFeatureSettings: FF,
                      }}
                    >
                      {item.name}
                    </div>
                    <div style={{
                      fontSize: 14, fontWeight: 500, color: '#000',
                      marginBottom: 12,
                      fontFamily: FONT, fontFeatureSettings: FF,
                    }}>
                      {fmt(item.price)}{' '}
                      <span style={{ fontWeight: 400, color: '#71717a', fontSize: 12 }}>each</span>
                    </div>

                    {/* Qty + Remove */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      {/* Stepper */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          onClick={() => updateQty(item, itemQty - 1)}
                          disabled={isUpdating}
                          style={{
                            width: 32, height: 32, borderRadius: 9999,
                            border: '1px solid #e4e4e7', background: 'transparent',
                            color: '#000', fontSize: 16, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: FONT, lineHeight: 1,
                          }}
                        >
                          −
                        </button>
                        <span style={{
                          minWidth: 28, textAlign: 'center',
                          fontSize: 14, fontWeight: 500, color: '#000',
                          fontFamily: FONT, fontFeatureSettings: FF,
                        }}>
                          {itemQty}
                        </span>
                        <button
                          onClick={() => updateQty(item, itemQty + 1)}
                          disabled={isUpdating}
                          style={{
                            width: 32, height: 32, borderRadius: 9999,
                            border: '1px solid #e4e4e7', background: 'transparent',
                            color: '#000', fontSize: 16, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: FONT, lineHeight: 1,
                          }}
                        >
                          +
                        </button>
                      </div>

                      {/* Remove */}
                      <button
                        onClick={() => handleRemove(item)}
                        disabled={isUpdating}
                        style={{
                          fontSize: 13, color: '#71717a',
                          background: 'transparent', border: 'none',
                          cursor: 'pointer', padding: 0,
                          fontFamily: FONT, fontFeatureSettings: FF,
                          transition: 'color 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = '#000'}
                        onMouseLeave={e => e.currentTarget.style.color = '#71717a'}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {/* Line total */}
                  <div style={{
                    fontSize: 15, fontWeight: 500, color: '#000',
                    flexShrink: 0, minWidth: 72, textAlign: 'right',
                    fontFamily: FONT, fontFeatureSettings: FF,
                  }}>
                    {fmt(lineTotal)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Order Summary sidebar ────────────────────────────── */}
          <div style={{
            position: 'sticky', top: 100,
            background: '#c1fbd4',
            borderRadius: 12,
            padding: 32,
            boxShadow: LVL3_SHADOW,
          }}>
            <h3 style={{
              fontSize: 16, fontWeight: 500, color: '#000',
              marginBottom: 24, letterSpacing: '-0.3px',
              fontFamily: FONT, fontFeatureSettings: FF,
            }}>
              Order Summary
            </h3>

            {/* Subtotal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 14, color: '#000', fontWeight: 500, fontFamily: FONT, fontFeatureSettings: FF }}>
                Subtotal
              </span>
              <span style={{ fontSize: 14, fontWeight: 500, color: '#000', fontFamily: FONT, fontFeatureSettings: FF }}>
                {fmt(subtotal)}
              </span>
            </div>

            {/* Delivery */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ fontSize: 14, color: '#000', fontWeight: 500, fontFamily: FONT, fontFeatureSettings: FF }}>
                Delivery
              </span>
              <span style={{ fontSize: 14, fontWeight: 500, color: '#000', fontFamily: FONT, fontFeatureSettings: FF }}>
                Free
              </span>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'rgba(0,0,0,0.08)', marginBottom: 20 }} />

            {/* Total */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              marginBottom: 28,
            }}>
              <span style={{ fontSize: 16, fontWeight: 500, color: '#000', fontFamily: FONT, fontFeatureSettings: FF }}>
                Total
              </span>
              <span style={{ fontSize: 22, fontWeight: 500, color: '#000', fontFamily: FONT, fontFeatureSettings: FF }}>
                {fmt(subtotal)}
              </span>
            </div>

            {/* Checkout CTA */}
            <button
              onClick={() => navigate('/shop/checkout')}
              style={{
                width: '100%', padding: '14px 24px',
                borderRadius: 9999, border: 'none',
                background: '#000000', color: '#fff',
                fontSize: 15, fontWeight: 420, cursor: 'pointer',
                fontFamily: FONT, fontFeatureSettings: FF,
                transition: 'opacity 0.15s',
                letterSpacing: '-0.1px',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              Proceed to Checkout →
            </button>

            {/* Continue shopping */}
            <Link
              to="/shop/products"
              style={{
                display: 'block', textAlign: 'center', marginTop: 18,
                fontSize: 13, color: '#71717a', textDecoration: 'none',
                fontFamily: FONT, fontFeatureSettings: FF,
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#000'}
              onMouseLeave={e => e.currentTarget.style.color = '#71717a'}
            >
              ← Continue Shopping
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
