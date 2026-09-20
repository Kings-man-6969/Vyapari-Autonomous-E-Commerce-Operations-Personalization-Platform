import React from 'react';
import { Link } from 'react-router-dom';

export const Footer = () => {
  return (
    <footer style={{
      marginTop: 'auto',
      backgroundColor: 'var(--color-surface-subtle)',
      borderTop: '1px solid var(--color-border-subtle)',
      padding: '48px 0 24px 0'
    }}>
      <div className="container">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '32px',
          marginBottom: '36px'
        }}>
          <div>
            <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Marketplace
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              <Link to="/explore">Explore Products</Link>
              <Link to="/categories/electronics">Electronics & Audio</Link>
              <Link to="/categories/fashion-apparel">Fashion & Footwear</Link>
              <Link to="/categories/home-living">Artisanal Home Decor</Link>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              For Sellers
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              <Link to="/register?role=seller">Open a Vyapari Store</Link>
              <Link to="/seller/dashboard">Seller Console</Link>
              <Link to="/seller/ai">Autonomous AI Assistant</Link>
              <Link to="/seller/approvals">Approval Queue</Link>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              AI Capabilities
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              <span>pgvector 384-dim Embeddings</span>
              <span>Hybrid Recommendation Engine</span>
              <span>Listing & Catalog Agent</span>
              <span>Inventory Velocity Advisor</span>
              <span>High-Risk Approval Guardrails</span>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Trust & Security
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              <span>Razorpay Test Payments</span>
              <span>Strict Concurrency Locks</span>
              <span>Human-in-the-loop Guardrails</span>
              <span>Verified Customer Reviews</span>
            </div>
          </div>
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '1px solid var(--color-border-subtle)',
          paddingTop: '24px',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-secondary)',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            © 2026 Vyapari Platform. All rights reserved. BTech Final Year Project.
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <span>Privacy</span>
            <span>Terms</span>
            <span>Architecture Specs</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
