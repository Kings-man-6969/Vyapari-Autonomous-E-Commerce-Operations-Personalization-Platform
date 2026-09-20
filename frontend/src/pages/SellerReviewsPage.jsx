import React, { useState, useEffect } from 'react';
import { Star, MessageSquare, Send, CheckCircle2, AlertCircle, Search, CornerDownRight } from 'lucide-react';
import api from '../services/api';

export const SellerReviewsPage = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPending, setFilterPending] = useState(false);
  const [replyTextMap, setReplyTextMap] = useState({});
  const [submittingId, setSubmittingId] = useState(null);
  const [successNotice, setSuccessNotice] = useState(null);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/reviews/seller');
      if (res.data?.success) {
        setReviews(res.data.data.reviews || []);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load customer reviews.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleReplyChange = (reviewId, text) => {
    setReplyTextMap(prev => ({ ...prev, [reviewId]: text }));
  };

  const submitReply = async (reviewId) => {
    const text = replyTextMap[reviewId];
    if (!text || !text.trim()) return;

    try {
      setSubmittingId(reviewId);
      const res = await api.post(`/reviews/${reviewId}/reply`, { reply: text.trim() });
      if (res.data?.success) {
        setSuccessNotice(`Official reply posted successfully!`);
        setTimeout(() => setSuccessNotice(null), 3500);

        // Update local review state
        setReviews(prev => prev.map(r => {
          if (r.id === reviewId) {
            return {
              ...r,
              seller_reply: res.data.data.seller_reply,
              seller_reply_at: res.data.data.seller_reply_at
            };
          }
          return r;
        }));
      }
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to post reply.');
    } finally {
      setSubmittingId(null);
    }
  };

  const filteredReviews = reviews.filter(r => {
    const matchesSearch = !searchQuery || 
      r.product_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.reviewer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.comment?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesPending = !filterPending || !r.seller_reply;
    return matchesSearch && matchesPending;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Customer Reviews & Feedback</h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            Monitor customer sentiment, reply directly to buyers, and build marketplace trust.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setFilterPending(!filterPending)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              backgroundColor: filterPending ? 'var(--color-primary)' : '#ffffff',
              color: filterPending ? '#ffffff' : 'var(--color-text-primary)',
              border: '1px solid var(--color-border-subtle)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {filterPending ? '✓ Showing Needs Reply' : 'Filter: Unanswered Reviews'}
          </button>
        </div>
      </div>

      {successNotice && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: 'var(--color-success-bg)',
          color: 'var(--color-success)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '20px',
          fontSize: '13px',
          fontWeight: 600
        }}>
          <CheckCircle2 size={16} />
          {successNotice}
        </div>
      )}

      {/* Search Filter */}
      <div style={{ position: 'relative', marginBottom: '24px' }}>
        <Search size={16} color="var(--color-text-muted)" style={{ position: 'absolute', left: '14px', top: '13px' }} />
        <input
          type="text"
          placeholder="Search by product, customer name, or comment keywords..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 16px 10px 38px',
            borderRadius: '8px',
            border: '1px solid var(--color-border-subtle)',
            backgroundColor: '#ffffff',
            fontSize: '13px'
          }}
        />
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[1, 2, 3].map(n => (
            <div key={n} className="skeleton" style={{ height: '140px', borderRadius: '8px' }} />
          ))}
        </div>
      ) : error ? (
        <div style={{ padding: '32px', textAlign: 'center', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid var(--color-border-card)' }}>
          <AlertCircle size={32} color="var(--color-error)" style={{ margin: '0 auto 8px' }} />
          <p style={{ color: 'var(--color-error)', fontWeight: 600 }}>{error}</p>
        </div>
      ) : filteredReviews.length === 0 ? (
        <div style={{ padding: '60px 24px', textAlign: 'center', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px dashed var(--color-border-subtle)' }}>
          <MessageSquare size={40} color="var(--color-text-muted)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>No Customer Reviews Found</h3>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            {filterPending ? 'All customer reviews on your catalog have been answered!' : 'Customer reviews on your catalog will appear here once shoppers rate their purchases.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {filteredReviews.map((r) => {
            const productImages = Array.isArray(r.product_images) 
              ? r.product_images 
              : (typeof r.product_images === 'string' ? JSON.parse(r.product_images || '[]') : []);
            const thumb = productImages[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80';
            const draftReply = replyTextMap[r.id] !== undefined ? replyTextMap[r.id] : (r.seller_reply || '');

            return (
              <div key={r.id} style={{
                backgroundColor: '#ffffff',
                borderRadius: '10px',
                border: '1px solid var(--color-border-card)',
                padding: '24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
              }}>
                {/* Header: Product preview + Rating */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img
                      src={thumb}
                      alt={r.product_title}
                      style={{ width: '48px', height: '48px', borderRadius: '6px', objectFit: 'contain', backgroundColor: '#f8fafc', padding: '2px', border: '1px solid #f1f5f9' }}
                    />
                    <div>
                      <a href={`/products/${r.product_id}`} target="_blank" rel="noreferrer" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                        {r.product_title}
                      </a>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>By {r.reviewer_name}</span>
                        {r.is_verified_purchase && (
                          <span className="badge badge-success" style={{ fontSize: '10px' }}>Verified Buyer</span>
                        )}
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          {new Date(r.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#fef3c7', padding: '3px 8px', borderRadius: '4px' }}>
                    <Star size={13} fill="#b45309" color="#b45309" />
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#b45309' }}>{r.rating} / 5</span>
                  </div>
                </div>

                {/* Customer Comment */}
                <div style={{ marginBottom: '18px' }}>
                  {r.title && <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '4px' }}>{r.title}</h4>}
                  <p style={{ fontSize: '13.5px', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                    "{r.comment}"
                  </p>
                </div>

                {/* Seller Reply Section */}
                <div style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '16px',
                  marginTop: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)' }}>
                    <CornerDownRight size={14} />
                    <span>Official Merchant Response ({r.store_name})</span>
                    {r.seller_reply_at && (
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 500, marginLeft: 'auto' }}>
                        Answered {new Date(r.seller_reply_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  <textarea
                    rows={3}
                    placeholder="Write a professional, helpful response to this customer..."
                    value={draftReply}
                    onChange={(e) => handleReplyChange(r.id, e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border-subtle)',
                      backgroundColor: '#ffffff',
                      fontSize: '13px',
                      lineHeight: 1.5,
                      marginBottom: '10px',
                      resize: 'vertical'
                    }}
                  />

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                      onClick={() => submitReply(r.id)}
                      disabled={submittingId === r.id || !draftReply.trim()}
                      className="btn-primary"
                      style={{
                        padding: '6px 14px',
                        fontSize: '12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: (!draftReply.trim() || submittingId === r.id) ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <Send size={13} />
                      {submittingId === r.id ? 'Saving...' : (r.seller_reply ? 'Update Reply' : 'Post Reply')}
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
};
