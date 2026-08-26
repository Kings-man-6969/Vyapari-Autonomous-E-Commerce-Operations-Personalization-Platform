import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../services/api';
import { useToast } from '../../shared/hooks/useToast';
import { SpinnerPage } from '../../shared/components/Spinner';
import { ProductCard } from '../../shared/components/ProductCard';
import '../../customer.css';

/* ─── DESIGN.MD — Transactional Track ─── */

const fmt = (n) => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0 });

export default function CustomerSearch({ sessionId, onCartChange }) {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const { showToast } = useToast();

  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (!query || query.length < 2) { setResults([]); setTotal(0); return; }
    setLoading(true);
    apiFetch(`/search?q=${encodeURIComponent(query)}&top_n=20`)
      .then((data) => { setResults(data.products || data.results || []); setTotal(data.total || 0); })
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, [query]);

  async function handleAddToCart(product) {
    setAddingId(product.product_id);
    try {
      await apiFetch(`/cart/add?session_id=${sessionId}`, {
        method: 'POST',
        body: JSON.stringify({ product_id: product.product_id, qty: 1 }),
      });
      showToast(`"${product.name}" added to cart!`, 'success');
      onCartChange?.();
    } catch (err) {
      showToast(err.message || 'Failed to add', 'error');
    } finally { setAddingId(null); }
  }

  return (
    <div style={{
      background: '#fbfbf5', minHeight: '100vh',
      padding: '48px 24px 80px',
      fontFamily: "'Inter', Helvetica, Arial, sans-serif",
      fontFeatureSettings: '"ss03"',
    }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>

        {/* Breadcrumb — eyebrow-cap style */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 12, fontWeight: 400, color: '#71717a',
          letterSpacing: '0.72px', textTransform: 'uppercase',
          marginBottom: 32, fontFeatureSettings: '"ss03"',
        }}>
          <Link to="/shop" style={{ color: '#000000', textDecoration: 'none' }}
            onMouseEnter={e => e.target.style.opacity = '0.5'}
            onMouseLeave={e => e.target.style.opacity = '1'}
          >Home</Link>
          <span style={{ color: '#d4d4d8' }}>/</span>
          <span>Search</span>
        </div>

        {/* Heading */}
        <div style={{ marginBottom: 48 }}>
          <h1 style={{
            fontSize: 'clamp(2rem, 5vw, 55px)',
            fontWeight: 300, color: '#000000',
            lineHeight: 1.16, marginBottom: 10,
            fontFeatureSettings: '"ss03"',
          }}>
            Search Results
          </h1>
          {query && (
            <p style={{ fontSize: 16, fontWeight: 420, color: '#71717a', fontFeatureSettings: '"ss03"' }}>
              {loading ? 'Searching…' : (
                <>
                  {total} result{total !== 1 ? 's' : ''} for{' '}
                  <span style={{ color: '#000000', fontWeight: 500 }}>"{query}"</span>
                </>
              )}
            </p>
          )}
        </div>

        {/* States */}
        {!query ? (
          <EmptyState
            icon="🔍"
            title="Enter a search term"
            body="Use the search bar to find products by name, category, or description."
            cta={null}
          />
        ) : loading ? (
          <div style={{ padding: 80 }}><SpinnerPage /></div>
        ) : results.length === 0 ? (
          <EmptyState
            icon="📭"
            title="No results found"
            body={`We couldn't find anything matching "${query}". Try different keywords or browse our catalogue.`}
            ctaLabel="Browse All Products"
            ctaTo="/shop/products"
          />
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 24,
          }}>
            {results.map((p, idx) => (
              <div key={p.product_id} style={{ animation: `floatIn 0.4s ease ${idx * 30}ms both` }}>
                <ProductCard
                  product={p}
                  onAddToCart={() => handleAddToCart(p)}
                  addingCart={addingId === p.product_id}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes floatIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function EmptyState({ icon, title, body, ctaLabel, ctaTo }) {
  return (
    <div style={{
      textAlign: 'center', padding: '80px 24px',
      background: '#ffffff', border: '1px solid #e4e4e7',
      borderRadius: 12, maxWidth: 560, margin: '0 auto',
      boxShadow: '0 2px 2px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
    }}>
      <div style={{ fontSize: '3.5rem', marginBottom: 20 }}>{icon}</div>
      <h2 style={{ fontSize: 24, fontWeight: 400, color: '#000000', marginBottom: 10, fontFeatureSettings: '"ss03"' }}>{title}</h2>
      <p style={{ fontSize: 15, fontWeight: 420, color: '#71717a', marginBottom: ctaTo ? 32 : 0, lineHeight: 1.6, fontFeatureSettings: '"ss03"' }}>{body}</p>
      {ctaTo && (
        <Link to={ctaTo} style={{
          display: 'inline-flex', padding: '12px 28px',
          background: '#000000', color: '#ffffff',
          borderRadius: 9999, fontWeight: 420, fontSize: 15,
          textDecoration: 'none', transition: 'background 0.18s',
          fontFeatureSettings: '"ss03"',
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#3f3f46'}
        onMouseLeave={e => e.currentTarget.style.background = '#000000'}
        >{ctaLabel}</Link>
      )}
    </div>
  );
}
