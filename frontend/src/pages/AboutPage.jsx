import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ShieldCheck, Zap, TrendingUp, Users, ArrowRight } from 'lucide-react';

export const AboutPage = () => {
  return (
    <div className="container" style={{ padding: '60px 24px 80px', maxWidth: '960px' }}>
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 16px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'var(--color-primary-light)',
          color: 'var(--color-primary)',
          fontSize: 'var(--font-size-xs)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: '16px'
        }}>
          <Sparkles size={14} />
          <span>Next-Gen Commerce</span>
        </div>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '16px' }}>
          Empowering Merchants & Shoppers with Autonomous Intelligence
        </h1>
        <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)', maxWidth: '720px', margin: '0 auto', lineHeight: 1.6 }}>
          Vyapari is India's pioneer autonomous e-commerce operations and personalization marketplace. We combine high-performance semantic search, pgvector-driven visual recommendations, and Gemini agent operations to scale independent merchants.
        </p>
      </div>

      {/* Core Pillars */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '24px',
        marginBottom: '48px'
      }}>
        <div style={{
          background: '#ffffff',
          border: '1px solid var(--color-border-card)',
          borderRadius: 'var(--radius-md)',
          padding: '28px',
          boxShadow: 'var(--shadow-xs)'
        }}>
          <div style={{ width: '44px', height: '44px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
            <Sparkles size={22} />
          </div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>Semantic Discovery</h3>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            Shoppers discover items using natural descriptions rather than rigid keyword matching, powered by dense 384-dimensional vector embeddings and HNSW indexing.
          </p>
        </div>

        <div style={{
          background: '#ffffff',
          border: '1px solid var(--color-border-card)',
          borderRadius: 'var(--radius-md)',
          padding: '28px',
          boxShadow: 'var(--shadow-xs)'
        }}>
          <div style={{ width: '44px', height: '44px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-secondary-light)', color: 'var(--color-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
            <TrendingUp size={22} />
          </div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>Predictive Operations</h3>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            Autonomous agent workers forecast stock depletion velocity, alerting merchants before stockouts occur with actionable reorder advisories.
          </p>
        </div>

        <div style={{
          background: '#ffffff',
          border: '1px solid var(--color-border-card)',
          borderRadius: 'var(--radius-md)',
          padding: '28px',
          boxShadow: 'var(--shadow-xs)'
        }}>
          <div style={{ width: '44px', height: '44px', borderRadius: 'var(--radius-sm)', backgroundColor: '#EEF2FF', color: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
            <ShieldCheck size={22} />
          </div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>Bounded Autonomy</h3>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            AI drafts catalog descriptions and customer responses, but strict human-in-the-loop review queues ensure merchants maintain complete authority.
          </p>
        </div>
      </div>

      {/* Call to action */}
      <div style={{
        background: 'var(--color-surface-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '36px',
        textAlign: 'center',
        border: '1px solid var(--color-border-card)'
      }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '12px' }}>
          Ready to trade on Vyapari?
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: '24px' }}>
          Join thousands of verified Indian merchants reaching millions of discerning customers nationwide.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
          <Link to="/explore" className="btn-primary">
            <span>Explore Marketplace</span>
            <ArrowRight size={16} />
          </Link>
          <Link to="/seller/onboarding" className="btn-outline">
            Become a Seller
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
