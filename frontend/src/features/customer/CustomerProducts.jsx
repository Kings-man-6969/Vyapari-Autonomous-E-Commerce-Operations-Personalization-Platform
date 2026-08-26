import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../services/api';
import { useToast } from '../../shared/hooks/useToast';
import { ProductCard, ProductSkeleton } from '../../shared/components/ProductCard';
import '../../customer.css';

const CATEGORIES = ['Electronics', 'Clothing', 'Books', 'Home & Kitchen', 'Sports'];

const INPUT_STYLE = {
  background: '#ffffff',
  border: '1px solid #e4e4e7',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 13,
  fontFamily: "'Inter', sans-serif",
  fontFeatureSettings: '"ss03"',
  color: '#000',
  outline: 'none',
  boxSizing: 'border-box',
};

export default function CustomerProducts({ sessionId, token, onCartChange }) {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const perPage = 12;

  // Filters
  const [selectedCats, setSelectedCats] = useState(() => {
    const cat = searchParams.get('category');
    return cat ? [cat] : [];
  });
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState(searchParams.get('sort') || 'newest');

  function buildParams() {
    const p = new URLSearchParams();
    p.set('page', page);
    p.set('per_page', perPage);
    if (sort) p.set('sort', sort);
    if (selectedCats.length === 1) p.set('category', selectedCats[0]);
    if (minPrice) p.set('min_price', minPrice);
    if (maxPrice) p.set('max_price', maxPrice);
    if (inStockOnly) p.set('in_stock', 'true');
    return p.toString();
  }

  useEffect(() => {
    setLoading(true);
    apiFetch(`/products?${buildParams()}`)
      .then(d => {
        setProducts(d.items || d.products || []);
        setTotal(d.total || 0);
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  // eslint-disable-next-line
  }, [page, sort, selectedCats, minPrice, maxPrice, inStockOnly]);

  async function handleAddToCart(product) {
    try {
      await apiFetch(`/cart/add?session_id=${sessionId}`, {
        method: 'POST',
        body: JSON.stringify({ product_id: product.product_id, qty: 1 }),
      });
      showToast(`${product.name} added to cart!`, 'success');
      onCartChange?.();
    } catch (err) {
      showToast(err.message || 'Failed to add to cart', 'error');
    }
  }

  async function handleWishlist(product) {
    if (!token) { showToast('Sign in to save to wishlist', 'info'); return; }
    try {
      await apiFetch(`/wishlist/${product.product_id}`, {
        method: 'POST',
      });
      showToast('Saved to wishlist!', 'success');
      onCartChange?.();
    } catch (err) {
      showToast(err.message || 'Failed', 'error');
    }
  }

  function toggleCat(cat) {
    setSelectedCats(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
    setPage(1);
  }

  function clearFilters() {
    setSelectedCats([]);
    setMinPrice('');
    setMaxPrice('');
    setInStockOnly(false);
    setSort('newest');
    setPage(1);
  }

  const totalPages = Math.ceil(total / perPage);

  return (
    <div style={{
      background: '#fbfbf5',
      minHeight: '100vh',
      padding: '40px 24px 80px',
      fontFamily: "'Inter', sans-serif",
      fontFeatureSettings: '"ss03"',
    }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', gap: 32 }}>

        {/* ── FILTER SIDEBAR ── */}
        <aside style={{
          width: 272,
          flexShrink: 0,
          background: '#ffffff',
          border: '1px solid #e4e4e7',
          borderRadius: 12,
          padding: 24,
          alignSelf: 'start',
          position: 'sticky',
          top: 80,
          boxShadow: '0 4px 4px rgba(0,0,0,0.07), 0 2px 2px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)',
          fontFeatureSettings: '"ss03"',
        }}>

          {/* Sidebar header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <span style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.72px',
              textTransform: 'uppercase',
              color: '#000',
              fontFamily: "'Inter', sans-serif",
              fontFeatureSettings: '"ss03"',
            }}>
              Filters
            </span>
            <button
              onClick={clearFilters}
              style={{
                border: '1px solid #000',
                background: 'transparent',
                borderRadius: 9999,
                padding: '8px 20px',
                color: '#000',
                fontSize: 12,
                fontFamily: "'Inter', sans-serif",
                fontFeatureSettings: '"ss03"',
                letterSpacing: '0.4px',
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              Clear
            </button>
          </div>

          {/* Categories */}
          <div style={{ marginBottom: 28 }}>
            <div style={{
              fontSize: 12,
              fontWeight: 400,
              color: '#71717a',
              marginBottom: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.72px',
              fontFamily: "'Inter', sans-serif",
              fontFeatureSettings: '"ss03"',
            }}>
              Category
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => toggleCat(cat)}
                  style={{
                    borderRadius: 9999,
                    fontSize: 12,
                    letterSpacing: '0.72px',
                    textTransform: 'uppercase',
                    fontFamily: "'Inter', sans-serif",
                    fontFeatureSettings: '"ss03"',
                    padding: '6px 14px',
                    border: 'none',
                    cursor: 'pointer',
                    background: selectedCats.includes(cat) ? '#c1fbd4' : '#d4d4d8',
                    color: '#000',
                    fontWeight: selectedCats.includes(cat) ? 600 : 400,
                    transition: 'background 0.15s',
                    lineHeight: 1,
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Price Range */}
          <div style={{ marginBottom: 28 }}>
            <div style={{
              fontSize: 12,
              fontWeight: 400,
              color: '#71717a',
              marginBottom: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.72px',
              fontFamily: "'Inter', sans-serif",
              fontFeatureSettings: '"ss03"',
            }}>
              Price Range
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                type="number"
                placeholder="Min ₹"
                value={minPrice}
                onChange={e => { setMinPrice(e.target.value); setPage(1); }}
                style={{ ...INPUT_STYLE, flex: 1, minWidth: 0 }}
              />
              <input
                type="number"
                placeholder="Max ₹"
                value={maxPrice}
                onChange={e => { setMaxPrice(e.target.value); setPage(1); }}
                style={{ ...INPUT_STYLE, flex: 1, minWidth: 0 }}
              />
            </div>
          </div>

          {/* In Stock */}
          <div style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              id="in-stock-toggle"
              type="checkbox"
              checked={inStockOnly}
              onChange={() => { setInStockOnly(!inStockOnly); setPage(1); }}
              style={{ width: 16, height: 16, accentColor: '#000', cursor: 'pointer' }}
            />
            <label
              htmlFor="in-stock-toggle"
              style={{
                fontSize: 13,
                color: '#000',
                fontFamily: "'Inter', sans-serif",
                fontFeatureSettings: '"ss03"',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              In Stock Only
            </label>
          </div>
        </aside>

        {/* ── PRODUCT GRID ── */}
        <main style={{ flex: 1, minWidth: 0 }}>

          {/* Header Area */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32 }}>
            <div>
              <h1 style={{
                fontFamily: "'Inter', sans-serif",
                fontFeatureSettings: '"ss03"',
                fontSize: 28,
                fontWeight: 300,
                color: '#000',
                margin: '0 0 6px 0',
                letterSpacing: '-0.5px',
              }}>
                {selectedCats.length === 1 ? selectedCats[0] : 'The Collection'}
              </h1>
              {!loading && (
                <div style={{
                  fontSize: 12,
                  fontWeight: 400,
                  letterSpacing: '0.72px',
                  textTransform: 'uppercase',
                  color: '#71717a',
                  fontFamily: "'Inter', sans-serif",
                  fontFeatureSettings: '"ss03"',
                }}>
                  Showing {products.length} of {total} products
                </div>
              )}
            </div>

            {/* Sort Dropdown */}
            <select
              value={sort}
              onChange={e => { setSort(e.target.value); setPage(1); }}
              style={{
                ...INPUT_STYLE,
                width: 'auto',
                appearance: 'none',
                WebkitAppearance: 'none',
                paddingRight: 36,
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%2371717a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 5l3 3 3-3'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                cursor: 'pointer',
              }}
            >
              <option value="newest">Newest Arrivals</option>
              <option value="rating">Highest Rated</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </div>

          {/* Grid Content */}
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 24 }} className="stagger-children">
              {Array.from({ length: 12 }).map((_, i) => <ProductSkeleton key={i} />)}
            </div>
          ) : products.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '100px 20px',
              background: '#ffffff',
              borderRadius: 12,
              border: '1px solid #e4e4e7',
            }}>
              <div style={{ fontSize: '3rem', marginBottom: 20, opacity: 0.5 }}>🍃</div>
              <h3 style={{
                fontSize: 20,
                fontFamily: "'Inter', sans-serif",
                fontFeatureSettings: '"ss03"',
                fontWeight: 300,
                color: '#000',
                marginBottom: 8,
              }}>
                Nothing found
              </h3>
              <p style={{
                color: '#71717a',
                fontFamily: "'Inter', sans-serif",
                fontFeatureSettings: '"ss03"',
                fontSize: 14,
                marginBottom: 20,
              }}>
                Try adjusting your filters or search criteria.
              </p>
              <button
                onClick={clearFilters}
                style={{
                  padding: '8px 20px',
                  border: '1px solid #000',
                  background: 'transparent',
                  borderRadius: 9999,
                  color: '#000',
                  fontSize: 12,
                  fontFamily: "'Inter', sans-serif",
                  fontFeatureSettings: '"ss03"',
                  letterSpacing: '0.72px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 24 }} className="stagger-children">
              {products.map(p => (
                <ProductCard key={p.product_id} product={p} onAddToCart={handleAddToCart} onWishlist={handleWishlist} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', marginTop: 64 }}>
              <button
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                style={{
                  padding: '10px 20px',
                  borderRadius: 9999,
                  background: 'transparent',
                  border: '1px solid #e4e4e7',
                  color: page === 1 ? '#a1a1aa' : '#000',
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  fontFamily: "'Inter', sans-serif",
                  fontFeatureSettings: '"ss03"',
                  fontSize: 13,
                  opacity: page === 1 ? 0.4 : 1,
                }}
              >
                ← Prev
              </button>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const startPage = Math.max(1, Math.min(page - 2, totalPages - Math.min(5, totalPages) + 1));
                  const pageNum = startPage + i;
                  if (pageNum > totalPages) return null;
                  const active = page === pageNum;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: active ? '#000' : 'transparent',
                        border: active ? '1px solid #000' : '1px solid #e4e4e7',
                        color: active ? '#fff' : '#000',
                        fontWeight: active ? 600 : 400,
                        cursor: 'pointer',
                        fontFamily: "'Inter', sans-serif",
                        fontFeatureSettings: '"ss03"',
                        fontSize: 13,
                      }}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                style={{
                  padding: '10px 20px',
                  borderRadius: 9999,
                  background: 'transparent',
                  border: '1px solid #e4e4e7',
                  color: page >= totalPages ? '#a1a1aa' : '#000',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  fontFamily: "'Inter', sans-serif",
                  fontFeatureSettings: '"ss03"',
                  fontSize: 13,
                  opacity: page >= totalPages ? 0.4 : 1,
                }}
              >
                Next →
              </button>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

