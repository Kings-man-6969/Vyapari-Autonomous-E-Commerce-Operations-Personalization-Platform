import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../services/api';
import { useToast } from '../../shared/hooks/useToast';
import { SpinnerPage } from '../../shared/components/Spinner';
import '../../customer.css';

/* ─── DESIGN.MD — Transactional Track (Product Detail) ───
   Canvas: #fbfbf5 cream · Image frame: #f5f5f5 rounded-xl 20px
   Title: display-md (clamp(2rem, 5vw, 48px) / weight 300)
   Price: heading-xl (28px / weight 500)
   Buttons: pill-only (border-radius: 9999px)
   Review cards: white bg, hairline border, stacked shadows
─────────────────────────────────────────────────────────── */

const fmt = (n) => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0 });

const CATEGORY_DATA = {
  'Electronics':    { emoji: '⚡', color: '#52525b' },
  'Clothing':       { emoji: '👗', color: '#52525b' },
  'Books':          { emoji: '📚', color: '#52525b' },
  'Home & Kitchen': { emoji: '🏠', color: '#52525b' },
  'Sports':         { emoji: '🏃', color: '#52525b' },
};

function Stars({ rating, size = 16 }) {
  const r = Math.round(rating || 0);
  return (
    <span style={{ fontSize: size, display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ color: i <= r ? '#d97706' : '#d4d4d8' }}>★</span>
      ))}
    </span>
  );
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

function sentimentBadge(s) {
  if (!s) return { bg: '#d4d4d8', color: '#000000' };
  const sl = s.toLowerCase();
  if (sl === 'positive') return { bg: '#c1fbd4', color: '#000000' };
  if (sl === 'negative') return { bg: '#fee2e2', color: '#991b1b' };
  return { bg: '#d4d4d8', color: '#000000' };
}

