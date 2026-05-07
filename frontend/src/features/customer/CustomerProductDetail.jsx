import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { apiFetch } from '@/services/api'
import { useToast } from '@/shared/components/Toast'
import Spinner from '@/shared/components/Spinner'
import EmptyState from '@/shared/components/EmptyState'
import '@/customer.css'

const CAT_EMOJI = { Electronics:'💻', Clothing:'👕', Books:'📚', 'Home & Kitchen':'🏠', Sports:'⚽', default:'📦' }

function StarRating({ stars, max = 5, interactive = false, onRate }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="stars-display">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          style={{
            fontSize: interactive ? 24 : 15,
            color: (hover || stars) > i ? '#d97706' : 'rgba(52,211,153,.15)',
            cursor: interactive ? 'pointer' : 'default',
            transition: 'color 100ms',
          }}
          onClick={() => interactive && onRate?.(i + 1)}
          onMouseEnter={() => interactive && setHover(i + 1)}
          onMouseLeave={() => interactive && setHover(0)}
        >★</span>
      ))}
    </div>
  )
}

function StockBadge({ stock }) {
  if (stock <= 0)  return <span className="stock-badge out-stock">Out of Stock</span>
  if (stock < 5)   return <span className="stock-badge low-stock">Only {stock} units left</span>
  return <span className="stock-badge in-stock">In Stock — {stock} units</span>
}

