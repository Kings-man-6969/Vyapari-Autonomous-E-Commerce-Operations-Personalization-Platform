import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../services/api';
import { useToast } from '../../shared/hooks/useToast';
import { SpinnerPage } from '../../shared/components/Spinner';
import { ProductCard } from '../../shared/components/ProductCard';
import '../../customer.css';

/* ─── DESIGN.MD — Transactional Track ───
   Canvas: #fbfbf5 cream
   Cards: #ffffff white, hairline border, Level-3 stacked shadow
   CTAs: solid black pill
─────────────────────────────────────────── */

export default function CustomerWishlist({ sessionId, onCartChange }) {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState(null);
  const [addingToCartId, setAddingToCartId] = useState(null);

  async function fetchWishlist() {
    setLoading(true);
    try {
      const data = await apiFetch(`/wishlist?session_id=${sessionId}`);
      setItems(data.items || data.products || []);
    } catch {
      setItems([]);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchWishlist();
  }, [sessionId]);

  async function handleRemove(product) {
    setRemovingId(product.product_id);
    try {
      await apiFetch(`/wishlist/${product.product_id}`, { method: 'DELETE' });
      setItems(prev => prev.filter(i => i.product_id !== product.product_id));
      showToast('Removed from wishlist', 'info');
      onCartChange?.();
    } catch (err) {
      showToast(err.message || 'Failed to remove', 'error');
    } finally { setRemovingId(null); }
  }

  async function handleAddToCart(product) {
    setAddingToCartId(product.product_id);
    try {
      await apiFetch(`/cart/add?session_id=${sessionId}`, {
        method: 'POST',
        body: JSON.stringify({ product_id: product.product_id, qty: 1 }),
      });
      showToast(`${product.name} added to cart!`, 'success');
      onCartChange?.();
    } catch (err) {
      showToast(err.message || 'Failed to add to cart', 'error');
    } finally { setAddingToCartId(null); }
  }

  if (loading) return (
    <div style={{ background: '#fbfbf5', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <SpinnerPage />
    </div>
  );

  return (
    <div style={{
      background: '#fbfbf5', minHeight: '100vh',
      padding: '48px 24px 80px',
      fontFamily: "'Inter', Helvetica, Arial, sans-serif",
      fontFeatureSettings: '"ss03"',
    }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{
              fontSize: 'clamp(2rem, 5vw, 55px)',
              fontWeight: 300, color: '#000000',
              lineHeight: 1.16, fontFeatureSettings: '"ss03"',
            }}>
              Wishlist
            </h1>
            <p style={{ fontSize: 16, fontWeight: 420, color: '#71717a', marginTop: 6, fontFeatureSettings: '"ss03"' }}>
              {items.length} item{items.length !== 1 ? 's' : ''} saved for later.
            </p>
          </div>
          {items.length > 0 && (
            <Link to="/shop/products" style={{
              padding: '9px 20px', borderRadius: 9999,
              border: '1px solid #e4e4e7', background: '#ffffff',
              fontSize: 14, fontWeight: 420, color: '#000000',
              textDecoration: 'none', transition: 'border-color 0.18s',
              fontFeatureSettings: '"ss03"',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#000000'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#e4e4e7'}
            >
              Continue Shopping
            </Link>
          )}
        </div>

        {/* Hairline divider */}
        <div style={{ height: 1, background: '#e4e4e7', margin: '24px 0 40px' }} />

        {items.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '80px 24px',
            background: '#ffffff', border: '1px solid #e4e4e7',
            borderRadius: 12, maxWidth: 560, margin: '0 auto',
            boxShadow: '0 2px 2px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
          }}>
            <div style={{ fontSize: '3.5rem', marginBottom: 20 }}>♡</div>
            <h2 style={{ fontSize: 24, fontWeight: 400, color: '#000000', marginBottom: 10, fontFeatureSettings: '"ss03"' }}>
              Your wishlist is empty
            </h2>
            <p style={{ fontSize: 16, fontWeight: 420, color: '#71717a', marginBottom: 32, fontFeatureSettings: '"ss03"' }}>
              Save items you love to find them later.
            </p>
            <Link to="/shop/products" style={{
              display: 'inline-flex', padding: '12px 28px',
              background: '#000000', color: '#ffffff',
              borderRadius: 9999, fontWeight: 420, fontSize: 15,
              textDecoration: 'none', transition: 'background 0.18s',
              fontFeatureSettings: '"ss03"',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#3f3f46'}
            onMouseLeave={e => e.currentTarget.style.background = '#000000'}
            >
              Browse Products
            </Link>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 24,
          }}>
            {items.map((item, idx) => (
              <div
                key={item.product_id}
                style={{
                  opacity: removingId === item.product_id ? 0.4 : 1,
                  transition: 'opacity 0.2s',
                  animation: `floatIn 0.4s ease ${idx * 40}ms both`,
                }}
              >
                <ProductCard
                  product={item}
                  onAddToCart={handleAddToCart}
                  onWishlist={handleRemove}
                  inWishlist={true}
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
