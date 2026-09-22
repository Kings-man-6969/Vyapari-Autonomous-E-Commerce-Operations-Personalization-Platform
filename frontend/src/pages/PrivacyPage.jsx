import React from 'react';
import { Lock, ShieldCheck } from 'lucide-react';

export const PrivacyPage = () => {
  return (
    <div style={{ padding: '60px 24px 80px', maxWidth: '880px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff', marginBottom: '8px' }}>Privacy & Data Policy</h1>
        <p style={{ color: 'var(--color-steel-mist)', fontSize: '0.875rem' }}>
          Effective: September 2026 &bull; Cryptographic Protections
        </p>
      </div>

      <div style={{ background: 'var(--color-gunmetal-dark)', border: '1px solid var(--color-border-steel)', borderRadius: '16px', padding: '36px', lineHeight: 1.7, fontSize: '0.875rem', color: '#ffffff', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 500, color: '#ffffff', marginBottom: '10px' }}>1. Minimal Data Collection</h2>
        <p style={{ marginBottom: '20px', color: 'var(--color-steel-mist)' }}>
          Vyapari collects only the information necessary for processing orders, delivery fulfillment, and secure account management: name, email address, shipping address, and phone number.
        </p>

        <h2 style={{ fontSize: '1.15rem', fontWeight: 500, color: '#ffffff', marginBottom: '10px' }}>2. Search & Recommendations Privacy</h2>
        <p style={{ marginBottom: '20px', color: 'var(--color-steel-mist)' }}>
          Search queries and product interactions are processed securely to provide relevant product recommendations. Your personal details are never sold, rented, or shared with third parties for public AI model training.
        </p>

        <h2 style={{ fontSize: '1.15rem', fontWeight: 500, color: '#ffffff', marginBottom: '10px' }}>3. Credential Storage & Token Isolation</h2>
        <p style={{ marginBottom: '20px', color: 'var(--color-steel-mist)' }}>
          Authentication tokens are held in short-lived browser memory (15-minute lifetime), while refresh tokens are stored exclusively in HttpOnly, SameSite=Lax (Secure in production) cookies. Never will authentication tokens be exposed in vulnerable localStorage surfaces.
        </p>

        <h2 style={{ fontSize: '1.15rem', fontWeight: 500, color: '#ffffff', marginBottom: '10px' }}>4. Payment Gateway Tokenization</h2>
        <p style={{ color: 'var(--color-steel-mist)' }}>
          All card transactions and UPI payments are handled by certified payment gateways using direct tokenization. Vyapari servers never store raw credit card numbers or banking passwords.
        </p>
      </div>
    </div>
  );
};

export default PrivacyPage;
