import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, ArrowRight, ShoppingBag, ShieldCheck, Lock, ChevronRight, Zap } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

export const CartPage = () => {
  const { items, totalAmount, updateQuantity, removeFromCart, clearCart } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (!isAuthenticated) {
    return (
      <div style={{ backgroundColor: 'var(--color-obsidian-graphite)', minHeight: 'calc(100vh - 76px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 20px' }}>
        <div style={{ textAlign: 'center', maxWidth: '460px', backgroundColor: 'var(--color-gunmetal-dark)', padding: '44px 36px', borderRadius: '16px', border: '1px solid var(--color-border-steel)', boxShadow: '0 24px 50px rgba(0,0,0,0.6)' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--color-titanium-brushed)', border: '1px solid var(--color-border-chrome)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <ShoppingBag size={28} color="var(--color-icy-steel)" />
          </div>
          <h2 className="heading-whisper" style={{ fontSize: '24px', marginBottom: '10px', color: '#ffffff' }}>
            Please Sign In to View Your Cart
          </h2>
          <p style={{ color: 'var(--color-silver-glow)', opacity: 0.8, marginBottom: '28px', fontSize: '13px', lineHeight: 1.6 }}>
            Sign in to check out, save items to your cart, and see your saved orders.
          </p>
          <Link to="/login" className="btn-primary" style={{ display: 'inline-block', width: '100%', padding: '13px', textAlign: 'center' }}>
            Sign in to continue
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={{ backgroundColor: 'var(--color-obsidian-graphite)', minHeight: 'calc(100vh - 76px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 20px' }}>
        <div style={{ textAlign: 'center', maxWidth: '460px', backgroundColor: 'var(--color-gunmetal-dark)', padding: '44px 36px', borderRadius: '16px', border: '1px solid var(--color-border-steel)', boxShadow: '0 24px 50px rgba(0,0,0,0.6)' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--color-titanium-brushed)', border: '1px solid var(--color-border-steel)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <ShoppingBag size={28} color="var(--color-ash-label)" />
          </div>
          <h2 className="heading-whisper" style={{ fontSize: '24px', marginBottom: '10px', color: '#ffffff' }}>
            Your Shopping Cart is empty
          </h2>
          <p style={{ color: 'var(--color-silver-glow)', opacity: 0.8, marginBottom: '28px', fontSize: '13px', lineHeight: 1.6 }}>
            Your shopping cart is waiting. Check out today's deals, trending electronics, fashion, and more.
          </p>
          <Link to="/explore" className="btn-primary" style={{ display: 'inline-block', padding: '13px 28px' }}>
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: 'var(--color-obsidian-graphite)', minHeight: 'calc(100vh - 76px)', padding: '52px 0' }}>
      <div className="container">
        {/* Header Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--color-ash-label)', marginBottom: '16px' }}>
          <Link to="/" style={{ color: 'inherit' }}>Home</Link>
          <ChevronRight size={13} />
          <span style={{ color: 'var(--color-icy-steel)' }}>Shopping Cart</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '36px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 className="heading-whisper" style={{ fontSize: '32px', color: '#ffffff', letterSpacing: '0.02em', margin: 0 }}>
              Shopping Cart
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--color-silver-glow)', opacity: 0.7, marginTop: '6px' }}>
              {items.length} {items.length === 1 ? 'item' : 'items'} in your cart
            </p>
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: 'var(--radius-pills)', backgroundColor: 'var(--color-titanium-brushed)', border: '1px solid var(--color-border-steel)', fontSize: '11px', color: 'var(--color-icy-steel)', fontWeight: 600 }}>
            <ShieldCheck size={13} />
            <span>100% SECURE CHECKOUT</span>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '36px',
          alignItems: 'start'
        }}>
          {/* Cart Items List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {items.map((item) => {
              const images = Array.isArray(item.images) ? item.images : (typeof item.images === 'string' ? JSON.parse(item.images || '[]') : []);
              const img = images[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80';

              return (
                <div
                  key={item.cart_item_id}
                  style={{
                    display: 'flex',
                    gap: '22px',
                    padding: '24px',
                    borderRadius: '14px',
                    border: '1px solid var(--color-border-steel)',
                    backgroundColor: 'var(--color-gunmetal-dark)',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                    transition: 'border-color 0.2s ease',
                    position: 'relative'
                  }}
                >
                  <img
                    src={img}
                    alt={item.title}
                    style={{
                      width: '96px',
                      height: '96px',
                      borderRadius: '10px',
                      objectFit: 'contain',
                      backgroundColor: 'var(--color-obsidian-graphite)',
                      border: '1px solid var(--color-border-steel)',
                      padding: '6px'
                    }}
                  />

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <Link
                        to={`/products/${item.product_id}`}
                        style={{ fontWeight: 500, fontSize: '15px', color: '#ffffff', lineHeight: 1.3, textDecoration: 'none' }}
                      >
                        {item.title}
                      </Link>
                      <button
                        onClick={() => removeFromCart(item.cart_item_id)}
                        style={{ color: 'var(--color-ash-label)', padding: '4px', cursor: 'pointer', background: 'none', border: 'none', transition: 'color 0.15s' }}
                        title="Remove item"
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-error)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-ash-label)'}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--color-ash-label)', marginBottom: '16px' }}>
                      <span>Merchant: <strong style={{ color: 'var(--color-silver-glow)' }}>{item.store_name}</strong></span>
                      <span>•</span>
                      <span style={{ color: 'var(--color-icy-steel)' }}>Verified Stock</span>
                    </div>

                    <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {/* Metallic Stepper */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        border: '1px solid var(--color-border-steel)',
                        borderRadius: '6px',
                        backgroundColor: 'var(--color-titanium-brushed)',
                        overflow: 'hidden'
                      }}>
                        <button
                          onClick={() => updateQuantity(item.cart_item_id, item.quantity - 1)}
                          style={{ padding: '6px 12px', color: '#ffffff', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', transition: 'background 0.15s' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-slate-chrome)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          -
                        </button>
                        <span style={{ padding: '0 12px', fontSize: '13px', fontWeight: 600, color: '#ffffff', minWidth: '32px', textAlign: 'center' }}>
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.cart_item_id, item.quantity + 1)}
                          disabled={item.quantity >= item.stock_qty}
                          style={{ padding: '6px 12px', color: '#ffffff', background: 'none', border: 'none', opacity: item.quantity >= item.stock_qty ? 0.3 : 1, cursor: item.quantity >= item.stock_qty ? 'not-allowed' : 'pointer', fontSize: '14px', transition: 'background 0.15s' }}
                          onMouseEnter={(e) => { if (item.quantity < item.stock_qty) e.currentTarget.style.backgroundColor = 'var(--color-slate-chrome)'; }}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          +
                        </button>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '18px', fontWeight: 600, color: '#ffffff', letterSpacing: '0.01em' }}>
                          ₹{(parseFloat(item.price) * item.quantity).toLocaleString('en-IN')}
                        </span>
                        {item.quantity > 1 && (
                          <div style={{ fontSize: '11px', color: 'var(--color-ash-label)' }}>
                            ₹{parseFloat(item.price).toLocaleString('en-IN')} each
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px' }}>
              <button
                onClick={clearCart}
                style={{ color: 'var(--color-error)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', background: 'none', border: 'none', opacity: 0.8 }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                onMouseLeave={(e) => e.currentTarget.style.opacity = 0.8}
              >
                Clear Cart
              </button>
              <Link to="/explore" style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-icy-steel)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                Continue Shopping <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          {/* Order Summary Card */}
          <div style={{
            backgroundColor: 'var(--color-gunmetal-dark)',
            padding: '32px',
            borderRadius: '16px',
            border: '1px solid var(--color-border-steel)',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.5)',
            position: 'sticky',
            top: '88px'
          }}>
            <h3 className="heading-whisper" style={{ fontSize: '18px', color: '#ffffff', marginBottom: '22px' }}>
              Order Summary
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-silver-glow)', opacity: 0.85 }}>
                <span>Items ({items.length}):</span>
                <span style={{ color: '#ffffff', fontWeight: 500 }}>₹{totalAmount.toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-silver-glow)', opacity: 0.85 }}>
                <span>Delivery:</span>
                <span style={{ color: 'var(--color-icy-steel)', fontWeight: 600 }}>FREE</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-silver-glow)', opacity: 0.85 }}>
                <span>Taxes:</span>
                <span style={{ color: 'var(--color-ash-label)' }}>Included</span>
              </div>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              borderTop: '1px solid var(--color-border-steel)',
              paddingTop: '20px',
              marginBottom: '28px'
            }}>
              <span style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff' }}>Order Total:</span>
              <span style={{ fontSize: '26px', fontWeight: 600, color: '#ffffff', letterSpacing: '0.01em' }}>
                ₹{totalAmount.toLocaleString('en-IN')}
              </span>
            </div>

            <button
              onClick={() => navigate('/checkout')}
              className="btn-primary"
              style={{ width: '100%', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px' }}
            >
              Proceed to Buy <ArrowRight size={15} />
            </button>

            <div style={{ marginTop: '24px', padding: '14px', backgroundColor: 'var(--color-titanium-brushed)', borderRadius: '10px', border: '1px solid var(--color-border-steel)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--color-icy-steel)', fontWeight: 600 }}>
                <ShieldCheck size={14} />
                <span>Safe and Secure Payments</span>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--color-silver-glow)', opacity: 0.8, margin: 0, lineHeight: 1.5 }}>
                100% Authentic products • 7-day easy returns • Fast doorstep delivery
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
