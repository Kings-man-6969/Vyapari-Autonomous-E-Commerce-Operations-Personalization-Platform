import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, ArrowRight, ShoppingBag, ShieldCheck } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

export const CartPage = () => {
  const { items, totalAmount, updateQuantity, removeFromCart, clearCart } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (!isAuthenticated) {
    return (
      <div className="container" style={{ padding: '80px 24px', textAlign: 'center', maxWidth: '500px' }}>
        <ShoppingBag size={48} color="var(--color-primary)" style={{ marginBottom: '16px' }} />
        <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, marginBottom: '12px' }}>
          Please log in to view your cart
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px', fontSize: 'var(--font-size-sm)' }}>
          Items added to your cart are synced safely to your personal account.
        </p>
        <Link to="/login" className="btn-primary" style={{ display: 'inline-block' }}>
          Log in to continue
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container" style={{ padding: '80px 24px', textAlign: 'center', maxWidth: '500px' }}>
        <ShoppingBag size={48} color="var(--color-text-muted)" style={{ marginBottom: '16px' }} />
        <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, marginBottom: '12px' }}>
          Your cart is empty
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px', fontSize: 'var(--font-size-sm)' }}>
          Explore our marketplace to discover curated lifestyle and tech essentials.
        </p>
        <Link to="/explore" className="btn-primary" style={{ display: 'inline-block' }}>
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '40px 24px' }}>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, marginBottom: '32px' }}>
        Shopping Cart ({items.length} {items.length === 1 ? 'item' : 'items'})
      </h1>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '40px',
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
                  gap: '20px',
                  padding: '20px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-card)',
                  backgroundColor: '#ffffff',
                  boxShadow: 'var(--shadow-xs)'
                }}
              >
                <img
                  src={img}
                  alt={item.title}
                  style={{
                    width: '100px',
                    height: '100px',
                    borderRadius: 'var(--radius-sm)',
                    objectFit: 'cover'
                  }}
                />

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <Link
                      to={`/products/${item.product_id}`}
                      style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}
                    >
                      {item.title}
                    </Link>
                    <button
                      onClick={() => removeFromCart(item.cart_item_id)}
                      style={{ color: 'var(--color-text-muted)', padding: '4px' }}
                      title="Remove item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                    Sold by {item.store_name}
                  </span>

                  <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      border: '1px solid var(--color-border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '2px 6px'
                    }}>
                      <button
                        onClick={() => updateQuantity(item.cart_item_id, item.quantity - 1)}
                        style={{ padding: '4px 8px', fontWeight: 700 }}
                      >
                        -
                      </button>
                      <span style={{ padding: '0 8px', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.cart_item_id, item.quantity + 1)}
                        disabled={item.quantity >= item.stock_qty}
                        style={{ padding: '4px 8px', fontWeight: 700, opacity: item.quantity >= item.stock_qty ? 0.4 : 1 }}
                      >
                        +
                      </button>
                    </div>

                    <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 700 }}>
                      ₹{(parseFloat(item.price) * item.quantity).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '16px' }}>
            <button onClick={clearCart} style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
              Clear Entire Cart
            </button>
            <Link to="/explore" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-primary)' }}>
              Continue Shopping →
            </Link>
          </div>
        </div>

        {/* Order Summary Card */}
        <div style={{
          backgroundColor: 'var(--color-surface-subtle)',
          padding: '28px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border-subtle)'
        }}>
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: '20px' }}>
            Order Summary
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px', fontSize: 'var(--font-size-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Subtotal</span>
              <span style={{ fontWeight: 600 }}>₹{totalAmount.toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Estimated Shipping</span>
              <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>FREE</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Estimated Tax</span>
              <span style={{ fontWeight: 600 }}>Included</span>
            </div>
            <div style={{
              borderTop: '1px solid var(--color-border-subtle)',
              paddingTop: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 'var(--font-size-lg)',
              fontWeight: 800
            }}>
              <span>Total</span>
              <span style={{ color: 'var(--color-primary)' }}>₹{totalAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <button
            onClick={() => navigate('/checkout')}
            className="btn-primary"
            style={{ width: '100%', padding: '14px', fontSize: 'var(--font-size-base)' }}
          >
            Proceed to Checkout <ArrowRight size={18} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginTop: '16px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            <ShieldCheck size={16} color="var(--color-success)" />
            <span>Secure Razorpay test transaction with stock lock</span>
          </div>
        </div>
      </div>
    </div>
  );
};
