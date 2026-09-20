import React, { useState } from 'react';
import { HelpCircle, Search, Package, RefreshCw, CreditCard, ShieldCheck, ChevronDown, Mail } from 'lucide-react';

export const HelpPage = () => {
  const [openFaq, setOpenFaq] = useState(null);

  const faqs = [
    {
      q: 'How does order tracking and delivery work?',
      a: 'Once your payment is confirmed, the merchant receives fulfillment instructions immediately. You can track your order timeline in real-time from the "My Orders" tab.'
    },
    {
      q: 'What is the return and refund policy on Vyapari?',
      a: 'All eligible items can be returned within 7 days of delivery. Verified sellers inspect the returned goods, and refunds are credited back to your original payment method within 3 to 5 business days.'
    },
    {
      q: 'How does Vyapari AI semantic search work?',
      a: 'Vyapari converts your search terms into dense vector embeddings using all-MiniLM-L6-v2 models. It matches concepts, synonyms, and styles instead of just exact product title keywords.'
    },
    {
      q: 'How can I become a verified seller on Vyapari?',
      a: 'Navigate to "Become a Seller" in the menu. Complete our 4-step onboarding KYC wizard with your business name, GSTIN/PAN, and bank payout account. Our admin desk verifies submissions within 24 hours.'
    },
    {
      q: 'Are payments on Vyapari secure?',
      a: 'Yes. All transactions are protected with TLS 1.3 encryption and comply with RBI standards. We never store raw credit card credentials.'
    }
  ];

  return (
    <div className="container" style={{ padding: '60px 24px 80px', maxWidth: '860px' }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '12px' }}>
          Vyapari Help & Support Center
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-base)' }}>
          Answers to common questions about shopping, shipping, seller operations, and security
        </p>
      </div>

      {/* Quick Category Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '16px',
        marginBottom: '48px'
      }}>
        <div style={{ background: '#ffffff', border: '1px solid var(--color-border-card)', borderRadius: 'var(--radius-md)', padding: '20px', textAlign: 'center' }}>
          <Package size={24} color="var(--color-primary)" style={{ margin: '0 auto 10px' }} />
          <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700 }}>Orders & Shipping</h4>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid var(--color-border-card)', borderRadius: 'var(--radius-md)', padding: '20px', textAlign: 'center' }}>
          <RefreshCw size={24} color="var(--color-secondary)" style={{ margin: '0 auto 10px' }} />
          <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700 }}>Returns & Refunds</h4>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid var(--color-border-card)', borderRadius: 'var(--radius-md)', padding: '20px', textAlign: 'center' }}>
          <CreditCard size={24} color="#6366F1" style={{ margin: '0 auto 10px' }} />
          <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700 }}>Payments & Invoices</h4>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid var(--color-border-card)', borderRadius: 'var(--radius-md)', padding: '20px', textAlign: 'center' }}>
          <ShieldCheck size={24} color="var(--color-success)" style={{ margin: '0 auto 10px' }} />
          <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700 }}>Trust & Safety</h4>
        </div>
      </div>

      {/* Accordion FAQs */}
      <div style={{ marginBottom: '48px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '20px' }}>Frequently Asked Questions</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--color-border-card)',
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden'
                }}
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  style={{
                    width: '100%',
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    textAlign: 'left',
                    fontWeight: 600,
                    fontSize: 'var(--font-size-sm)'
                  }}
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    size={16}
                    color="var(--color-text-secondary)"
                    style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}
                  />
                </button>
                {isOpen && (
                  <div style={{ padding: '0 20px 16px', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Direct Contact Banner */}
      <div style={{
        background: 'var(--color-surface-subtle)',
        border: '1px solid var(--color-border-card)',
        borderRadius: 'var(--radius-md)',
        padding: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Need more assistance?</h3>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            Our operations team is available Monday through Saturday, 9 AM – 7 PM IST.
          </p>
        </div>
        <a href="mailto:support@vyapari.com" className="btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <Mail size={16} />
          <span>Contact Support</span>
        </a>
      </div>
    </div>
  );
};

export default HelpPage;
