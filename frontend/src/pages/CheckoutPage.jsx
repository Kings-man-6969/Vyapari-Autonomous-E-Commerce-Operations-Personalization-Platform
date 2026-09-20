import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, Lock, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export const CheckoutPage = () => {
  const { items, totalAmount, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [address, setAddress] = useState({
    full_name: user?.name || 'Aarav Sharma',
    phone: user?.phone || '+91 9876543221',
    line1: 'Flat 402, Lotus Orchid, Indiranagar',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560038'
  });

  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');

  if (items.length === 0) {
    return (
      <div className="container" style={{ padding: '80px 24px', textAlign: 'center' }}>
        <h2>Your cart is empty.</h2>
        <Link to="/explore" className="btn-primary" style={{ marginTop: '16px', display: 'inline-block' }}>
          Return to Explore
        </Link>
      </div>
    );
  }

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setError('');
    setPlacing(true);

    try {
      // 1. Create order with backend atomic transaction (SELECT FOR UPDATE)
      const orderPayload = {
        shipping_address: address,
        items: items.map(i => ({
          product_id: i.product_id,
          quantity: i.quantity
        }))
      };

      const orderRes = await api.post('/orders', orderPayload);
      if (!orderRes.data?.success) {
        throw new Error(orderRes.data?.error?.message || 'Failed to initialize order');
      }

      const orderId = orderRes.data.data.order_id;

      // 2. Simulate Razorpay payment confirmation
      const confirmRes = await api.post(`/orders/${orderId}/confirm-payment`, {
        razorpay_payment_id: `pay_rzp_mock_${Date.now()}`
      });

      if (confirmRes.data?.success) {
        clearCart();
        navigate(`/orders/${orderId}?success=true`);
      }
    } catch (err) {
      console.error('Order creation error:', err);
      setError(err.response?.data?.error?.message || err.message || 'Checkout failed.');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="container" style={{ padding: '40px 24px', maxWidth: '1000px' }}>
      <Link to="/cart" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
        <ArrowLeft size={16} /> Back to Cart
      </Link>

      <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, marginBottom: '32px' }}>
        Checkout & Payment
      </h1>

      {error && (
        <div style={{
          padding: '16px',
          backgroundColor: 'var(--color-error-bg)',
          color: 'var(--color-error)',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '24px',
          fontWeight: 600,
          fontSize: 'var(--font-size-sm)'
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '40px' }}>
        {/* Shipping Form */}
        <form onSubmit={handlePlaceOrder} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: '8px' }}>
            1. Shipping Address
          </h2>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '6px' }}>
              Full Name
            </label>
            <input
              type="text"
              required
              value={address.full_name}
              onChange={(e) => setAddress({ ...address, full_name: e.target.value })}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border-subtle)',
                fontSize: 'var(--font-size-sm)'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '6px' }}>
              Phone Number
            </label>
            <input
              type="tel"
              required
              value={address.phone}
              onChange={(e) => setAddress({ ...address, phone: e.target.value })}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border-subtle)',
                fontSize: 'var(--font-size-sm)'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '6px' }}>
              Street Address & Landmark
            </label>
            <input
              type="text"
              required
              value={address.line1}
              onChange={(e) => setAddress({ ...address, line1: e.target.value })}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border-subtle)',
                fontSize: 'var(--font-size-sm)'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '6px' }}>
                City
              </label>
              <input
                type="text"
                required
                value={address.city}
                onChange={(e) => setAddress({ ...address, city: e.target.value })}
                style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)', fontSize: 'var(--font-size-sm)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '6px' }}>
                State
              </label>
              <input
                type="text"
                required
                value={address.state}
                onChange={(e) => setAddress({ ...address, state: e.target.value })}
                style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)', fontSize: 'var(--font-size-sm)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '6px' }}>
                Pincode
              </label>
              <input
                type="text"
                required
                value={address.pincode}
                onChange={(e) => setAddress({ ...address, pincode: e.target.value })}
                style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)', fontSize: 'var(--font-size-sm)' }}
              />
            </div>
          </div>

          {/* Payment Section */}
          <div style={{ marginTop: '24px' }}>
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: '12px' }}>
              2. Payment Method
            </h2>
            <div style={{
              padding: '16px',
              border: '2px solid var(--color-primary)',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--color-primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
                  Razorpay Payment Gateway (Test Mode)
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  INR Native • UPI, Cards, Netbanking (Simulated)
                </div>
              </div>
              <CheckCircle2 size={20} color="var(--color-primary)" />
            </div>
          </div>

          <button
            type="submit"
            disabled={placing}
            className="btn-primary"
            style={{
              marginTop: '24px',
              padding: '16px',
              fontSize: 'var(--font-size-base)',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Lock size={18} />
            {placing ? 'Authorizing Payment & Locking Stock...' : `Pay ₹${totalAmount.toLocaleString('en-IN')}`}
          </button>
        </form>

        {/* Order Review Column */}
        <div style={{
          backgroundColor: 'var(--color-surface-subtle)',
          padding: '24px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border-subtle)',
          height: 'fit-content'
        }}>
          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, marginBottom: '16px' }}>
            Items in Order ({items.length})
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            {items.map((i) => (
              <div key={i.cart_item_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
                <span style={{ color: 'var(--color-text-secondary)', flex: 1, paddingRight: '12px' }}>
                  {i.quantity}x {i.title}
                </span>
                <span style={{ fontWeight: 600 }}>
                  ₹{(parseFloat(i.price) * i.quantity).toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 'var(--font-size-lg)' }}>
            <span>Total Payable</span>
            <span style={{ color: 'var(--color-primary)' }}>₹{totalAmount.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
