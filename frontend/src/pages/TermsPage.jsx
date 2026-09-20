import React from 'react';
import { Shield, FileText } from 'lucide-react';

export const TermsPage = () => {
  return (
    <div className="container" style={{ padding: '60px 24px 80px', maxWidth: '800px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px' }}>Terms of Service</h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          Last updated: September 18, 2026
        </p>
      </div>

      <div style={{ background: '#ffffff', border: '1px solid var(--color-border-card)', borderRadius: 'var(--radius-md)', padding: '36px', lineHeight: 1.7, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '12px' }}>1. Acceptance of Terms</h2>
        <p style={{ marginBottom: '20px', color: 'var(--color-text-secondary)' }}>
          By accessing or using Vyapari Autonomous E-Commerce Platform ("Vyapari", "we", "us", or "our"), you agree to be bound by these Terms of Service. If you disagree with any portion of these terms, you must discontinue platform use immediately.
        </p>

        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '12px' }}>2. Multi-Vendor Marketplace Operations</h2>
        <p style={{ marginBottom: '20px', color: 'var(--color-text-secondary)' }}>
          Vyapari provides an autonomous infrastructure connecting independent merchant sellers with buyers. Sellers are legally responsible for the accuracy of their listings, pricing, and fulfillment. Platform algorithms and AI agents act under bounded human review to draft listings and advisories.
        </p>

        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '12px' }}>3. User Accounts & Security</h2>
        <p style={{ marginBottom: '20px', color: 'var(--color-text-secondary)' }}>
          You are responsible for safeguarding your credentials. Notify us immediately upon discovering unauthorized account activity. We reserve the right to suspend or terminate accounts that violate platform policies or display fraudulent purchasing or selling behaviors.
        </p>

        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '12px' }}>4. Merchant KYC & Catalog Compliance</h2>
        <p style={{ marginBottom: '20px', color: 'var(--color-text-secondary)' }}>
          All merchants must complete mandatory Know-Your-Customer verification including valid PAN and GSTIN registration before listing products. Prohibited items, counterfeit goods, or intellectual property infringements are subject to immediate takedown and forfeiture of payouts.
        </p>

        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '12px' }}>5. Limitation of Liability</h2>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          To the maximum extent permitted by applicable Indian law, Vyapari shall not be liable for indirect, incidental, special, or consequential damages resulting from transaction disputes between buyers and sellers.
        </p>
      </div>
    </div>
  );
};

export default TermsPage;
