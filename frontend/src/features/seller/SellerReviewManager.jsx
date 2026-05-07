import React, { useEffect, useState } from 'react'
import { apiFetch } from '@/services/api'
import { useToast } from '@/shared/components/Toast'
import PageHeader from '@/shared/components/PageHeader'
import StatCard from '@/shared/components/StatCard'
import Badge, { statusVariant } from '@/shared/components/Badge'
import EmptyState from '@/shared/components/EmptyState'
import Spinner from '@/shared/components/Spinner'

function StarRating({ stars, max = 5 }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} style={{ fontSize: 14, color: i < stars ? '#f59e0b' : 'var(--c-surface-3)' }}>★</span>
      ))}
    </div>
  )
}

export default function SellerReviewManager({ token }) {
  const toast = useToast()
  const [reviews, setReviews] = useState([])
  const [drafts, setDrafts] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(null)

  useEffect(() => { loadReviews() }, [token])

  async function loadReviews() {
    setLoading(true)
    try {
      const payload = await apiFetch('/reviews/seller/pending', {}, token)
      setReviews(payload.pending_reviews || [])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function submitResponse(reviewId) {
    const text = drafts[reviewId]?.trim()
    if (!text) { toast.warning('Write a response before submitting.'); return }
    setSubmitting(reviewId)
    try {
      await apiFetch(`/reviews/${reviewId}/response`, {
        method: 'POST',
        body: JSON.stringify({ response_text: text }),
      }, token)
      setDrafts((c) => ({ ...c, [reviewId]: '' }))
      toast.success('Response submitted successfully.')
      await loadReviews()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(null)
    }
  }

  const avgStars = reviews.length ? reviews.reduce((s, r) => s + Number(r.stars || 0), 0) / reviews.length : 0
  const negativePct = reviews.length ? Math.round(reviews.filter(r => r.sentiment === 'NEGATIVE').length / reviews.length * 100) : 0

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><Spinner size="lg" /></div>
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Review Manager"
        description="Respond to pending customer reviews. Close the feedback loop and improve satisfaction."
        action={
          <button onClick={loadReviews} className="btn btn-secondary btn-sm">
            <RefreshIcon /> Refresh
          </button>
        }
      />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
        <StatCard label="Pending Reviews" value={reviews.length} variant={reviews.length > 0 ? 'warning' : 'success'} />
        <StatCard label="Average Rating" value={`${avgStars.toFixed(1)} ★`} variant="info" />
        <StatCard label="Negative Sentiment" value={`${negativePct}%`} variant={negativePct > 30 ? 'danger' : 'success'} />
      </div>

      {/* Reviews list */}
      {reviews.length === 0
        ? <EmptyState
            title="All caught up!"
            description="There are no pending reviews to respond to. New reviews will appear here automatically."
            icon="✅"
          />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {reviews.map((review) => {
              const sentiment = (review.sentiment || 'Unknown').toUpperCase()
              const sentimentVariant =
                sentiment === 'POSITIVE' ? 'success' :
                sentiment === 'NEGATIVE' ? 'danger' : 'neutral'
              const charCount = (drafts[review.review_id] || '').length

              return (
                <article key={review.review_id} className="card animate-fade-in">
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <StarRating stars={review.stars} />
                      <Badge variant={sentimentVariant}>{sentiment}</Badge>
                    </div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-text-faint)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
                      <div>{review.review_id}</div>
                      <div>{review.product_id}</div>
                    </div>
                  </div>

                  {/* Review meta */}
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-text-faint)', marginBottom: 12 }}>
                    Customer: <span style={{ color: 'var(--c-text-muted)', fontWeight: 600 }}>{review.user_id || 'anonymous'}</span>
                    {review.created_at && (
                      <> · {new Date(review.created_at).toLocaleDateString()}</>
                    )}
                  </div>

                  {/* Review text */}
                  <div style={reviewTextStyle}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--c-text-faint)" strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>
                    <p style={{ margin: 0, color: 'var(--c-text)', lineHeight: 1.7, fontSize: 'var(--fs-sm)' }}>{review.text}</p>
                  </div>

                  {/* Response textarea */}
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Your Response
                      </label>
                      <span style={{ fontSize: 'var(--fs-xs)', color: charCount > 400 ? 'var(--c-warning)' : 'var(--c-text-faint)' }}>
                        {charCount} chars
                      </span>
                    </div>
                    <textarea
                      rows="3"
                      className="form-textarea"
                      value={drafts[review.review_id] || ''}
                      onChange={(e) => setDrafts((c) => ({ ...c, [review.review_id]: e.target.value }))}
                      placeholder="Thank the customer, address their concern, and offer support…"
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                      <button
                        onClick={() => submitResponse(review.review_id)}
                        disabled={submitting === review.review_id || !drafts[review.review_id]?.trim()}
                        className="btn btn-primary btn-sm"
                      >
                        {submitting === review.review_id
                          ? <><Spinner size="sm" color="#fff" /> Submitting…</>
                          : 'Submit Response'}
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )
      }
    </div>
  )
}

const reviewTextStyle = {
  display: 'flex',
  gap: 10,
  alignItems: 'flex-start',
  padding: '12px 14px',
  borderRadius: 'var(--radius-md)',
  background: 'var(--c-surface-2)',
  border: '1px solid var(--c-border)',
}

function RefreshIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
}
