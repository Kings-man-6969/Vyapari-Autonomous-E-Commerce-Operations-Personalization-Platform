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
        setSuccessNotice(`Official reply posted successfully.`);
        setTimeout(() => setSuccessNotice(null), 3500);

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
    <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff' }}>
            Customer Feedback & Reviews
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-tide-pool)', marginTop: '4px' }}>
            Verified buyer sentiment, verified reviews, and merchant responses
          </p>
        </div>

        <button
          onClick={() => setFilterPending(!filterPending)}
          style={{
            padding: '8px 16px',
            borderRadius: '9999px',
            backgroundColor: filterPending ? '#ffffff' : 'var(--color-forest-floor)',
            color: filterPending ? '#02090a' : 'var(--color-tide-pool)',
            border: '1px solid',
            borderColor: filterPending ? '#ffffff' : 'var(--color-iron-veil)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          {filterPending ? 'Showing Unanswered Only' : 'Filter: Unanswered Reviews'}
        </button>
      </div>

      {successNotice && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: 'rgba(56, 189, 248, 0.12)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          color: 'var(--color-icy-steel)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '20px',
          fontSize: '0.875rem',
          fontWeight: 500
        }}>
          <CheckCircle2 size={16} />
          <span>{successNotice}</span>
        </div>
      )}

      {/* Search Filter */}
      <div style={{
        position: 'relative',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        background: 'var(--color-forest-floor)',
        border: '1px solid var(--color-iron-veil)',
        borderRadius: '9999px',
        padding: '2px 14px'
      }}>
        <Search size={15} color="var(--color-ash-label)" style={{ marginRight: '8px' }} />
        <input
          type="text"
          placeholder="Filter feedback by product title, reviewer name, or keyword..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 0',
            border: 'none',
            background: 'transparent',
            color: '#ffffff',
            fontSize: '13px',
            outline: 'none'
          }}
        />
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[1, 2, 3].map(n => (
            <div key={n} className="skeleton" style={{ height: '140px', borderRadius: '12px', backgroundColor: 'var(--color-forest-floor)' }} />
          ))}
        </div>
      ) : error ? (
        <div style={{ padding: '32px', textAlign: 'center', backgroundColor: 'var(--color-forest-floor)', borderRadius: '12px', border: '1px solid var(--color-iron-veil)' }}>
          <AlertCircle size={32} color="#f87171" style={{ margin: '0 auto 8px' }} />
          <p style={{ color: '#f87171', fontWeight: 500 }}>{error}</p>
        </div>
      ) : filteredReviews.length === 0 ? (
        <div style={{ padding: '60px 24px', textAlign: 'center', backgroundColor: 'var(--color-forest-floor)', borderRadius: '12px', border: '1px dashed var(--color-iron-veil)' }}>
          <MessageSquare size={40} color="var(--color-ash-label)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff', marginBottom: '6px' }}>
            No Customer Reviews Found
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-tide-pool)' }}>
            {filterPending ? 'All customer reviews on your catalog have been answered.' : 'Customer feedback on your catalog will populate here once verified buyers rate orders.'}
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
                backgroundColor: 'var(--color-forest-floor)',
                borderRadius: '12px',
                border: '1px solid var(--color-iron-veil)',
                padding: '24px',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)'
              }}>
                {/* Header: Product preview + Rating */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img
                      src={thumb}
                      alt={r.product_title}
                      style={{ width: '48px', height: '48px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--color-iron-veil)' }}
                    />
                    <div>
                      <a href={`/products/${r.product_id}`} target="_blank" rel="noreferrer" style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', textDecoration: 'none' }}>
                        {r.product_title}
                      </a>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--color-tide-pool)' }}>By {r.reviewer_name}</span>
                        {r.is_verified_purchase && (
                          <span className="badge-agent" style={{ fontSize: '10px' }}>Verified Buyer</span>
                        )}
                        <span style={{ fontSize: '11px', color: 'var(--color-ash-label)' }}>
                          {new Date(r.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--color-deep-canopy)', border: '1px solid var(--color-iron-veil)', padding: '4px 10px', borderRadius: '9999px' }}>
                    <Star size={12} fill="#fbbf24" color="#fbbf24" />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#fbbf24' }}>{r.rating} / 5</span>
                  </div>
                </div>

                {/* Customer Comment */}
                <div style={{ marginBottom: '18px' }}>
                  {r.title && <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', marginBottom: '4px' }}>{r.title}</h4>}
                  <p style={{ fontSize: '13.5px', color: 'var(--color-tide-pool)', lineHeight: 1.6 }}>
                    "{r.comment}"
                  </p>
                </div>

                {/* Seller Reply Section */}
                <div style={{
                  backgroundColor: 'var(--color-slate-chrome)',
                  border: '1px solid var(--color-border-steel)',
                  borderRadius: '8px',
                  padding: '16px',
                  marginTop: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--color-icy-steel)' }}>
                    <CornerDownRight size={14} />
                    <span>Official Merchant Response ({r.store_name})</span>
                    {r.seller_reply_at && (
                      <span style={{ fontSize: '11px', color: 'var(--color-ash-label)', fontWeight: 400, marginLeft: 'auto' }}>
                        Answered {new Date(r.seller_reply_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  <textarea
                    rows={3}
                    placeholder="Provide a professional, courteous response to address this customer..."
                    value={draftReply}
                    onChange={(e) => handleReplyChange(r.id, e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-iron-veil)',
                      backgroundColor: 'var(--color-abyssal-ink)',
                      color: '#ffffff',
                      fontSize: '13px',
                      lineHeight: 1.5,
                      marginBottom: '10px',
                      resize: 'vertical',
                      outline: 'none'
                    }}
                  />

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                      onClick={() => submitReply(r.id)}
                      disabled={submittingId === r.id || !draftReply.trim()}
                      style={{
                        padding: '6px 16px',
                        fontSize: '12px',
                        fontWeight: 600,
                        borderRadius: '9999px',
                        backgroundColor: '#ffffff',
                        color: '#02090a',
                        border: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: (!draftReply.trim() || submittingId === r.id) ? 'not-allowed' : 'pointer',
                        opacity: (!draftReply.trim() || submittingId === r.id) ? 0.5 : 1
                      }}
                    >
                      <Send size={12} />
                      <span>{submittingId === r.id ? 'Saving...' : (r.seller_reply ? 'Update Reply' : 'Post Reply')}</span>
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

export default SellerReviewsPage;