export default function CustomerProductDetail({ sessionId, token, onCartChange }) {
  const { productId } = useParams();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [addingCart, setAddingCart] = useState(false);
  const [addingWish, setAddingWish] = useState(false);

  // Review form
  const [starPick, setStarPick] = useState(0);
  const [starHover, setStarHover] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    setLoading(true);
    window.scrollTo(0, 0);
    apiFetch(`/products/${productId}`)
      .then(d => setProduct(d))
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));

    apiFetch(`/products/${productId}/reviews`)
      .then(d => setReviews(d.items || d.reviews || []))
      .catch(() => setReviews([]))
      .finally(() => setReviewsLoading(false));
  }, [productId]);

  async function handleAddToCart() {
    setAddingCart(true);
    try {
      await apiFetch(`/cart/add?session_id=${sessionId}`, {
        method: 'POST',
        body: JSON.stringify({ product_id: productId, qty: qty }),
      });
      showToast('Added to cart!', 'success');
      onCartChange?.();
    } catch (err) {
      showToast(err.message || 'Failed', 'error');
    } finally { setAddingCart(false); }
  }

  async function handleWishlist() {
    if (!token) { showToast('Sign in to use wishlist', 'info'); return; }
    setAddingWish(true);
    try {
      await apiFetch(`/wishlist/${productId}`, {
        method: 'POST',
      });
      showToast('Saved to wishlist!', 'success');
      onCartChange?.();
    } catch (err) {
      showToast(err.message || 'Failed', 'error');
    } finally { setAddingWish(false); }
  }

  async function handleSubmitReview(e) {
    e.preventDefault();
    if (!token) { showToast('Sign in to write a review', 'info'); return; }
    if (!starPick) { showToast('Please select a star rating', 'warning'); return; }
    if (reviewText.trim().length < 10) { showToast('Review must be at least 10 characters long', 'warning'); return; }
    setSubmittingReview(true);
    try {
      await apiFetch('/reviews', {
        method: 'POST',
        body: JSON.stringify({ product_id: productId, stars: starPick, text: reviewText.trim() }),
      });
      showToast('Review submitted successfully!', 'success');
      setStarPick(0);
      setReviewText('');
      const d = await apiFetch(`/products/${productId}/reviews`);
      setReviews(d.items || d.reviews || []);
    } catch (err) {
      showToast(err.message || 'Failed to submit review', 'error');
    } finally { setSubmittingReview(false); }
  }

  if (loading) return (
    <div style={{ background: '#fbfbf5', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <SpinnerPage />
    </div>
  );

  if (!product) return (
    <div style={{
      background: '#fbfbf5', minHeight: '100vh',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter', Helvetica, Arial, sans-serif", fontFeatureSettings: '"ss03"',
      padding: '24px', textAlign: 'center'
    }}>
      <div style={{ fontSize: '3.5rem', marginBottom: 20 }}>🍃</div>
      <div style={{ fontSize: 24, fontWeight: 400, color: '#000000', marginBottom: 12 }}>Product not found</div>
      <button onClick={() => navigate('/shop/products')} style={{
        padding: '12px 28px', background: '#000000', color: '#ffffff', borderRadius: 9999,
        fontWeight: 420, cursor: 'pointer', border: 'none', fontSize: 15,
        fontFamily: "'Inter', Helvetica, Arial, sans-serif", fontFeatureSettings: '"ss03"'
      }}>Browse Products</button>
    </div>
  );

  const catInfo = CATEGORY_DATA[product.category] || { emoji: '📦', color: '#71717a' };
  const stock = product.stock ?? product.quantity ?? 0;
  const stockStatus = stock <= 0 ? 'Out of Stock' : stock < 10 ? 'Low Stock' : 'In Stock';
  const stockPillStyle = stock <= 0
    ? { bg: '#fee2e2', color: '#991b1b' }
    : stock < 10
      ? { bg: '#fef3c7', color: '#92400e' }
      : { bg: '#c1fbd4', color: '#000000' };

  const totalReviews = reviews.length;
  const avgRating = totalReviews ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / totalReviews).toFixed(1) : 0;
  const starDist = [5, 4, 3, 2, 1].map(s => ({
    star: s,
    pct: totalReviews ? Math.round(reviews.filter(r => Math.round(r.rating) === s).length / totalReviews * 100) : 0,
  }));

  return (
    <div style={{
      background: '#fbfbf5',
      minHeight: '100vh',
      padding: '40px 24px 80px',
      fontFamily: "'Inter', Helvetica, Arial, sans-serif",
      fontFeatureSettings: '"ss03"',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Breadcrumb — eyebrow-cap */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 12, fontWeight: 400, color: '#71717a',
          letterSpacing: '0.72px', textTransform: 'uppercase',
          marginBottom: 32, fontFeatureSettings: '"ss03"',
        }}>
          <span style={{ cursor: 'pointer', color: '#000000' }} onClick={() => navigate('/shop')}>Home</span>
          <span style={{ color: '#d4d4d8' }}>/</span>
          <span style={{ cursor: 'pointer', color: '#000000' }} onClick={() => navigate('/shop/products')}>Products</span>
          <span style={{ color: '#d4d4d8' }}>/</span>
          <span style={{ color: '#71717a' }}>{product.name}</span>
        </div>

        {/* Hero Product Section */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 48, marginBottom: 80, alignItems: 'start'
        }}>

          {/* Image — card-photo-frame */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e4e4e7',
            borderRadius: 20,
            aspectRatio: '1',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 8px rgba(0,0,0,0.08), 0 4px 4px rgba(0,0,0,0.07), 0 2px 2px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)',
            overflow: 'hidden'
          }}>
            {product.image_url && product.image_url.startsWith('http') ? (
              <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: '7rem', userSelect: 'none' }}>
                {catInfo.emoji}
              </span>
            )}
          </div>

          {/* Info */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <span style={{
                fontSize: 12, fontWeight: 400, color: '#71717a',
                textTransform: 'uppercase', letterSpacing: '0.72px',
                fontFeatureSettings: '"ss03"'
              }}>
                {product.category}
              </span>
              <span style={{
                padding: '3px 10px', borderRadius: 9999,
                background: stockPillStyle.bg, color: stockPillStyle.color,
                fontSize: 11, fontWeight: 500, letterSpacing: '0.3px',
                textTransform: 'uppercase', fontFeatureSettings: '"ss03"'
              }}>
                {stockStatus}
              </span>
            </div>

            {/* Product Title — display-md weight 300 */}
            <h1 style={{
              fontSize: 'clamp(2rem, 4.5vw, 48px)',
              fontWeight: 300, color: '#000000',
              lineHeight: 1.14, marginBottom: 16, letterSpacing: 0,
              fontFeatureSettings: '"ss03"'
            }}>
              {product.name}
            </h1>

            {/* Rating */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <Stars rating={product.avg_rating || avgRating} size={16} />
              <span style={{ fontSize: 14, fontWeight: 420, color: '#71717a', fontFeatureSettings: '"ss03"' }}>
                ({product.review_count || totalReviews} reviews)
              </span>
            </div>

            {/* Price — heading-xl */}
            <div style={{
              fontSize: 28, fontWeight: 500, color: '#000000',
              marginBottom: 24, fontFeatureSettings: '"ss03"'
            }}>
              {fmt(product.price)}
            </div>

            {/* Description */}
            {product.description && (
              <p style={{
                fontSize: 16, fontWeight: 420, color: '#52525b',
                lineHeight: 1.6, marginBottom: 36, maxWidth: '95%',
                fontFeatureSettings: '"ss03"'
              }}>
                {product.description}
              </p>
            )}

            {/* Action Bar Card */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e4e4e7',
              borderRadius: 12,
              padding: '24px',
              boxShadow: '0 4px 4px rgba(0,0,0,0.06), 0 2px 2px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)'
            }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Stepper — pill style */}
                <div style={{
                  display: 'inline-flex', alignItems: 'center',
                  background: '#fbfbf5', border: '1px solid #e4e4e7',
                  borderRadius: 9999, padding: '2px'
                }}>
                  <button
                    onClick={() => setQty(q => Math.max(1, q - 1))}
                    disabled={qty <= 1}
                    style={{
                      width: 36, height: 36, borderRadius: '50%', background: 'transparent', border: 'none',
                      color: '#000000', fontSize: 18, cursor: qty <= 1 ? 'not-allowed' : 'pointer',
                      opacity: qty <= 1 ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >−</button>
                  <div style={{
                    width: 36, textAlign: 'center', color: '#000000', fontWeight: 500,
                    fontSize: 15, fontFeatureSettings: '"ss03"'
                  }}>
                    {qty}
                  </div>
                  <button
                    onClick={() => setQty(q => Math.min(stock, q + 1))}
                    disabled={qty >= stock}
                    style={{
                      width: 36, height: 36, borderRadius: '50%', background: 'transparent', border: 'none',
                      color: '#000000', fontSize: 18, cursor: qty >= stock ? 'not-allowed' : 'pointer',
                      opacity: qty >= stock ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >+</button>
                </div>

                {/* Add to Cart — button-primary-pill */}
                <button
                  onClick={handleAddToCart}
                  disabled={addingCart || stock <= 0}
                  style={{
                    flex: 1, minWidth: 160, padding: '14px 24px', borderRadius: 9999,
                    background: stock <= 0 ? '#d4d4d8' : '#000000',
                    color: stock <= 0 ? '#71717a' : '#ffffff',
                    border: 'none', fontWeight: 420, fontSize: 15,
                    cursor: stock <= 0 ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'background 0.18s',
                    fontFamily: "'Inter', Helvetica, Arial, sans-serif", fontFeatureSettings: '"ss03"'
                  }}
                  onMouseEnter={e => { if (stock > 0 && !addingCart) e.currentTarget.style.background = '#3f3f46'; }}
                  onMouseLeave={e => { if (stock > 0 && !addingCart) e.currentTarget.style.background = '#000000'; }}
                >
                  {addingCart ? 'Adding…' : stock <= 0 ? 'Out of Stock' : 'Add to Cart'}
                </button>

                {/* Wishlist button — button-outline-on-light */}
                <button
                  onClick={handleWishlist}
                  disabled={addingWish}
                  style={{
                    padding: '12px 20px', borderRadius: 9999,
                    background: 'transparent', border: '1px solid #000000',
                    color: '#000000', fontSize: 14, fontWeight: 420,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    cursor: 'pointer', transition: 'background 0.18s',
                    fontFamily: "'Inter', Helvetica, Arial, sans-serif", fontFeatureSettings: '"ss03"'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span>♡</span>
                  <span>Wishlist</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <div style={{ borderTop: '1px solid #e4e4e7', paddingTop: 64 }}>
          <h2 style={{
            fontSize: 24, fontWeight: 400, color: '#000000',
            marginBottom: 40, letterSpacing: '0.36px',
            fontFeatureSettings: '"ss03"'
          }}>
            Customer Reviews ({totalReviews})
          </h2>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 48, alignItems: 'start'
          }}>

            {/* Left Col: Stats & Write */}
            <div>
              {totalReviews > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 28, marginBottom: 36,
                  padding: '24px', background: '#ffffff', border: '1px solid #e4e4e7', borderRadius: 12,
                  boxShadow: '0 2px 2px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 48, fontWeight: 300, color: '#000000', lineHeight: 1, fontFeatureSettings: '"ss03"' }}>
                      {avgRating}
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <Stars rating={parseFloat(avgRating)} size={14} />
                    </div>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {starDist.map(s => (
                      <div key={s.star} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 12, color: '#71717a', width: 24, fontFeatureSettings: '"ss03"' }}>{s.star}★</span>
                        <div style={{ flex: 1, height: 6, background: '#fbfbf5', borderRadius: 9999, overflow: 'hidden', border: '1px solid #e4e4e7' }}>
                          <div style={{ width: `${s.pct}%`, height: '100%', background: '#000000', borderRadius: 9999 }} />
                        </div>
                        <span style={{ fontSize: 12, color: '#71717a', width: 32, textAlign: 'right', fontFeatureSettings: '"ss03"' }}>{s.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Review Form Card */}
              <div style={{
                background: '#ffffff', border: '1px solid #e4e4e7', borderRadius: 12, padding: '28px',
                boxShadow: '0 2px 2px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)'
              }}>
                <h3 style={{ fontSize: 18, fontWeight: 500, color: '#000000', marginBottom: 16, fontFeatureSettings: '"ss03"' }}>
                  Share your experience
                </h3>
                {!token ? (
                  <div style={{ textAlign: 'center' }}>
                    <button onClick={() => navigate('/login')} style={{
                      width: '100%', padding: '12px 24px', background: 'transparent', border: '1px solid #000000',
                      color: '#000000', borderRadius: 9999, fontWeight: 420, cursor: 'pointer', fontSize: 14,
                      fontFamily: "'Inter', Helvetica, Arial, sans-serif", fontFeatureSettings: '"ss03"'
                    }}>Sign in to write a review</button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitReview}>
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', gap: 6, fontSize: 24 }}>
                        {[1, 2, 3, 4, 5].map(s => (
                          <span
                            key={s}
                            onMouseEnter={() => setStarHover(s)}
                            onMouseLeave={() => setStarHover(0)}
                            onClick={() => setStarPick(s)}
                            style={{ cursor: 'pointer', color: s <= (starHover || starPick) ? '#d97706' : '#d4d4d8', transition: 'color 0.15s' }}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                    </div>
                    <div style={{ marginBottom: 20 }}>
                      <textarea
                        value={reviewText}
                        onChange={e => setReviewText(e.target.value.slice(0, 500))}
                        placeholder="What did you like or dislike?"
                        rows={4}
                        style={{
                          width: '100%', background: '#ffffff', border: '1px solid #e4e4e7',
                          borderRadius: 8, padding: '10px 12px', color: '#000000', fontSize: 15,
                          fontFamily: "'Inter', Helvetica, Arial, sans-serif", fontFeatureSettings: '"ss03"',
                          resize: 'none', outline: 'none'
                        }}
                        onFocus={e => e.target.style.borderColor = '#000000'}
                        onBlur={e => e.target.style.borderColor = '#e4e4e7'}
                      />
                      <div style={{ textAlign: 'right', fontSize: 12, color: '#71717a', marginTop: 6, fontFeatureSettings: '"ss03"' }}>
                        {reviewText.length} / 500
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={submittingReview}
                      style={{
                        width: '100%', padding: '12px 24px', background: '#000000', color: '#ffffff', borderRadius: 9999,
                        fontWeight: 420, fontSize: 14, cursor: submittingReview ? 'wait' : 'pointer', border: 'none',
                        fontFamily: "'Inter', Helvetica, Arial, sans-serif", fontFeatureSettings: '"ss03"',
                        transition: 'background 0.18s'
                      }}
                      onMouseEnter={e => { if (!submittingReview) e.currentTarget.style.background = '#3f3f46'; }}
                      onMouseLeave={e => { if (!submittingReview) e.currentTarget.style.background = '#000000'; }}
                    >
                      {submittingReview ? 'Submitting…' : 'Submit Review'}
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Right Col: Review List */}
            <div>
              {reviewsLoading ? (
                <div style={{ color: '#71717a', fontSize: 15, fontFeatureSettings: '"ss03"' }}>Loading reviews…</div>
              ) : reviews.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '60px 24px', background: '#ffffff',
                  borderRadius: 12, border: '1px solid #e4e4e7',
                  boxShadow: '0 2px 2px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)'
                }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>💬</div>
                  <div style={{ fontSize: 18, color: '#000000', fontWeight: 500, marginBottom: 4, fontFeatureSettings: '"ss03"' }}>No reviews yet</div>
                  <p style={{ color: '#71717a', fontSize: 14, fontFeatureSettings: '"ss03"' }}>Be the first to review this item!</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {reviews.map(r => {
                    const sb = sentimentBadge(r.sentiment);
                    return (
                      <div key={r.review_id} style={{
                        background: '#ffffff', border: '1px solid #e4e4e7', borderRadius: 12, padding: '24px',
                        boxShadow: '0 2px 2px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)'
                      }}>
                        <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
                          <div style={{
                            width: 38, height: 38, borderRadius: '50%', background: '#c1fbd4',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000000', fontWeight: 600, fontSize: 14,
                            fontFeatureSettings: '"ss03"'
                          }}>
                            {(r.customer_name || r.user_name || 'U')[0].toUpperCase()}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 500, fontSize: 15, color: '#000000', fontFeatureSettings: '"ss03"' }}>
                              {r.customer_name || r.user_name || 'Customer'}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                              <Stars rating={r.rating || r.stars} size={12} />
                              <span style={{ fontSize: 12, color: '#71717a', fontFeatureSettings: '"ss03"' }}>{timeAgo(r.created_at)}</span>
                              {r.sentiment && (
                                <span style={{
                                  fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 9999,
                                  background: sb.bg, color: sb.color,
                                  textTransform: 'uppercase', letterSpacing: '0.3px', fontFeatureSettings: '"ss03"'
                                }}>
                                  {r.sentiment}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <p style={{ fontSize: 15, color: '#52525b', lineHeight: 1.6, margin: 0, fontFeatureSettings: '"ss03"' }}>
                          {r.text || r.review_text}
                        </p>
                        {(r.agent_response || r.seller_response) && (
                          <div style={{
                            marginTop: 16, padding: '14px 16px',
                            background: '#fbfbf5', borderLeft: '3px solid #000000',
                            borderRadius: '0 8px 8px 0'
                          }}>
                            <div style={{ fontSize: 11, fontWeight: 500, color: '#71717a', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.72px', fontFeatureSettings: '"ss03"' }}>
                              Seller Response
                            </div>
                            <p style={{ fontSize: 14, color: '#000000', margin: 0, lineHeight: 1.5, fontFeatureSettings: '"ss03"' }}>
                              {r.agent_response || r.seller_response}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
