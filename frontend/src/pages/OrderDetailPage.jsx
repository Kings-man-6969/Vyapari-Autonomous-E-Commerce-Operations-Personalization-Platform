import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle2, Clock, Truck, Package, ArrowLeft, Star, ShieldCheck, Zap } from 'lucide-react';
import api from '../services/api';

export const OrderDetailPage = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);

  // Review modal state
  const [reviewProductId, setReviewProductId] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  useEffect(() => {
    const fetchOrderDetail = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/orders/${id}`);
        if (res.data?.success) {
          setOrder(res.data.data.order);
          setItems(res.data.data.items || []);
          setTimeline(res.data.data.timeline || []);
        }
      } catch (err) {
        console.error('Failed to load order:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrderDetail();
  }, [id]);

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setReviewSubmitting(true);
    try {
      await api.post('/products/reviews', {
        product_id: reviewProductId,
        order_id: id,
        rating: reviewRating,
        title: reviewTitle,
        comment: reviewComment
      });
      setReviewSuccess(true);
      setTimeout(() => {
        setReviewProductId(null);
        setReviewSuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to post review:', err);
      alert(err.response?.data?.error?.message || 'Failed to submit review.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ backgroundColor: 'var(--color-obsidian-graphite)', minHeight: 'calc(100vh - 76px)', padding: '52px 24px' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <div style={{ height: '320px', backgroundColor: 'var(--color-gunmetal-dark)', borderRadius: '16px', border: '1px solid var(--color-border-steel)' }} className="skeleton" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div style={{ backgroundColor: 'var(--color-obsidian-graphite)', minHeight: 'calc(100vh - 76px)', padding: '64px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: '440px', margin: '0 auto', backgroundColor: 'var(--color-gunmetal-dark)', padding: '40px', borderRadius: '16px', border: '1px solid var(--color-border-steel)' }}>
          <h2 className="heading-whisper" style={{ fontSize: '22px', color: '#ffffff', marginBottom: '12px' }}>Order Not Found</h2>
          <p style={{ fontSize: '13px', color: 'var(--color-silver-glow)', opacity: 0.75, marginBottom: '24px' }}>
            We couldn't find details for this order. Please check the order ID or visit your orders page.
          </p>
          <Link 
            to="/orders" 
            className="btn-primary"
            style={{ display: 'inline-block', padding: '12px 24px' }}
          >
            View All Orders
          </Link>
        </div>
      </div>
    );
  }

  const isDelivered = order.status === 'delivered';

  return (
    <div style={{ backgroundColor: 'var(--color-obsidian-graphite)', minHeight: 'calc(100vh - 76px)', padding: '48px 24px 80px' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        <Link 
          to="/orders" 
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '6px', 
            fontSize: '13px', 
            color: 'var(--color-silver-glow)', 
            marginBottom: '24px',
            textDecoration: 'none',
            opacity: 0.8
          }}
        >
          <ArrowLeft size={16} /> Back to My Orders
        </Link>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 className="heading-whisper" style={{ fontSize: '30px', color: '#ffffff', letterSpacing: '0.02em', margin: 0 }}>
              Order #{order.id.slice(0, 8).toUpperCase()}
            </h1>
            <p style={{ color: 'var(--color-silver-glow)', opacity: 0.75, fontSize: '13px', marginTop: '6px' }}>
              Placed on {new Date(order.created_at).toLocaleString()} • Paid via {order.payment_gateway?.toUpperCase() || 'RAZORPAY MOCK'}
            </p>
          </div>
          <span className="status-pill status-pill-active" style={{ textTransform: 'capitalize', fontSize: '12px', padding: '6px 14px' }}>
            {order.status.replace('_', ' ')}
          </span>
        </div>

        {/* Order Tracking Timeline */}
        <div style={{
          backgroundColor: 'var(--color-gunmetal-dark)',
          padding: '30px',
          borderRadius: '16px',
          border: '1px solid var(--color-border-steel)',
          marginBottom: '28px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
        }}>
          <h2 className="heading-whisper" style={{ fontSize: '18px', color: '#ffffff', marginBottom: '24px' }}>
            Delivery & Tracking Updates
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', position: 'relative', paddingLeft: '28px' }}>
            <div style={{
              position: 'absolute',
              left: '8px',
              top: '8px',
              bottom: '8px',
              width: '2px',
              backgroundColor: 'var(--color-border-steel)'
            }} />

            {timeline.map((event, index) => (
              <div key={event.id || index} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{
                  position: 'absolute',
                  left: '-28px',
                  top: '2px',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: index === timeline.length - 1 ? 'var(--color-icy-steel)' : 'var(--color-titanium-brushed)',
                  border: '3px solid var(--color-gunmetal-dark)',
                  boxShadow: index === timeline.length - 1 ? '0 0 10px rgba(56, 189, 248, 0.4)' : 'none'
                }} />

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', color: '#ffffff', letterSpacing: '0.04em' }}>
                    {event.status.replace('_', ' ')}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--color-ash-label)' }}>
                    {new Date(event.changed_at).toLocaleString()}
                  </span>
                </div>
                {event.note && (
                  <p style={{ fontSize: '12px', color: 'var(--color-silver-glow)', opacity: 0.8, marginTop: '2px', margin: 0, lineHeight: 1.4 }}>
                    {event.note}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Purchased Items List */}
        <div style={{
          backgroundColor: 'var(--color-gunmetal-dark)',
          padding: '30px',
          borderRadius: '16px',
          border: '1px solid var(--color-border-steel)',
          marginBottom: '28px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
        }}>
          <h2 className="heading-whisper" style={{ fontSize: '18px', color: '#ffffff', marginBottom: '24px' }}>
            Items Ordered ({items.length})
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {items.map((item) => {
              const images = Array.isArray(item.images) ? item.images : (typeof item.images === 'string' ? JSON.parse(item.images || '[]') : []);
              const img = images[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80';

              return (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '18px', borderBottom: '1px solid var(--color-border-steel)', flexWrap: 'wrap', gap: '14px' }}>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <img src={img} alt={item.title} style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'contain', backgroundColor: 'var(--color-obsidian-graphite)', border: '1px solid var(--color-border-steel)', padding: '4px' }} />
                    <div>
                      <h4 style={{ fontWeight: 500, fontSize: '14px', color: '#ffffff', margin: 0 }}>{item.title}</h4>
                      <p style={{ fontSize: '12px', color: 'var(--color-silver-glow)', opacity: 0.75, marginTop: '4px', margin: 0 }}>
                        Sold by <strong style={{ color: '#ffffff' }}>{item.store_name}</strong> • Qty: {item.quantity}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                    <span style={{ fontWeight: 600, fontSize: '16px', color: '#ffffff' }}>
                      ₹{(parseFloat(item.price_at_purchase) * item.quantity).toLocaleString('en-IN')}
                    </span>

                    {/* Verified Review Gate */}
                    {isDelivered && (
                      <button
                        onClick={() => setReviewProductId(item.product_id)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 'var(--radius-pills)',
                          backgroundColor: 'var(--color-titanium-brushed)',
                          border: '1px solid var(--color-border-chrome)',
                          color: 'var(--color-icy-steel)',
                          fontSize: '12px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        <Star size={13} fill="var(--color-silver-glow)" stroke="none" />
                        <span>Review</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: '22px', marginTop: '10px' }}>
            <span style={{ fontSize: '15px', fontWeight: 500, color: '#ffffff' }}>Order Total</span>
            <span style={{ fontSize: '24px', fontWeight: 600, color: '#ffffff', letterSpacing: '0.01em' }}>
              ₹{parseFloat(order.total_amount).toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Review Modal */}
        {reviewProductId && (
          <div className="modal-overlay">
            <div className="modal-dialog" style={{ backgroundColor: 'var(--color-gunmetal-dark)', border: '1px solid var(--color-border-steel)', maxWidth: '520px', borderRadius: '16px', padding: '32px' }}>
              <h3 className="heading-whisper" style={{ fontSize: '20px', color: '#ffffff', marginBottom: '6px' }}>
                Write a Review
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--color-silver-glow)', opacity: 0.75, marginBottom: '24px' }}>
                Share your experience with other customers for Order #{order.id.slice(0, 8).toUpperCase()}.
              </p>

              {reviewSuccess ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-icy-steel)', fontWeight: 500, fontSize: '14px' }}>
                  ✓ Thank you! Your review has been successfully submitted.
                </div>
              ) : (
                <form onSubmit={handleReviewSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-ash-label)', marginBottom: '8px' }}>
                      Rating Score
                    </label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          type="button"
                          key={s}
                          onClick={() => setReviewRating(s)}
                          style={{ background: 'transparent', border: 'none', padding: '4px', cursor: 'pointer' }}
                        >
                          <Star size={24} fill={s <= reviewRating ? 'var(--color-silver-glow)' : 'none'} color={s <= reviewRating ? 'var(--color-silver-glow)' : 'var(--color-border-steel)'} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Add a headline</label>
                    <input
                      type="text"
                      required
                      placeholder="What's most important to know?"
                      value={reviewTitle}
                      onChange={(e) => setReviewTitle(e.target.value)}
                      className="input-field"
                      style={{ backgroundColor: 'var(--color-obsidian-graphite)', borderColor: 'var(--color-border-steel)' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Write your review</label>
                    <textarea
                      required
                      rows={4}
                      placeholder="What did you like or dislike? How was the quality and fit?"
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      className="textarea-field"
                      style={{ backgroundColor: 'var(--color-obsidian-graphite)', borderColor: 'var(--color-border-steel)' }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setReviewProductId(null)}
                      className="btn-outline"
                      style={{ padding: '9px 20px', fontSize: '12px' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={reviewSubmitting}
                      className="btn-primary"
                      style={{ padding: '9px 24px', fontSize: '12px' }}
                    >
                      {reviewSubmitting ? 'Submitting...' : 'Post Review'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderDetailPage;
