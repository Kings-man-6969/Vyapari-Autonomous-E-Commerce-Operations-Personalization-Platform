import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiFetch } from '@/services/api'
import { useToast } from '@/shared/components/Toast'
import Spinner from '@/shared/components/Spinner'
import EmptyState from '@/shared/components/EmptyState'
import '@/customer.css'

const CAT_EMOJI = { Electronics:'💻', Clothing:'👕', Books:'📚', 'Home & Kitchen':'🏠', Sports:'⚽', default:'📦' }

function StockBadge({ stock }) {
  if (stock <= 0)  return <span className="stock-badge out-stock">Out of Stock</span>
  if (stock < 5)   return <span className="stock-badge low-stock">Only {stock} left</span>
  return <span className="stock-badge in-stock">In Stock</span>
}

export default function CustomerSearch({ onAddToCart }) {
  const [searchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const toast = useToast()
  const [results, setResults]   = useState([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(false)
  const [addingId, setAddingId] = useState(null)

  useEffect(() => {
    if (!query || query.length < 2) { setResults([]); setTotal(0); return }
    setLoading(true)
    apiFetch(`/search?q=${encodeURIComponent(query)}&top_n=20`)
      .then((data) => { setResults(data.products || data.results || []); setTotal(data.total || 0) })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false))
  }, [query])

  async function handleAddToCart(productId, name) {
    setAddingId(productId)
    try { await onAddToCart(productId, 1); toast.success(`"${name}" added to cart!`) }
    catch (err) { toast.error(err.message) }
    finally { setAddingId(null) }
  }

  return (
    <div className="customer-content animate-fade-in">
      <div className="customer-page">
        {/* Breadcrumb */}
        <div style={{ fontSize: 13, color: 'rgba(167,243,208,.4)', marginBottom: 8, fontFamily: "'Source Sans 3', sans-serif" }}>
          <Link to="/shop" style={{ color: '#34d399', textDecoration: 'none' }}>Shop</Link>
          {' › '}Search
        </div>

        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 36, fontWeight: 900, color: '#ecfdf5', letterSpacing: '-0.03em', marginBottom: 8 }}>
            Search Results
          </h1>
          {query && (
            <p style={{ color: 'rgba(167,243,208,.5)', fontSize: 15, fontFamily: "'Source Sans 3', sans-serif" }}>
              {loading ? 'Searching…' : (
                <>{total} result{total !== 1 ? 's' : ''} for{' '}
                  <span style={{ fontWeight: 700, color: '#d1fae5' }}>"{query}"</span>
                </>
              )}
            </p>
          )}
        </div>

        {!query
          ? (
            <EmptyState
              title="Enter a search term"
              description="Use the search bar above to find products by name or category."
              icon="🔍"
            />
          )
          : loading
            ? <div style={{ display: 'flex', justifyContent: 'center', padding: 72 }}><Spinner size="lg" /></div>
            : results.length === 0
              ? (
                <EmptyState
                  title={`No results for "${query}"`}
                  description="Try different keywords, check spelling, or browse all categories."
                  icon="📭"
                  action={<Link to="/shop" className="cust-btn-primary">Browse All Products</Link>}
                />
              )
              : (
                <div className="product-grid stagger-children">
                  {results.map((p) => {
                    const emoji   = CAT_EMOJI[p.category] || CAT_EMOJI.default
                    const inStock = p.stock > 0
                    const isAdding = addingId === p.product_id
                    return (
                      <div key={p.product_id} className="product-card animate-slide-in">
                        <Link to={`/shop/product/${p.product_id}`} style={{ display: 'contents', textDecoration: 'none' }}>
                          <div className="product-card-image">{emoji}</div>
                          <div className="product-card-body">
                            <div className="product-card-cat">{p.category}</div>
                            <div className="product-card-name">{p.name}</div>
                            {/* Match chip */}
                            {p.score && (
                              <span className="match-chip">
                                ✦ Matched: "{query}"
                              </span>
                            )}
                            <StockBadge stock={p.stock} />
                          </div>
                        </Link>
                        <div className="product-card-footer">
                          <span className="product-card-price">₹{Number(p.price).toFixed(2)}</span>
                          <button
                            onClick={() => handleAddToCart(p.product_id, p.name)}
                            disabled={!inStock || isAdding}
                            className="cust-btn-primary cust-btn-sm"
                            title={inStock ? 'Add to cart' : 'Out of stock'}
                          >
                            {isAdding ? <Spinner size="sm" color="#fff" /> : '🛒'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
        }
      </div>
    </div>
  )
}
