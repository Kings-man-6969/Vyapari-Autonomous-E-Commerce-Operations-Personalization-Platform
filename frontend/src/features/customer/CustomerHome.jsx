import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '@/services/api'
import { useToast } from '@/shared/components/Toast'
import Spinner from '@/shared/components/Spinner'
import EmptyState from '@/shared/components/EmptyState'
import '@/customer.css'

/*
  CUSTOMER HOME — Playfair Display headings, Source Sans 3 body
  Warm emerald palette, editorial product grid
*/

const CATEGORIES = ['All', 'Electronics', 'Clothing', 'Books', 'Home & Kitchen', 'Sports']
const SORTS = [
  { value: '',           label: 'Featured' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc',label: 'Price: High → Low' },
  { value: 'newest',    label: 'Newest First' },
]
const CAT_EMOJI = { Electronics:'💻', Clothing:'👕', Books:'📚', 'Home & Kitchen':'🏠', Sports:'⚽', default:'📦' }

function StockBadge({ stock }) {
  if (stock <= 0)  return <span className="stock-badge out-stock">Out of Stock</span>
  if (stock < 5)   return <span className="stock-badge low-stock">Only {stock} left</span>
  return <span className="stock-badge in-stock">In Stock</span>
}

export default function CustomerHome({ sessionId, onAddToCart }) {
  const toast = useToast()
  const [products, setProducts]     = useState([])
  const [recs, setRecs]             = useState([])
  const [loading, setLoading]       = useState(true)
  const [recsLoading, setRecsLoading] = useState(true)
  const [category, setCategory]     = useState('')
  const [sort, setSort]             = useState('')
  const [page, setPage]             = useState(1)
  const [total, setTotal]           = useState(0)
  const [addingId, setAddingId]     = useState(null)
  const PER_PAGE = 12

  const loadProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, per_page: PER_PAGE })
      if (category) params.set('category', category)
      if (sort)     params.set('sort', sort)
      const data = await apiFetch(`/products?${params}`)
      setProducts(data.products || [])
      setTotal(data.total || 0)
    } catch (err) { toast.error(err.message) }
    finally { setLoading(false) }
  }, [category, sort, page])

  useEffect(() => { loadProducts() }, [loadProducts])
  useEffect(() => { setPage(1) }, [category, sort])

  useEffect(() => {
    setRecsLoading(true)
    apiFetch(`/recommendations/${sessionId}?top_n=6`)
      .then(d => setRecs(d.recommendations || []))
      .catch(() => {})
      .finally(() => setRecsLoading(false))
  }, [sessionId])

  async function handleAddToCart(productId) {
    setAddingId(productId)
    try { await onAddToCart(productId, 1); toast.success('Added to cart!') }
    catch (err) { toast.error(err.message) }
    finally { setAddingId(null) }
  }

  const totalPages = Math.ceil(total / PER_PAGE)

  return (
    <div className="customer-content">
      {/* ── HERO ── */}
      <div className="shop-hero">
        <div className="shop-hero-eyebrow">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
          AI-Curated Selection
        </div>
        <h1 className="shop-hero-title">
          Discover <em>great</em><br/>products
        </h1>
        <p className="shop-hero-sub">
          Browse our curated catalog — powered by Vyapari's personalization engine.
        </p>
      </div>

      <div className="customer-page">
        {/* ── RECOMMENDATIONS ── */}
        {(recsLoading || recs.length > 0) && (
          <section style={{ marginBottom: 52 }}>
            <div style={{ marginBottom: 20 }}>
              <div className="section-eyebrow">Personalized for You</div>
              <h2 className="section-title">Recommended Picks</h2>
              <p className="section-sub">Curated based on popularity and your browsing signals</p>
            </div>
            {recsLoading
              ? <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Spinner size="md" /></div>
              : (
                <div className="rec-strip">
                  {recs.map((rec, i) => (
                    <Link
                      key={rec.product_id}
                      to={`/shop/product/${rec.product_id}`}
                      className="rec-card"
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      <div style={{ fontSize: 32, marginBottom: 10 }}>{CAT_EMOJI.default}</div>
                      <div className="rec-card-name">{rec.name}</div>
                      <div className="rec-card-match">{Math.round(rec.confidence * 100)}% match</div>
                      <div className="rec-card-price">₹{Number(rec.price).toFixed(2)}</div>
                    </Link>
                  ))}
                </div>
              )
            }
          </section>
        )}

        {/* ── FILTERS ── */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 28 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1 }}>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                className={`category-pill${category === (c === 'All' ? '' : c) ? ' active' : ''}`}
                onClick={() => setCategory(c === 'All' ? '' : c)}
              >
                {c !== 'All' && <span style={{ marginRight: 4 }}>{CAT_EMOJI[c]}</span>}
                {c}
              </button>
            ))}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            style={{
              padding: '8px 36px 8px 14px', borderRadius: 'var(--r-full)',
              border: '1px solid rgba(52,211,153,.18)',
              background: 'rgba(16,185,129,.05)',
              color: 'rgba(167,243,208,.7)',
              fontSize: 13, fontFamily: "'Source Sans 3', sans-serif",
              outline: 'none', cursor: 'pointer',
              backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2334d399' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
            }}
          >
            {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        {/* ── HEADER ── */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, fontWeight: 800, color: '#ecfdf5' }}>
            {category || 'All Products'}
          </h2>
          <span style={{ fontSize: 13, color: 'rgba(167,243,208,.4)', fontFamily: "'Source Sans 3', sans-serif" }}>
            {total} items
          </span>
        </div>

        {/* ── GRID ── */}
        {loading
          ? (
            <div className="product-grid">
              {[...Array(8)].map((_, i) => (
                <div key={i} style={{ borderRadius: 'var(--r-xl)', overflow: 'hidden', border: '1px solid rgba(52,211,153,.08)', background: '#0d1f14' }}>
                  <div className="skeleton" style={{ height: 190 }} />
                  <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className="skeleton" style={{ height: 16, width: '75%' }} />
                    <div className="skeleton" style={{ height: 12, width: '45%' }} />
                    <div className="skeleton" style={{ height: 20, width: '35%', marginTop: 8 }} />
                  </div>
                </div>
              ))}
            </div>
          )
          : products.length === 0
            ? <EmptyState title="No products found" description="Try a different category or sort order." icon="🛍️" />
            : (
              <div className="product-grid stagger-children">
                {products.map((p) => (
                  <ProductCard
                    key={p.product_id}
                    product={p}
                    onAddToCart={() => handleAddToCart(p.product_id)}
                    adding={addingId === p.product_id}
                  />
                ))}
              </div>
            )
        }

        {/* ── PAGINATION ── */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 40 }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="cust-btn-secondary cust-btn-sm"
            >← Prev</button>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(167,243,208,.5)', fontFamily: "'Source Sans 3', sans-serif" }}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="cust-btn-secondary cust-btn-sm"
            >Next →</button>
          </div>
        )}
      </div>
    </div>
  )
}

function ProductCard({ product, onAddToCart, adding }) {
  const emoji  = CAT_EMOJI[product.category] || CAT_EMOJI.default
  const inStock = product.stock > 0

  return (
    <div className="product-card animate-slide-in">
      <Link to={`/shop/product/${product.product_id}`} style={{ display: 'contents', textDecoration: 'none' }}>
        <div className="product-card-image">{emoji}</div>
        <div className="product-card-body">
          <div className="product-card-cat">{product.category}</div>
          <div className="product-card-name">{product.name}</div>
          <StockBadge stock={product.stock} />
        </div>
      </Link>
      <div className="product-card-footer">
        <span className="product-card-price">₹{Number(product.price).toFixed(2)}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onAddToCart() }}
          disabled={!inStock || adding}
          className="cust-btn-primary cust-btn-sm"
          title={inStock ? 'Add to cart' : 'Out of stock'}
        >
          {adding
            ? <Spinner size="sm" color="#fff" />
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
          }
        </button>
      </div>
    </div>
  )
}
