import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle2, Clock, Truck, Package, ArrowLeft, Star, ShieldCheck } from 'lucide-react';
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
      // POST review with order verification
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
      <div className="container" style={{ padding: '48px 24px' }}>
        <div style={{ height: '300px' }} className="skeleton" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container" style={{ padding: '64px 24px', textAlign: 'center' }}>
        <h2>Order not found</h2>
        <Link to="/orders" className="btn-primary" style={{ marginTop: '16px', display: 'inline-block' }}>
          Back to Orders
        </Link>
      </div>
    );
  }

  const isDelivered = order.status === 'delivered';

  return (
    <div className="container" style={{ padding: '40px 24px', maxWidth: '900px' }}>
      <Link to="/orders" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
        <ArrowLeft size={16} /> Back to My Orders
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800 }}>
            Order #{order.id.slice(0, 8).toUpperCase()}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            Placed on {new Date(order.created_at).toLocaleString()} • Paid via {order.payment_gateway?.toUpperCase()}
          </p>
        </div>
        <span className="badge badge-success" style={{ fontSize: 'var(--font-size-sm)', padding: '6px 16px', textTransform: 'capitalize' }}>
          {order.status}
        </span>
      </div>

      {/* Status Timeline Card (order_status_history) */}
      <div style={{
        backgroundColor: '#ffffff',
        padding: '28px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border-card)',
        marginBottom: '32px',
        boxShadow: 'var(--shadow-xs)'
      }}>
        <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, marginBottom: '20px' }}>
          Fulfillment Timeline
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', paddingLeft: '24px' }}>
          <div style={{
            position: 'absolute',
            left: '7px',
            top: '8px',
            bottom: '8px',
            width: '2px',
            backgroundColor: 'var(--color-border-subtle)'
          }} />

          {timeline.map((event, index) => (
            <div key={event.id || index} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{
                position: 'absolute',
                left: '-24px',
                top: '4px',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: index === timeline.length - 1 ? 'var(--color-primary)' : 'var(--color-border-subtle)',
                border: '3px solid #ffffff'
              }} />

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', textTransform: 'uppercase' }}>
                  {event.status}
                </span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  {new Date(event.changed_at).toLocaleString()}
                </span>
              </div>
              {event.note && (
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  {event.note}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Items List */}
      <div style={{
        backgroundColor: '#ffffff',
        padding: '28px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border-card)',
        marginBottom: '32px',
        boxShadow: 'var(--shadow-xs)'
      }}>
        <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, marginBottom: '20px' }}>
          Purchased Items ({items.length})
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {items.map((item) => {
            const images = Array.isArray(item.images) ? item.images : (typeof item.images === 'string' ? JSON.parse(item.images || '[]') : []);
            const img = images[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80';

            return (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--color-border-card)' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <img src={img} alt={item.title} style={{ width: '64px', height: '64px', borderRadius: 'var(--radius-sm)', objectFit: 'cover' }} />
                  <div>
                    <h4 style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{item.title}</h4>
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                      Sold by {item.store_name} • Qty: {item.quantity}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ fontWeight: 700, fontSize: 'var(--font-size-base)' }}>
                    ₹{(parseFloat(item.price_at_purchase) * item.quantity).toLocaleString('en-IN')}
                  </span>

                  {/* Verified Review Gate */}
                  {isDelivered && (
                    <button
                      onClick={() => setReviewProductId(item.product_id)}
                      className="btn-outline"
                      style={{ fontSize: 'var(--font-size-xs)', padding: '6px 12px' }}
                    >
                      <Star size={14} style={{ marginRight: '4px' }} /> Write Review
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '20px', fontWeight: 800, fontSize: 'var(--font-size-lg)' }}>
          <span>Total Paid</span>
          <span style={{ color: 'var(--color-primary)' }}>₹{parseFloat(order.total_amount).toLocaleString('en-IN')}</span>
        </div>
      </div>

      {/* Review Modal */}
      {reviewProductId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: 'var(--radius-md)',
            padding: '32px',
            maxWidth: '500px',
            width: '100%',
            boxShadow: 'var(--shadow-floating)'
          }}>
            <h3 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, marginBottom: '8px' }}>
              Write Verified Purchase Review
            </h3>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
              Your feedback is verified against Order #{order.id.slice(0, 8).toUpperCase()}.
            </p>

            {reviewSuccess ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-success)', fontWeight: 700 }}>
                ✓ Review submitted successfully!
              </div>
            ) : (
              <form onSubmit={handleReviewSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '6px' }}>
                    Rating (1-5 Stars)
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        type="button"
                        key={s}
                        onClick={() => setReviewRating(s)}
                        style={{ padding: '6px' }}
                      >
                        <Star size={24} fill={s <= reviewRating ? '#FFB800' : 'none'} color="#FFB800" />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '6px' }}>
                    Review Headline
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Excellent build quality and sound"
                    value={reviewTitle}
                    onChange={(e) => setReviewTitle(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)', fontSize: 'var(--font-size-sm)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '6px' }}>
                    Review Comment
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Share details about performance, durability, and packaging..."
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)', fontSize: 'var(--font-size-sm)', fontFamily: 'inherit' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setReviewProductId(null)}
                    className="btn-outline"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={reviewSubmitting}
                    className="btn-primary"
                  >
                    {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
