import React from 'react';
import { Lock, Eye } from 'lucide-react';

export const PrivacyPage = () => {
  return (
    <div className="container" style={{ padding: '60px 24px 80px', maxWidth: '800px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px' }}>Privacy Policy</h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          Last updated: September 18, 2026
        </p>
      </div>

      <div style={{ background: '#ffffff', border: '1px solid var(--color-border-card)', borderRadius: 'var(--radius-md)', padding: '36px', lineHeight: 1.7, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '12px' }}>1. Data Collection & Usage</h2>
        <p style={{ marginBottom: '20px', color: 'var(--color-text-secondary)' }}>
          Vyapari collects minimal personal data required to process orders and deliver personalized recommendations: name, email address, shipping addresses, phone numbers, and pseudonymized browse interaction signals for pgvector similarity indexing.
        </p>

        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '12px' }}>2. Vector Embeddings & AI Processing</h2>
        <p style={{ marginBottom: '20px', color: 'var(--color-text-secondary)' }}>
          Product descriptions and customer search terms are embedded as numerical vectors (384 floating-point coordinates). Embeddings are used exclusively for semantic ranking and similarity retrieval. Personal identifiable information (PII) is never fed into public LLM training datasets.
        </p>

        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '12px' }}>3. Cookies & Session Storage</h2>
        <p style={{ marginBottom: '20px', color: 'var(--color-text-secondary)' }}>
          We use strictly necessary httpOnly cookies for session authentication and CSRF protection. In-memory tokens expire every 15 minutes to guarantee session integrity.
        </p>

        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '12px' }}>4. Data Security</h2>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          All data in transit is encrypted using TLS 1.3. User passwords are salted and hashed using bcrypt (12 rounds). PostgreSQL databases and Redis caches are provisioned within secure private subnets.
        </p>
      </div>
    </div>
  );
};

export default PrivacyPage;