export default function CustomerProductDetail({ sessionId, token, userId, onAddToCart }) {
  const { productId } = useParams()
  const navigate = useNavigate()
  const toast    = useToast()
  const [product, setProduct]       = useState(null)
  const [reviews, setReviews]       = useState([])
  const [avgStars, setAvgStars]     = useState(0)
  const [loading, setLoading]       = useState(true)
  const [qty, setQty]               = useState(1)
  const [adding, setAdding]         = useState(false)
  const [addingToWishlist, setAddingToWishlist] = useState(false)
  const [reviewStars, setReviewStars] = useState(0)
  const [reviewText, setReviewText]   = useState('')
  const [submitting, setSubmitting]   = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([apiFetch(`/products/${productId}`), apiFetch(`/products/${productId}/reviews`)])
      .then(([prod, revData]) => {
        setProduct(prod)
        setReviews(revData.reviews || [])
        setAvgStars(revData.avg_stars || 0)
      })
      .catch((err) => { toast.error(err.message); navigate('/shop') })
      .finally(() => setLoading(false))
  }, [productId])

  async function handleAddToCart() {
    if (qty < 1 || !product) return
    setAdding(true)
    try { await onAddToCart(product.product_id, qty); toast.success(`${qty} × "${product.name}" added!`) }
    catch (err) { toast.error(err.message) }
    finally { setAdding(false) }
  }

  async function handleAddToWishlist() {
    if (!product) return
    if (!token) {
      toast.info("Please sign in to add to wishlist")
      return
    }
    setAddingToWishlist(true)
    try {
      await apiFetch('/wishlist', {
        method: 'POST',
        body: JSON.stringify({ product_id: product.product_id })
      }, token)
      toast.success("Added to wishlist!")
    } catch (err) {
      toast.error("Failed to add to wishlist")
    } finally {
      setAddingToWishlist(false)
    }
  }

  async function handleSubmitReview(e) {
    e.preventDefault()
    if (reviewStars === 0) { toast.warning('Please select a star rating.'); return }
    if (reviewText.trim().length < 10) { toast.warning('Review must be at least 10 characters.'); return }
    setSubmitting(true)
    try {
      await apiFetch('/reviews', {
        method: 'POST',
        body: JSON.stringify({ product_id: productId, user_id: userId || 'anonymous', stars: reviewStars, text: reviewText.trim() }),
      })
      toast.success('Review submitted! It will appear after moderation.')
      setReviewStars(0); setReviewText('')
      const revData = await apiFetch(`/products/${productId}/reviews`)
      setReviews(revData.reviews || [])
      setAvgStars(revData.avg_stars || 0)
    } catch (err) { toast.error(err.message) }
    finally { setSubmitting(false) }
  }

  if (loading) return (
    <div className="customer-content">
      <div className="customer-page" style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spinner size="xl" />
      </div>
    </div>
  )
  if (!product) return null

  const emoji   = CAT_EMOJI[product.category] || CAT_EMOJI.default
  const inStock = product.stock > 0

  return (
    <div className="customer-content animate-fade-in">
      <div className="customer-page">
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28, fontSize: 13, color: 'rgba(167,243,208,.45)', fontFamily: "'Source Sans 3', sans-serif" }}>
          <Link to="/shop" style={{ color: '#34d399', textDecoration: 'none' }}>Shop</Link>
          <span>›</span><span>{product.category}</span><span>›</span>
          <span style={{ color: '#d1fae5' }}>{product.name}</span>
        </div>

        {/* Product layout */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32, marginBottom: 48 }}>
          {/* Image panel */}
          <div style={{
            background: 'linear-gradient(160deg, #0d1f14 0%, #0f2918 100%)',
            border: '1px solid rgba(52,211,153,.1)',
            borderRadius: 'var(--r-2xl)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: 52, minHeight: 300,
          }}>
            <div style={{ fontSize: 100 }}>{emoji}</div>
            {product.category && (
              <div style={{ marginTop: 16, padding: '4px 14px', borderRadius: 'var(--r-full)', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(52,211,153,.2)', color: '#6ee7b7', fontSize: 12, fontWeight: 700, fontFamily: "'Source Sans 3', sans-serif", letterSpacing: '.06em' }}>
                {product.category}
              </div>
            )}
          </div>

          {/* Details */}
          <div>
            <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(26px,4vw,38px)', fontWeight: 900, color: '#ecfdf5', letterSpacing: '-0.03em', marginBottom: 14, lineHeight: 1.15 }}>
              {product.name}
            </h1>

            {reviews.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <StarRating stars={Math.round(avgStars)} />
                <span style={{ fontWeight: 700, color: '#d1fae5', fontSize: 14, fontFamily: "'Source Sans 3', sans-serif" }}>{avgStars.toFixed(1)}</span>
                <span style={{ color: 'rgba(167,243,208,.4)', fontSize: 13, fontFamily: "'Source Sans 3', sans-serif" }}>({reviews.length} review{reviews.length !== 1 ? 's' : ''})</span>
              </div>
            )}

            <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(32px,5vw,48px)', fontWeight: 900, color: '#34d399', letterSpacing: '-0.04em', marginBottom: 12 }}>
              ₹{Number(product.price).toFixed(2)}
            </div>

            <div style={{ marginBottom: 24 }}>
              <StockBadge stock={product.stock} />
            </div>

            {inStock && (
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 28, flexWrap: 'wrap' }}>
                <div className="qty-stepper">
                  <button onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
                  <span>{qty}</span>
                  <button onClick={() => setQty(q => Math.min(product.stock, q + 1))}>+</button>
                </div>
                <button
                  onClick={handleAddToCart}
                  disabled={adding}
                  className="cust-btn-primary cust-btn-lg"
                  style={{ flex: 1 }}
                >
                  {adding ? <><Spinner size="sm" color="#fff" /> Adding…</> : '🛒 Add to Cart'}
                </button>
                {token && (
                  <button
                    onClick={handleAddToWishlist}
                    disabled={addingToWishlist}
                    className="btn btn-secondary"
                    style={{ padding: '0 20px', fontSize: 18 }}
                    title="Add to Wishlist"
                  >
                    {addingToWishlist ? <Spinner size="sm" /> : '🤍'}
                  </button>
                )}
              </div>
            )}

            {/* Product ID */}
            <div style={{ padding: '12px 14px', borderRadius: 'var(--r-md)', background: 'rgba(16,185,129,.05)', border: '1px solid rgba(52,211,153,.1)' }}>
              <div style={{ fontSize: 10, color: 'rgba(167,243,208,.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4, fontFamily: "'Source Sans 3', sans-serif" }}>Product ID</div>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: 'rgba(167,243,208,.5)' }}>{product.product_id}</div>
            </div>
          </div>
        </div>

        {/* ── REVIEWS ── */}
        <div style={{ borderTop: '1px solid rgba(52,211,153,.08)', paddingTop: 40 }}>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 26, fontWeight: 900, color: '#ecfdf5', letterSpacing: '-0.025em', marginBottom: 28 }}>
            Customer Reviews
            {reviews.length > 0 && <span style={{ fontSize: 16, fontWeight: 400, color: 'rgba(167,243,208,.4)', marginLeft: 12, fontFamily: "'Source Sans 3', sans-serif" }}>({reviews.length})</span>}
          </h2>

          {reviews.length === 0
            ? <EmptyState title="No reviews yet" description="Be the first to share your experience." icon="💬" />
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 36 }}>
                {reviews.map((r) => (
                  <div key={r.review_id} className="cust-card card-sm">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <StarRating stars={r.stars} />
                        {r.sentiment && (
                          <span style={{
                            padding: '2px 9px', borderRadius: 'var(--r-full)', fontSize: 11, fontWeight: 700,
                            fontFamily: "'Source Sans 3', sans-serif",
                            background: r.sentiment === 'POSITIVE' ? 'rgba(16,185,129,.1)' : r.sentiment === 'NEGATIVE' ? 'rgba(239,68,68,.1)' : 'rgba(100,116,139,.1)',
                            color: r.sentiment === 'POSITIVE' ? '#34d399' : r.sentiment === 'NEGATIVE' ? '#f87171' : '#94a3b8',
                            border: `1px solid ${r.sentiment === 'POSITIVE' ? 'rgba(52,211,153,.2)' : r.sentiment === 'NEGATIVE' ? 'rgba(239,68,68,.2)' : 'rgba(100,116,139,.2)'}`,
                          }}>
                            {r.sentiment}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 11, color: 'rgba(167,243,208,.3)', fontFamily: "'Source Sans 3', sans-serif" }}>
                        {r.user_id || 'Anonymous'} · {r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}
                      </span>
                    </div>
                    <p style={{ margin: 0, color: '#a7f3d0', fontSize: 14, lineHeight: 1.7, fontFamily: "'Source Sans 3', sans-serif" }}>{r.text}</p>
                  </div>
                ))}
              </div>
            )
          }

          {/* Write review */}
          <div className="cust-card">
            <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, fontWeight: 800, color: '#ecfdf5', marginBottom: 20 }}>
              Write a Review
            </h3>
            <form onSubmit={handleSubmitReview} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(167,243,208,.4)', letterSpacing: '.07em', textTransform: 'uppercase', fontFamily: "'Source Sans 3', sans-serif" }}>Your Rating</span>
                <StarRating stars={reviewStars} interactive onRate={setReviewStars} />
                {reviewStars > 0 && (
                  <span style={{ fontSize: 12, color: '#6ee7b7', marginTop: 4, fontFamily: "'Source Sans 3', sans-serif" }}>
                    {['','Poor','Fair','Good','Very Good','Excellent'][reviewStars]}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(167,243,208,.4)', letterSpacing: '.07em', textTransform: 'uppercase', fontFamily: "'Source Sans 3', sans-serif" }}>Your Review</span>
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Share your experience… (min 10 characters)"
                  rows="4"
                  required
                  style={{
                    width: '100%', padding: '11px 14px', resize: 'vertical',
                    background: 'rgba(16,185,129,.04)',
                    border: '1px solid rgba(52,211,153,.15)',
                    borderRadius: 'var(--r-md)',
                    color: '#d1fae5', fontSize: 14,
                    fontFamily: "'Source Sans 3', sans-serif",
                    outline: 'none', lineHeight: 1.6,
                  }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(52,211,153,.4)'; e.target.style.boxShadow = '0 0 0 3px rgba(16,185,129,.08)' }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(52,211,153,.15)'; e.target.style.boxShadow = 'none' }}
                />
                <span style={{ fontSize: 11, color: reviewText.length > 450 ? '#fbbf24' : 'rgba(167,243,208,.25)', alignSelf: 'flex-end', fontFamily: "'Source Sans 3', sans-serif" }}>
                  {reviewText.length}/500
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" disabled={submitting} className="cust-btn-primary">
                  {submitting ? <><Spinner size="sm" color="#fff" /> Submitting…</> : 'Submit Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
