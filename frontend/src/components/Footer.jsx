import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Truck, ShoppingBag, ArrowRight, CheckCircle2, RotateCcw } from 'lucide-react';

export const Footer = () => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
      setTimeout(() => setSubscribed(false), 4000);
      setEmail('');
    }
  };

  return (
    <footer style={{
      marginTop: 'auto',
      backgroundColor: 'var(--color-obsidian-graphite)',
      borderTop: '1px solid var(--color-border-steel)',
      padding: '60px 0 32px 0'
    }}>
      <div className="container">
        {/* Top Newsletter Strip */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '24px',
          paddingBottom: '36px',
          marginBottom: '44px',
          borderBottom: '1px solid var(--color-border-steel)'
        }}>
          <div>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--color-icy-steel)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '6px'
            }}>
              Stay Updated
            </span>
            <h3 style={{ fontSize: '20px', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff' }}>
              Subscribe for exclusive deals, flash sales & new arrivals
            </h3>
          </div>

          <form onSubmit={handleSubscribe} style={{ display: 'flex', gap: '10px', maxWidth: '440px', width: '100%' }}>
            <input 
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                flex: 1,
                padding: '10px 16px',
                fontSize: '13px',
                color: '#ffffff',
                backgroundColor: 'var(--color-gunmetal-dark)',
                border: '1px solid var(--color-border-steel)',
                borderRadius: '9999px',
                outline: 'none'
              }}
            />
            <button 
              type="submit"
              className="btn-primary"
              style={{ padding: '10px 22px', fontSize: '13px', whiteSpace: 'nowrap' }}
            >
              {subscribed ? (
                <>
                  <CheckCircle2 size={14} /> Subscribed
                </>
              ) : (
                <>
                  Subscribe <ArrowRight size={13} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Multi-Column Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '36px',
          marginBottom: '48px'
        }}>
          {/* Brand Col */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #181d26 0%, #12151b 100%)',
                border: '1px solid var(--color-border-chrome)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-brushed-aluminum)'
              }}>
                <ShoppingBag size={16} />
              </div>
              <span style={{ fontSize: '1.2rem', fontWeight: 330, letterSpacing: '0.04em', color: '#ffffff' }}>
                Vyapari
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--color-steel-mist)', lineHeight: 1.6, marginBottom: '16px' }}>
              Your destination for curated goods, secure transactions, verified independent merchants, and fast doorstep delivery.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: 'var(--color-steel-mist)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={14} color="var(--color-icy-steel)" /> 100% Genuine Products
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Truck size={14} color="var(--color-icy-steel)" /> Fast Doorstep Delivery
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <RotateCcw size={14} color="var(--color-icy-steel)" /> 7-Day Easy Returns
              </div>
            </div>
          </div>

          {/* Shop & Browse */}
          <div>
            <h4 style={{ fontSize: '11px', fontWeight: 600, marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-slate-caption)' }}>
              Shop & Explore
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: 'var(--color-steel-mist)' }}>
              <Link to="/explore" style={{ transition: 'color 0.15s' }}>All Products</Link>
              <Link to="/explore?category=1" style={{ transition: 'color 0.15s' }}>Electronics</Link>
              <Link to="/explore?category=2" style={{ transition: 'color 0.15s' }}>Fashion & Apparel</Link>
              <Link to="/explore?category=3" style={{ transition: 'color 0.15s' }}>Home & Kitchen</Link>
              <Link to="/explore?sort=rating" style={{ transition: 'color 0.15s' }}>Top Rated Deals</Link>
            </div>
          </div>

          {/* Make Money with Us */}
          <div>
            <h4 style={{ fontSize: '11px', fontWeight: 600, marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-slate-caption)' }}>
              Sell on Vyapari
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: 'var(--color-steel-mist)' }}>
              <Link to="/seller/onboarding" style={{ transition: 'color 0.15s' }}>Become a Seller</Link>
              <Link to="/seller/dashboard" style={{ transition: 'color 0.15s' }}>Seller Dashboard</Link>
              <Link to="/seller/products" style={{ transition: 'color 0.15s' }}>Manage Listings</Link>
              <Link to="/seller/orders" style={{ transition: 'color 0.15s' }}>Fulfill Orders</Link>
            </div>
          </div>

          {/* Customer Care & Policies */}
          <div>
            <h4 style={{ fontSize: '11px', fontWeight: 600, marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-slate-caption)' }}>
              Help & Policies
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: 'var(--color-steel-mist)' }}>
              <Link to="/help" style={{ transition: 'color 0.15s' }}>Help & FAQs</Link>
              <Link to="/returns" style={{ transition: 'color 0.15s' }}>Returns & Refunds</Link>
              <Link to="/privacy" style={{ transition: 'color 0.15s' }}>Privacy Policy</Link>
              <Link to="/terms" style={{ transition: 'color 0.15s' }}>Terms of Service</Link>
              <Link to="/about" style={{ transition: 'color 0.15s' }}>About Vyapari</Link>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '1px solid var(--color-border-steel)',
          paddingTop: '24px',
          fontSize: '12px',
          color: 'var(--color-slate-caption)',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            © 2026 Vyapari Marketplace. All rights reserved.
          </div>
          <div style={{ display: 'flex', gap: '20px' }}>
            <Link to="/privacy" style={{ color: 'var(--color-steel-mist)' }}>Privacy</Link>
            <Link to="/terms" style={{ color: 'var(--color-steel-mist)' }}>Terms</Link>
            <Link to="/returns" style={{ color: 'var(--color-steel-mist)' }}>Returns</Link>
            <Link to="/help" style={{ color: 'var(--color-steel-mist)' }}>Help</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
