import React, { useState } from 'react';
import { HelpCircle, Package, RefreshCw, CreditCard, ShieldCheck, ChevronDown, Mail } from 'lucide-react';

export const HelpPage = () => {
  const [openFaq, setOpenFaq] = useState(null);

  const faqs = [
    {
      q: 'How does order fulfillment and courier tracking operate?',
      a: 'Once you place your order, the seller prepares and ships it via reliable express couriers. You can track live delivery updates anytime under "My Orders".'
    },
    {
      q: 'What is the platform return and refund policy on Vyapari?',
      a: 'Eligible products can be returned or replaced within 7 days of delivery. Refunds are processed back to your original payment method within 3 to 5 business days.'
    },
    {
      q: 'How does Vyapari smart search work?',
      a: 'Vyapari uses intelligent search to understand natural language queries. For example, searching for "cozy winter hoodie" or "ceramic coffee mug" finds relevant matching items instantly.'
    },
    {
      q: 'How can I start selling on Vyapari?',
      a: 'Click "Sell on Vyapari" in the top navigation, register your seller account, and enter your business and tax details. Once approved, you can list products and start selling immediately.'
    },
    {
      q: 'How are customer payments secured?',
      a: 'All transactions are processed through 256-bit encrypted secure gateways supporting UPI, Debit/Credit Cards, and NetBanking with buyer protection guarantee.'
    }
  ];

  return (
    <div style={{ padding: '60px 24px 80px', maxWidth: '960px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff', marginBottom: '12px' }}>
          Help Center
        </h1>
        <p style={{ color: 'var(--color-steel-mist)', fontSize: '1rem' }}>
          Frequently asked questions about orders, deliveries, returns, and selling on Vyapari
        </p>
      </div>

      {/* Quick Category Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '48px'
      }}>
        <div style={{ background: 'var(--color-gunmetal-dark)', border: '1px solid var(--color-border-steel)', borderRadius: '12px', padding: '20px', textAlign: 'center', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }}>
          <Package size={22} color="var(--color-icy-steel)" style={{ margin: '0 auto 10px' }} />
          <h4 style={{ fontSize: '0.875rem', fontWeight: 500, color: '#ffffff' }}>Orders & Tracking</h4>
        </div>
        <div style={{ background: 'var(--color-gunmetal-dark)', border: '1px solid var(--color-border-steel)', borderRadius: '12px', padding: '20px', textAlign: 'center', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }}>
          <RefreshCw size={22} color="var(--color-icy-steel)" style={{ margin: '0 auto 10px' }} />
          <h4 style={{ fontSize: '0.875rem', fontWeight: 500, color: '#ffffff' }}>Returns & Refunds</h4>
        </div>
        <div style={{ background: 'var(--color-gunmetal-dark)', border: '1px solid var(--color-border-steel)', borderRadius: '12px', padding: '20px', textAlign: 'center', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }}>
          <CreditCard size={22} color="var(--color-icy-steel)" style={{ margin: '0 auto 10px' }} />
          <h4 style={{ fontSize: '0.875rem', fontWeight: 500, color: '#ffffff' }}>Payments & Settlement</h4>
        </div>
        <div style={{ background: 'var(--color-gunmetal-dark)', border: '1px solid var(--color-border-steel)', borderRadius: '12px', padding: '20px', textAlign: 'center', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }}>
          <ShieldCheck size={22} color="var(--color-icy-steel)" style={{ margin: '0 auto 10px' }} />
          <h4 style={{ fontSize: '0.875rem', fontWeight: 500, color: '#ffffff' }}>Merchant Trust</h4>
        </div>
      </div>

      {/* Accordion FAQs */}
      <div style={{ marginBottom: '48px' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff', marginBottom: '20px' }}>Frequently Addressed Queries</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                style={{
                  background: 'var(--color-gunmetal-dark)',
                  border: `1px solid ${isOpen ? 'var(--color-border-chrome)' : 'var(--color-border-steel)'}`,
                  borderRadius: '10px',
                  overflow: 'hidden',
                  transition: 'border-color 0.2s ease'
                }}
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  style={{
                    width: '100%',
                    padding: '18px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    textAlign: 'left',
                    fontWeight: 500,
                    fontSize: '0.875rem',
                    color: '#ffffff',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    size={16}
                    color="var(--color-silver-glow)"
                    style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', flexShrink: 0 }}
                  />
                </button>
                {isOpen && (
                  <div style={{ padding: '0 20px 18px', color: 'var(--color-steel-mist)', fontSize: '0.875rem', lineHeight: 1.6 }}>
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default HelpPage;
