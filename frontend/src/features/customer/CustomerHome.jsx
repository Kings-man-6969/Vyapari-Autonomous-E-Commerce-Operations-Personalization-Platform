import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../services/api';
import { useToast } from '../../shared/hooks/useToast';
import '../../customer.css';

/*
  CUSTOMER HOME — Transactional Track
  Font: Inter (font-feature-settings: '"ss03"') everywhere
  Palette: Cream #fbfbf5 · White #fff · Aloe #c1fbd4 · Pistachio #d4f9e0 · Zinc #d4d4d8
*/

const fmt = n => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0 });

import { ProductCard, ProductSkeleton, CATEGORY_DATA } from '../../shared/components/ProductCard';

const CATEGORIES = ['Electronics', 'Clothing', 'Books', 'Home & Kitchen', 'Sports'];

const BASE_FONT = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontFeatureSettings: '"ss03"',
};

export default function CustomerHome({ sessionId, token, onCartChange }) {
  const { showToast } = useToast();
  const [recs, setRecs]               = useState([]);
  const [recsLoading, setRecsLoading] = useState(true);
  const [trending, setTrending]       = useState([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch(`/recommendations?session_id=${sessionId}&top_n=8`)
      .then(d => setRecs(d.recommendations || d || []))
      .catch(() => setRecs([]))
      .finally(() => setRecsLoading(false));

    apiFetch('/products?sort=rating&per_page=8&in_stock=true')
      .then(d => setTrending(d.items || d.products || []))
      .catch(() => setTrending([]))
      .finally(() => setTrendingLoading(false));
  }, [sessionId]);

  async function handleAddToCart(product) {
    try {
      await apiFetch(`/cart/add?session_id=${sessionId}`, { method: 'POST', body: JSON.stringify({ product_id: product.product_id, qty: 1 }) });
      showToast(`${product.name} added to cart!`, 'success');
      onCartChange?.();
    } catch (err) { showToast(err.message || 'Failed to add to cart', 'error'); }
  }

  async function handleWishlist(product) {
    if (!token) { showToast('Sign in to save to wishlist', 'info'); return; }
    try {
      await apiFetch(`/wishlist/${product.product_id}`, { method: 'POST' });
      showToast('Saved to wishlist! ♡', 'success');
      onCartChange?.();
    } catch (err) { showToast(err.message || 'Failed to save', 'error'); }
  }

  return (
    <div style={{ background: '#fbfbf5', minHeight: '100vh', paddingBottom: 80, ...BASE_FONT }}>

      {/* ── HERO ── */}
      <section style={{
        background: '#ffffff',
        minHeight: '52vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center',
        padding: '80px 24px 64px',
      }}>
        <div style={{ maxWidth: 680 }}>

          {/* Eyebrow pill chip */}
          <div style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '5px 14px',
            borderRadius: 9999,
            background: '#c1fbd4',
            fontSize: 12,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.72px',
            color: '#000',
            marginBottom: 28,
            ...BASE_FONT,
          }}>
            AI-Powered Recommendations
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize: 'clamp(2.5rem, 6vw, 55px)',
            fontWeight: 300,
            lineHeight: 1.1,
            letterSpacing: '-1px',
            color: '#000',
            marginBottom: 18,
            ...BASE_FONT,
          }}>
            Discover What&apos;s Perfect<br />for You
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: 16,
            fontWeight: 420,
            color: '#71717a',
            lineHeight: 1.65,
            marginBottom: 36,
            ...BASE_FONT,
          }}>
            Your personal AI curates products that match your taste, budget, and lifestyle.
          </p>

          {/* Pill CTA */}
          <Link
            to="/shop/products"
            style={{
              display: 'inline-block',
              padding: '12px 28px',
              borderRadius: 9999,
              background: '#000',
              color: '#fff',
              fontSize: 14,
              fontWeight: 500,
              textDecoration: 'none',
              transition: 'opacity 0.18s',
              ...BASE_FONT,
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.82'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >
            Browse All Products →
          </Link>
        </div>
      </section>

      {/* ── CATEGORY PILLS ── */}
      <section style={{ padding: '36px 24px 40px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{
          display: 'flex', gap: 10, flexWrap: 'wrap',
          justifyContent: 'center',
        }}>
          {CATEGORIES.map(cat => {
            const isActive = activeCategory === cat;
            return (
              <Link
                key={cat}
                to={`/shop/products?category=${encodeURIComponent(cat)}`}
                onClick={() => setActiveCategory(isActive ? null : cat)}
                style={{
                  display: 'inline-flex', alignItems: 'center',
                  padding: '6px 16px',
                  borderRadius: 9999,
                  background: isActive ? '#c1fbd4' : '#d4d4d8',
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.72px',
                  color: '#000',
                  textDecoration: 'none',
                  transition: 'background 0.18s',
                  ...BASE_FONT,
                }}
                onMouseEnter={e => {
                  if (!isActive) e.currentTarget.style.background = '#c8c8cb';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = isActive ? '#c1fbd4' : '#d4d4d8';
                }}
              >
                {cat}
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── FOR YOU (RECOMMENDATIONS) ── */}
      <section style={{
        background: '#ffffff',
        borderTop: '1px solid #e4e4e7',
        padding: '48px 24px 64px',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 28 }}>
            <div>
              <h2 style={{
                fontSize: 24,
                fontWeight: 400,
                color: '#000',
                marginBottom: 4,
                ...BASE_FONT,
              }}>For You</h2>
              <p style={{ fontSize: 13, fontWeight: 420, color: '#71717a', ...BASE_FONT }}>
                Personalized picks based on your browsing and preferences
              </p>
            </div>
            <Link
              to="/shop/products"
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: '#000',
                textDecoration: 'none',
                borderBottom: '1px solid #000',
                paddingBottom: 1,
                ...BASE_FONT,
              }}
            >
              View all →
            </Link>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 20,
          }} className="stagger-children">
            {recsLoading
              ? Array(6).fill(0).map((_, i) => <ProductSkeleton key={i} />)
              : recs.length > 0
                ? recs.slice(0, 8).map(p => (
                    <ProductCard key={p.product_id} product={p} onAddToCart={handleAddToCart} onWishlist={handleWishlist} />
                  ))
                : (
                  <div style={{
                    gridColumn: '1 / -1', textAlign: 'center', padding: '48px 24px',
                    color: '#71717a',
                    ...BASE_FONT,
                  }}>
                    <p style={{ marginBottom: 12 }}>Browse some products to get personalized recommendations!</p>
                    <Link to="/shop/products" style={{
                      display: 'inline-block',
                      padding: '10px 24px',
                      borderRadius: 9999,
                      background: '#000', color: '#fff',
                      fontSize: 13, fontWeight: 500,
                      textDecoration: 'none',
                      ...BASE_FONT,
                    }}>
                      Explore Products →
                    </Link>
                  </div>
                )
            }
          </div>
        </div>
      </section>

      {/* ── TRENDING ── */}
      <section style={{ padding: '48px 24px 64px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{
            background: '#d4f9e0',
            borderRadius: 12,
            padding: 32,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 28 }}>
              <div>
                <h2 style={{
                  fontSize: 24,
                  fontWeight: 400,
                  color: '#000',
                  marginBottom: 4,
                  ...BASE_FONT,
                }}>Trending Now</h2>
                <p style={{ fontSize: 13, fontWeight: 420, color: '#71717a', ...BASE_FONT }}>
                  Top-rated products loved by our community
                </p>
              </div>
            </div>

            {/* Horizontal scroll strip */}
            <div className="c-scroll-strip" style={{ gap: 18 }}>
              {trendingLoading
                ? Array(5).fill(0).map((_, i) => (
                    <div key={i} style={{ width: 220, flexShrink: 0 }}>
                      <ProductSkeleton />
                    </div>
                  ))
                : trending.slice(0, 8).map(p => (
                    <div key={p.product_id} style={{ width: 220, flexShrink: 0 }}>
                      <ProductCard product={p} onAddToCart={handleAddToCart} onWishlist={handleWishlist} />
                    </div>
                  ))
              }
            </div>
          </div>
        </div>
      </section>

      {/* ── AI TRUST BANNER ── */}
      <section style={{ padding: '0 24px 64px', maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
        <div style={{
          background: '#c1fbd4',
          borderRadius: 12,
          padding: 32,
        }}>
          <h3 style={{
            fontSize: 22,
            fontWeight: 300,
            color: '#000',
            marginBottom: 12,
            ...BASE_FONT,
          }}>Powered by Autonomous AI</h3>
          <p style={{
            fontSize: 14,
            fontWeight: 420,
            color: '#3f3f46',
            lineHeight: 1.75,
            maxWidth: 500,
            margin: '0 auto',
            ...BASE_FONT,
          }}>
            Every recommendation, price, and stock update is generated by intelligent agents — with human oversight at every step.
          </p>
        </div>
      </section>

    </div>
  );
}
