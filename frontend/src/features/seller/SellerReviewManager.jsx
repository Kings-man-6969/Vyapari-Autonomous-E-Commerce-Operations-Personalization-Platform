import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../shared/hooks/useToast';
import { SpinnerPage } from '../../shared/components/Spinner';

/* ─── DESIGN.MD — Seller Review Manager ───
   Canvas: #000000 · Cards: #0a0a0a · Hairlines: #1e2c31
   Buttons: pill-only · Typography: Inter ss03
───────────────────────────────────────────── */

function StarRating({ stars, max = 5 }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} style={{ fontSize: 14, color: i < stars ? '#d97706' : '#3f3f46' }}>★</span>
      ))}
    </div>
  );
}

const SENTIMENT_BADGES = {
  POSITIVE: { bg: 'rgba(193,251,212,0.15)', color: '#c1fbd4' },
  NEGATIVE: { bg: 'rgba(254,226,226,0.15)', color: '#fee2e2' },
  NEUTRAL:  { bg: '#1e2c31', color: '#ffffff' },
};

export default function SellerReviewManager({ token }) {
  const { showToast } = useToast();
  const [reviews, setReviews] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(null);

  useEffect(() => { loadReviews(); }, [token]);

  async function loadReviews() {
    setLoading(true);
    try {
      const payload = await apiFetch('/reviews/seller/pending', {}, token);
      setReviews(payload.pending_reviews || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function submitResponse(reviewId) {
    const text = drafts[reviewId]?.trim();
    if (!text) { showToast('Write a response before submitting.', 'warning'); return; }
    setSubmitting(reviewId);
    try {
      await apiFetch(`/reviews/${reviewId}/response`, {
        method: 'POST',
        body: JSON.stringify({ response_text: text }),
      }, token);
      setDrafts(c => ({ ...c, [reviewId]: '' }));
      showToast('Response submitted successfully.', 'success');
      await loadReviews();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(null);
    }
  }

  const avgStars = reviews.length ? reviews.reduce((s, r) => s + Number(r.stars || 0), 0) / reviews.length : 0;
  const negativePct = reviews.length ? Math.round(reviews.filter(r => r.sentiment === 'NEGATIVE').length / reviews.length * 100) : 0;

  if (loading && reviews.length === 0) return <SpinnerPage message="Loading feedback triage queue…" />;

  return (
    <div style={{
      fontFamily: "'Inter', Helvetica, Arial, sans-serif",
      fontFeatureSettings: '"ss03"',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 400, color: '#ffffff', letterSpacing: '0.36px', lineHeight: 1.2, marginBottom: 6, fontFeatureSettings: '"ss03"' }}>
            Review Management
          </h1>
          <p style={{ color: '#71717a', fontSize: 15, fontWeight: 420, fontFeatureSettings: '"ss03"' }}>
            Triage sentiment signals and publish verified merchant responses.
          </p>
        </div>
        <button
          onClick={loadReviews}
          disabled={loading}
          style={{
            padding: '9px 20px',
            background: 'transparent',
            color: 'rgba(255,255,255,0.8)',
            borderRadius: 9999,
            border: '1px solid #1e2c31',
            fontWeight: 420,
            fontSize: 14,
            cursor: loading ? 'wait' : 'pointer',
            transition: 'all 0.18s',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontFeatureSettings: '"ss03"',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; e.currentTarget.style.color = '#ffffff'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e2c31'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
        >
          <span>↻</span>
          <span>{loading ? 'Refreshing…' : 'Refresh'}</span>
        </button>
      </div>

      {/* KPI Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Pending Feedback', value: reviews.length, sub: 'Needs merchant reply', alert: reviews.length > 0 },
          { label: 'Average Score', value: `${avgStars.toFixed(1)} ★`, sub: 'Pending cohort' },
          { label: 'Negative Ratio', value: `${negativePct}%`, sub: negativePct > 25 ? 'High escalation tier' : 'Healthy sentiment', alert: negativePct > 25 },
        ].map((stat, i) => (
          <div
            key={i}
            style={{
              background: '#0a0a0a',
              border: '1px solid #1e2c31',
              borderRadius: 12,
              padding: '20px 24px',
              boxShadow: '0 1px 2px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 400, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.72px', marginBottom: 8, fontFeatureSettings: '"ss03"' }}>
              {stat.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 400, color: stat.alert ? '#fee2e2' : '#ffffff', marginBottom: 4, fontFeatureSettings: '"ss03"' }}>
              {stat.value}
            </div>
            <div style={{ fontSize: 12, color: stat.alert ? '#fee2e2' : '#71717a', fontFeatureSettings: '"ss03"' }}>
              {stat.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '64px 24px',
          background: '#0a0a0a',
          border: '1px solid #1e2c31',
          borderRadius: 12,
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 18, fontWeight: 500, color: '#ffffff', marginBottom: 4, fontFeatureSettings: '"ss03"' }}>All caught up!</div>
          <div style={{ color: '#71717a', fontSize: 14, fontFeatureSettings: '"ss03"' }}>There are no pending customer reviews requiring merchant intervention.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {reviews.map((review) => {
            const sentiment = (review.sentiment || 'NEUTRAL').toUpperCase();
            const badge = SENTIMENT_BADGES[sentiment] || SENTIMENT_BADGES.NEUTRAL;
            const charCount = (drafts[review.review_id] || '').length;

            return (
              <div
                key={review.review_id}
                style={{
                  background: '#0a0a0a',
                  border: '1px solid #1e2c31',
                  borderRadius: 12,
                  padding: '28px',
                  boxShadow: '0 1px 2px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
                }}
              >
                {/* Review Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <StarRating stars={review.stars} />
                    <span style={{
                      display: 'inline-flex',
                      padding: '2px 8px',
                      borderRadius: 9999,
                      fontSize: 10,
                      fontWeight: 500,
                      background: badge.bg,
                      color: badge.color,
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                      fontFeatureSettings: '"ss03"',
                    }}>
                      {sentiment}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#71717a', textAlign: 'right', fontFeatureSettings: '"ss03"' }}>
                    Ref: #{review.review_id.slice(0, 8).toUpperCase()} · Product: {review.product_id.slice(0, 8)}
                  </div>
                </div>

                <div style={{ fontSize: 13, color: '#71717a', marginBottom: 16, fontFeatureSettings: '"ss03"' }}>
                  Customer: <span style={{ color: '#ffffff', fontWeight: 500 }}>{review.user_id || 'anonymous'}</span>
                  {review.created_at && ` · ${new Date(review.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                </div>

                {/* Review text quote */}
                <div style={{
                  padding: '18px 20px',
                  background: '#121212',
                  border: '1px solid #1e2c31',
                  borderRadius: 10,
                  marginBottom: 24,
                }}>
                  <p style={{ margin: 0, color: '#ffffff', fontSize: 15, lineHeight: 1.6, fontFeatureSettings: '"ss03"' }}>
                    "{review.text}"
                  </p>
                </div>

                {/* Response area */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label style={{ fontSize: 12, fontWeight: 400, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.72px', fontFeatureSettings: '"ss03"' }}>
                      Merchant Response
                    </label>
                    <span style={{ fontSize: 12, color: charCount > 400 ? '#fee2e2' : '#71717a', fontFeatureSettings: '"ss03"' }}>
                      {charCount} / 500
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    value={drafts[review.review_id] || ''}
                    onChange={e => setDrafts(c => ({ ...c, [review.review_id]: e.target.value.slice(0, 500) }))}
                    placeholder="Address customer feedback, clarify resolution, or offer support…"
                    style={{
                      width: '100%',
                      background: '#121212',
                      border: '1px solid #1e2c31',
                      borderRadius: 8,
                      padding: '12px 14px',
                      color: '#ffffff',
                      fontSize: 14,
                      fontFamily: "'Inter', Helvetica, Arial, sans-serif",
                      fontFeatureSettings: '"ss03"',
                      outline: 'none',
                      boxSizing: 'border-box',
                      resize: 'vertical',
                      transition: 'border-color 0.18s',
                    }}
                    onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.3)'}
                    onBlur={e => e.target.style.borderColor = '#1e2c31'}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                    <button
                      onClick={() => submitResponse(review.review_id)}
                      disabled={submitting === review.review_id || !drafts[review.review_id]?.trim()}
                      style={{
                        padding: '10px 24px',
                        background: (!drafts[review.review_id]?.trim() || submitting === review.review_id) ? '#1e2c31' : '#ffffff',
                        color: (!drafts[review.review_id]?.trim() || submitting === review.review_id) ? '#71717a' : '#000000',
                        borderRadius: 9999,
                        border: 'none',
                        fontWeight: 500,
                        fontSize: 14,
                        cursor: (!drafts[review.review_id]?.trim() || submitting === review.review_id) ? 'not-allowed' : 'pointer',
                        fontFamily: "'Inter', Helvetica, Arial, sans-serif",
                        fontFeatureSettings: '"ss03"',
                        transition: 'all 0.18s',
                      }}
                      onMouseEnter={e => {
                        if (drafts[review.review_id]?.trim() && submitting !== review.review_id) {
                          e.currentTarget.style.background = '#e4e4e7';
                        }
                      }}
                      onMouseLeave={e => {
                        if (drafts[review.review_id]?.trim() && submitting !== review.review_id) {
                          e.currentTarget.style.background = '#ffffff';
                        }
                      }}
                    >
                      {submitting === review.review_id ? 'Publishing…' : 'Publish Response'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
