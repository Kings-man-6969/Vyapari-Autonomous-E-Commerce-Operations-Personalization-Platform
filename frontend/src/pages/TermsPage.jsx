import React from 'react';
import { Shield, FileText } from 'lucide-react';

export const TermsPage = () => {
  return (
    <div style={{ padding: '60px 24px 80px', maxWidth: '880px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff', marginBottom: '8px' }}>Terms of Service</h1>
        <p style={{ color: 'var(--color-steel-mist)', fontSize: '0.875rem' }}>
          Effective: September 2026 &bull; Governance Standards
        </p>
      </div>

      <div style={{ background: 'var(--color-gunmetal-dark)', border: '1px solid var(--color-border-steel)', borderRadius: '16px', padding: '36px', lineHeight: 1.7, fontSize: '0.875rem', color: '#ffffff', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 500, color: '#ffffff', marginBottom: '10px' }}>1. Acceptance of Terms</h2>
        <p style={{ marginBottom: '20px', color: 'var(--color-steel-mist)' }}>
          By accessing or transacting on the Vyapari Autonomous E-Commerce Platform ("Vyapari", "we", "us"), you agree to abide by these Terms of Service. If you disagree with any portion, you must discontinue platform use immediately.
        </p>

        <h2 style={{ fontSize: '1.15rem', fontWeight: 500, color: '#ffffff', marginBottom: '10px' }}>2. Multi-Vendor Marketplace Operations</h2>
        <p style={{ marginBottom: '20px', color: 'var(--color-steel-mist)' }}>
          Vyapari provides an autonomous infrastructure connecting independent merchant sellers with buyers. Sellers are legally responsible for listing accuracy, fulfillment schedules, and warranty support. Platform AI agents operate under bounded human-in-the-loop review.
        </p>

        <h2 style={{ fontSize: '1.15rem', fontWeight: 500, color: '#ffffff', marginBottom: '10px' }}>3. User Accounts & Security</h2>
        <p style={{ marginBottom: '20px', color: 'var(--color-steel-mist)' }}>
          Users are responsible for safeguarding their session credentials. In-memory access tokens are issued with 15-minute validity and refreshed via HttpOnly Secure token family rotation. Suspected replay attacks immediately revoke the entire token hierarchy.
        </p>

        <h2 style={{ fontSize: '1.15rem', fontWeight: 500, color: '#ffffff', marginBottom: '10px' }}>4. Merchant KYC & Catalog Compliance</h2>
        <p style={{ marginBottom: '20px', color: 'var(--color-steel-mist)' }}>
          All merchants must complete regulatory KYC verification (PAN, GSTIN, and verified settlement bank coordinates) before publishing public listings. Prohibited, counterfeit, or misrepresented goods will result in immediate archival and administrative suspension.
        </p>

        <h2 style={{ fontSize: '1.15rem', fontWeight: 500, color: '#ffffff', marginBottom: '10px' }}>5. Stock Allocation & Idempotent Transactions</h2>
        <p style={{ color: 'var(--color-steel-mist)' }}>
          Orders are placed with transactional stock locking (SELECT FOR UPDATE). Unpaid or abandoned checkout sessions automatically release reserved inventory to prevent permanent inventory loss.
        </p>
      </div>
    </div>
  );
};

export default TermsPage;
