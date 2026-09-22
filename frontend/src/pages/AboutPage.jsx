import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ShieldCheck, Zap, TrendingUp, Users, ArrowRight } from 'lucide-react';

export const AboutPage = () => {
  return (
    <div style={{ backgroundColor: 'var(--color-obsidian-graphite)', minHeight: 'calc(100vh - 76px)', padding: '64px 24px 88px' }}>
      <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 16px',
            borderRadius: 'var(--radius-pills)',
            backgroundColor: 'var(--color-titanium-brushed)',
            border: '1px solid var(--color-border-steel)',
            color: 'var(--color-icy-steel)',
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '20px'
          }}>
            <Sparkles size={13} />
            <span>Next-Gen Commerce Architecture</span>
          </div>
          <h1 className="heading-whisper" style={{ fontSize: '2.8rem', color: '#ffffff', letterSpacing: '0.02em', marginBottom: '20px', lineHeight: 1.2 }}>
            Autonomous Intelligence for Artisans & Discerning Shoppers
          </h1>
          <p style={{ fontSize: '1rem', color: 'var(--color-silver-glow)', opacity: 0.8, maxWidth: '740px', margin: '0 auto', lineHeight: 1.7 }}>
            Vyapari is India's pioneer autonomous e-commerce operations platform. We unite high-performance pgvector semantic embeddings, Google Gemini agent workflows, and transactional stock guarantees to scale independent commerce.
          </p>
        </div>

        {/* Core Pillars */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '24px',
          marginBottom: '56px'
        }}>
          <div style={{
            backgroundColor: 'var(--color-gunmetal-dark)',
            border: '1px solid var(--color-border-steel)',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
          }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: 'var(--color-titanium-brushed)', border: '1px solid var(--color-border-chrome)', color: 'var(--color-icy-steel)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px' }}>
              <Sparkles size={22} />
            </div>
            <h3 className="heading-whisper" style={{ fontSize: '1.25rem', color: '#ffffff', marginBottom: '10px' }}>Smart Search & Discovery</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-silver-glow)', opacity: 0.75, lineHeight: 1.6 }}>
              Shoppers discover products using natural everyday language, finding exactly what they need quickly and effortlessly.
            </p>
          </div>

          <div style={{
            backgroundColor: 'var(--color-gunmetal-dark)',
            border: '1px solid var(--color-border-steel)',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
          }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: 'var(--color-titanium-brushed)', border: '1px solid var(--color-border-chrome)', color: 'var(--color-icy-steel)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px' }}>
              <TrendingUp size={22} />
            </div>
            <h3 className="heading-whisper" style={{ fontSize: '1.25rem', color: '#ffffff', marginBottom: '10px' }}>Smart Inventory Alerts</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-silver-glow)', opacity: 0.75, lineHeight: 1.6 }}>
              Intelligent background systems monitor inventory levels and alert sellers proactively before products run out of stock.
            </p>
          </div>

          <div style={{
            backgroundColor: 'var(--color-gunmetal-dark)',
            border: '1px solid var(--color-border-steel)',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
          }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: 'var(--color-titanium-brushed)', border: '1px solid var(--color-border-chrome)', color: 'var(--color-icy-steel)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px' }}>
              <ShieldCheck size={22} />
            </div>
            <h3 className="heading-whisper" style={{ fontSize: '1.25rem', color: '#ffffff', marginBottom: '10px' }}>Seller Control & Security</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-silver-glow)', opacity: 0.75, lineHeight: 1.6 }}>
              AI assists with listing drafts and smart suggestions, but sellers always retain 100% control and final approval over their store.
            </p>
          </div>
        </div>

        {/* Call to action */}
        <div style={{
          backgroundColor: 'var(--color-gunmetal-dark)',
          borderRadius: '16px',
          padding: '48px 36px',
          textAlign: 'center',
          border: '1px solid var(--color-border-steel)',
          boxShadow: '0 12px 32px rgba(0,0,0,0.5)'
        }}>
          <h2 className="heading-whisper" style={{ fontSize: '1.85rem', color: '#ffffff', letterSpacing: '0.02em', marginBottom: '14px' }}>
            Trade with Unprecedented Velocity
          </h2>
          <p style={{ color: 'var(--color-silver-glow)', opacity: 0.75, fontSize: '0.875rem', maxWidth: '560px', margin: '0 auto 28px', lineHeight: 1.6 }}>
            Join verified merchants leveraging autonomous listing studio, stock velocity forecasting, and semantic discoverability.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <Link 
              to="/register" 
              className="btn-primary"
              style={{
                padding: '12px 28px',
                fontSize: '13px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>Create Account</span>
              <ArrowRight size={15} />
            </Link>
            <Link 
              to="/explore" 
              className="btn-outline"
              style={{
                padding: '12px 26px',
                fontSize: '13px'
              }}
            >
              Explore Marketplace
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
