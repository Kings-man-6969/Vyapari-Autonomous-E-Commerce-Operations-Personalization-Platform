import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight, ShieldCheck, Zap, Bot, Database } from 'lucide-react';
import api from '../services/api';
import { ProductCard } from '../components/ProductCard';

export const HomePage = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prodRes, catRes] = await Promise.all([
          api.get('/products?limit=8'),
          api.get('/categories')
        ]);
        if (prodRes.data?.success) setProducts(prodRes.data.data.products || []);
        if (catRes.data?.success) setCategories(catRes.data.data.categories || []);
      } catch (err) {
        console.error('Error fetching homepage data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div>
      {/* Hero Banner */}
      <section style={{
        background: 'linear-gradient(180deg, #FFF0F2 0%, #FFFFFF 100%)',
        padding: '64px 0 48px 0',
        borderBottom: '1px solid var(--color-border-card)'
      }}>
        <div className="container" style={{ textAlign: 'center', maxWidth: '800px' }}>
          <div className="badge badge-primary" style={{ marginBottom: '16px', padding: '6px 14px' }}>
            <Sparkles size={14} style={{ marginRight: '6px' }} />
            Dual-AI Intelligence Architecture
          </div>
          <h1 style={{
            fontSize: 'var(--font-size-4xl)',
            fontWeight: 800,
            letterSpacing: '-1px',
            lineHeight: 1.15,
            marginBottom: '18px',
            color: 'var(--color-text-primary)'
          }}>
            Autonomous E-Commerce Operations & Personalization
          </h1>
          <p style={{
            fontSize: 'var(--font-size-lg)',
            color: 'var(--color-text-secondary)',
            lineHeight: 1.6,
            marginBottom: '32px'
          }}>
            Discover curated lifestyle, electronics, and fashion powered by pgvector 384-dimensional semantic embeddings, paired with autonomous agentic seller operations.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <Link to="/explore" className="btn-primary" style={{ padding: '14px 28px', fontSize: 'var(--font-size-base)' }}>
              Explore Marketplace <ArrowRight size={18} />
            </Link>
            <Link to="/seller/dashboard" className="btn-outline" style={{ padding: '14px 28px', fontSize: 'var(--font-size-base)' }}>
              Seller Console & AI Queue
            </Link>
          </div>
        </div>
      </section>

      {/* Category Pills */}
      <section style={{ padding: '24px 0', borderBottom: '1px solid var(--color-border-card)', backgroundColor: '#ffffff' }}>
        <div className="container" style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
          <Link
            to="/explore"
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--color-text-primary)',
              color: '#ffffff',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              whiteSpace: 'nowrap'
            }}
          >
            All Categories
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={`/explore?category=${cat.id}`}
              style={{
                padding: '8px 18px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--color-surface-subtle)',
                border: '1px solid var(--color-border-subtle)',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 500,
                whiteSpace: 'nowrap'
              }}
            >
              {cat.name}
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Products Grid */}
      <section style={{ padding: '48px 0' }}>
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '28px' }}>
            <div>
              <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, letterSpacing: '-0.5px' }}>
                Featured Curations
              </h2>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                Trending products with real-time stock guarantees and verified merchant ratings
              </p>
            </div>
            <Link to="/explore" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              View all <ArrowRight size={16} />
            </Link>
          </div>

          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '24px' }}>
              {[1, 2, 3, 4].map((n) => (
                <div key={n} style={{ height: '360px' }} className="skeleton" />
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '24px' }}>
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Dual Intelligence Architecture Showcase */}
      <section style={{ backgroundColor: 'var(--color-surface-subtle)', padding: '64px 0', borderTop: '1px solid var(--color-border-subtle)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 48px auto' }}>
            <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '12px' }}>
              Built for Engineering Rigor & Safety
            </h2>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              Vyapari combines two specialized AI sub-systems while ensuring zero autonomous hallucination on live marketplace state.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px' }}>
            {/* Team A Card */}
            <div style={{
              backgroundColor: '#ffffff',
              padding: '32px',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border-card)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-secondary-light)',
                color: 'var(--color-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px'
              }}>
                <Database size={24} />
              </div>
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: '10px' }}>
                Team A — Personalization & Vector Search
              </h3>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>
                Embedded PostgreSQL with <strong>pgvector</strong> executing cosine similarity across 384-dimensional embeddings (pinned to <code>all-MiniLM-L6-v2</code>). Provides real-time semantic discovery and weighted hybrid recommendation ranking.
              </p>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Zap size={14} color="var(--color-secondary)" /> Synchronous vector embedding on product publish
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Zap size={14} color="var(--color-secondary)" /> Cosine distance nearest-neighbor item matching
                </li>
              </ul>
            </div>

            {/* Team B Card */}
            <div style={{
              backgroundColor: '#ffffff',
              padding: '32px',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border-card)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-primary-light)',
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px'
              }}>
                <Bot size={24} />
              </div>
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: '10px' }}>
                Team B — Autonomous Agentic Operations
              </h3>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>
                Autonomous specialized agents powered by <strong>Google Gemini</strong> for listing drafting, stock velocity forecasting, and support RAG. Enforces a human-in-the-loop approval queue before live publishing.
              </p>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={14} color="var(--color-primary)" /> Strict approval queue: agent cannot overwrite live data
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={14} color="var(--color-primary)" /> High-risk refund classification & seller intervention
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
