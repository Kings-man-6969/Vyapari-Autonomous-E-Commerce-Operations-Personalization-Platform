import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, Lock, ArrowLeft, CheckCircle2, CreditCard, ShoppingBag, Zap, ChevronRight } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export const CheckoutPage = () => {
  const { items, totalAmount, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [address, setAddress] = useState({
    full_name: user?.name || '',
    phone: user?.phone || '',
    line1: '',
    city: '',
    state: '',
    pincode: ''
  });

  useEffect(() => {
    const fetchSavedAddress = async () => {
      try {
        const res = await api.get('/users/addresses');
        if (res.data?.success && res.data.data?.length > 0) {
          const def = res.data.data.find(a => a.is_default) || res.data.data[0];
          setAddress({
            full_name: def.full_name || user?.name || '',
            phone: def.phone || user?.phone || '',
            line1: def.line1 || '',
            city: def.city || '',
            state: def.state || '',
            pincode: def.pincode || ''
          });
        } else if (user?.name || user?.phone) {
          setAddress(prev => ({
            ...prev,
            full_name: prev.full_name || user?.name || '',
            phone: prev.phone || user?.phone || ''
          }));
        }
      } catch (e) {
        // user may not have saved address
      }
    };
    if (user) fetchSavedAddress();
  }, [user]);

  const [paymentMethod, setPaymentMethod] = useState('simulated_card');
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');

  if (items.length === 0) {
    return (
      <div style={{ backgroundColor: 'var(--color-obsidian-graphite)', minHeight: 'calc(100vh - 76px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 20px' }}>
        <div style={{ textAlign: 'center', maxWidth: '440px', backgroundColor: 'var(--color-gunmetal-dark)', padding: '40px', borderRadius: '16px', border: '1px solid var(--color-border-steel)' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'var(--color-titanium-brushed)', border: '1px solid var(--color-border-steel)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <ShoppingBag size={28} color="var(--color-ash-label)" />
          </div>
          <h2 className="heading-whisper" style={{ fontSize: '22px', marginBottom: '8px', color: '#ffffff' }}>Your Cart is Empty</h2>
          <p style={{ color: 'var(--color-silver-glow)', opacity: 0.8, fontSize: '13px', marginBottom: '24px' }}>
            Add items to your cart before proceeding to checkout.
          </p>
          <Link to="/explore" className="btn-primary" style={{ display: 'inline-block', padding: '12px 24px' }}>
            Continue Shopping
          </Link>
        </div>
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
    <div style={{ backgroundColor: 'var(--color-obsidian-graphite)', minHeight: 'calc(100vh - 76px)', padding: '48px 0' }}>
      <div className="container" style={{ maxWidth: '1100px' }}>
        <Link to="/cart" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-silver-glow)', marginBottom: '24px', opacity: 0.8 }}>
          <ArrowLeft size={14} /> Back to Cart
        </Link>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 className="heading-whisper" style={{ fontSize: '32px', color: '#ffffff', letterSpacing: '0.02em', margin: 0 }}>
              Checkout
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--color-silver-glow)', opacity: 0.7, marginTop: '6px' }}>
              Review your address and payment details to place your order
            </p>
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: 'var(--radius-pills)', backgroundColor: 'var(--color-titanium-brushed)', border: '1px solid var(--color-border-steel)', fontSize: '11px', color: 'var(--color-icy-steel)', fontWeight: 600 }}>
            <ShieldCheck size={13} />
            <span>100% SECURE CHECKOUT</span>
          </div>
        </div>

        {error && (
          <div style={{
            padding: '14px 18px',
            backgroundColor: 'rgba(244, 63, 94, 0.12)',
            color: 'var(--color-error)',
            borderRadius: '10px',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            marginBottom: '24px',
            fontWeight: 500,
            fontSize: '13px'
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '40px', alignItems: 'start' }}>
          {/* Shipping & Payment Form */}
          <form onSubmit={handlePlaceOrder} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{
              backgroundColor: 'var(--color-gunmetal-dark)',
              padding: '30px',
              borderRadius: '16px',
              border: '1px solid var(--color-border-steel)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
            }}>
              <h2 className="heading-whisper" style={{ fontSize: '17px', color: '#ffffff', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--color-titanium-brushed)', border: '1px solid var(--color-border-chrome)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'var(--color-icy-steel)' }}>1</span>
                <span>Delivery Address</span>
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '12px' }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={address.full_name}
                    onChange={(e) => setAddress({ ...address, full_name: e.target.value })}
                    className="input-field"
                    style={{ backgroundColor: 'var(--color-obsidian-graphite)', borderColor: 'var(--color-border-steel)' }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '12px' }}>
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={address.phone}
                    onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                    className="input-field"
                    style={{ backgroundColor: 'var(--color-obsidian-graphite)', borderColor: 'var(--color-border-steel)' }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '12px' }}>
                    Address (House No, Building, Street, Area)
                  </label>
                  <input
                    type="text"
                    required
                    value={address.line1}
                    onChange={(e) => setAddress({ ...address, line1: e.target.value })}
                    className="input-field"
                    style={{ backgroundColor: 'var(--color-obsidian-graphite)', borderColor: 'var(--color-border-steel)' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '12px' }}>
                      City
                    </label>
                    <input
                      type="text"
                      required
                      value={address.city}
                      onChange={(e) => setAddress({ ...address, city: e.target.value })}
                      className="input-field"
                      style={{ backgroundColor: 'var(--color-obsidian-graphite)', borderColor: 'var(--color-border-steel)' }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '12px' }}>
                      State
                    </label>
                    <input
                      type="text"
                      required
                      value={address.state}
                      onChange={(e) => setAddress({ ...address, state: e.target.value })}
                      className="input-field"
                      style={{ backgroundColor: 'var(--color-obsidian-graphite)', borderColor: 'var(--color-border-steel)' }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '12px' }}>
                      PIN Code
                    </label>
                    <input
                      type="text"
                      required
                      value={address.pincode}
                      onChange={(e) => setAddress({ ...address, pincode: e.target.value })}
                      className="input-field"
                      style={{ backgroundColor: 'var(--color-obsidian-graphite)', borderColor: 'var(--color-border-steel)' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Method Card */}
            <div style={{
              backgroundColor: 'var(--color-gunmetal-dark)',
              padding: '30px',
              borderRadius: '16px',
              border: '1px solid var(--color-border-steel)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
            }}>
              <h2 className="heading-whisper" style={{ fontSize: '17px', color: '#ffffff', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--color-titanium-brushed)', border: '1px solid var(--color-border-chrome)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'var(--color-icy-steel)' }}>2</span>
                <span>Payment Method</span>
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '16px 20px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--color-titanium-brushed)',
                  border: '1px solid var(--color-border-chrome)',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease'
                }}>
                  <input
                    type="radio"
                    name="payment"
                    value="simulated_card"
                    checked={paymentMethod === 'simulated_card'}
                    onChange={() => setPaymentMethod('simulated_card')}
                    style={{ accentColor: 'var(--color-icy-steel)' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                      <CreditCard size={16} color="var(--color-icy-steel)" />
                      <span>Razorpay (UPI, Credit/Debit Card, NetBanking)</span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--color-silver-glow)', opacity: 0.7, marginTop: '2px', display: 'block' }}>
                      Safe and encrypted checkout powered by Razorpay
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={placing}
              className="btn-primary"
              style={{ width: '100%', padding: '16px', fontSize: '14px', fontWeight: 600 }}
            >
              {placing ? 'Placing your order...' : `Place Your Order • ₹${totalAmount.toLocaleString('en-IN')}`}
            </button>
          </form>

          {/* Order Summary & Stock Lock Assurance */}
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
              Order Items ({items.length})
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px', maxHeight: '280px', overflowY: 'auto' }}>
              {items.map((i) => (
                <div key={i.cart_item_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', paddingBottom: '12px', borderBottom: '1px solid var(--color-border-steel)' }}>
                  <div style={{ flex: 1, paddingRight: '12px' }}>
                    <p style={{ fontWeight: 500, color: '#ffffff', margin: 0, fontSize: '13px' }}>{i.title}</p>
                    <span style={{ fontSize: '11px', color: 'var(--color-ash-label)' }}>Qty: {i.quantity}</span>
                  </div>
                  <span style={{ fontWeight: 600, color: '#ffffff' }}>
                    ₹{(parseFloat(i.price) * i.quantity).toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: '16px', borderTop: '1px solid var(--color-border-steel)', marginBottom: '24px' }}>
              <span style={{ fontSize: '15px', fontWeight: 500, color: '#ffffff' }}>Total Payable</span>
              <span style={{ fontSize: '26px', fontWeight: 600, color: '#ffffff', letterSpacing: '0.01em' }}>
                ₹{totalAmount.toLocaleString('en-IN')}
              </span>
            </div>

            <div style={{ padding: '14px', backgroundColor: 'var(--color-titanium-brushed)', borderRadius: '10px', border: '1px solid var(--color-border-steel)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--color-icy-steel)', fontWeight: 600 }}>
                <ShieldCheck size={14} />
                <span>Buyer Protection Guarantee</span>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--color-silver-glow)', opacity: 0.8, margin: 0, lineHeight: 1.5 }}>
                Your order is protected from payment to delivery. 100% refund guarantee on damaged or missing shipments.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
