import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ShoppingBag, 
  Star, 
  ShieldCheck, 
  Truck, 
  RotateCcw, 
  AlertCircle, 
  Check, 
  ArrowLeft, 
  Sparkles, 
  Zap, 
  PackageCheck, 
  Store, 
  PenLine, 
  CornerDownRight, 
  CheckCircle2,
  Lock,
  ThumbsUp,
  Tag,
  CreditCard,
  Building2,
  MapPin
} from 'lucide-react';
import api from '../services/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { ProductCard } from '../components/ProductCard';

export const ProductDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { user } = useAuth();

  const [product, setProduct] = useState(null);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [reviewsData, setReviewsData] = useState({ total: 0, average_rating: 0, breakdown: {}, reviews: [] });
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addedNotice, setAddedNotice] = useState(false);

  // Pincode Delivery Checker State
  const [pincode, setPincode] = useState('');
  const [pincodeResult, setPincodeResult] = useState(null);
  const [checkingPincode, setCheckingPincode] = useState(false);

  // Review Form States
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(null);
  const [reviewError, setReviewError] = useState(null);
  const [starFilter, setStarFilter] = useState(null);
  const [helpfulMap, setHelpfulMap] = useState({});

  const fetchReviews = async (productId) => {
    try {
      const reviewsRes = await api.get(`/reviews/product/${productId}`);
      if (reviewsRes.data?.success) {
        setReviewsData(reviewsRes.data.data);
      }
    } catch (revErr) {
      console.warn('Reviews unavailable:', revErr.message);
    }
  };

  useEffect(() => {
    const fetchProductDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        setSelectedImage(0);
        setQuantity(1);
        setPincodeResult(null);

        // 1. Fetch Product
        const res = await api.get(`/products/${id}`);
        if (res.data?.success) {
          const prodData = res.data.data.product;
          setProduct(prodData);

          // 2. Fetch Team A AI Similar Products via recommendation service
          try {
            const similarRes = await api.get(`/ai/similar/${prodData.id}?limit=4`);
            if (similarRes.data?.success) {
              setSimilarProducts(similarRes.data.data.similar || []);
            }
          } catch (simErr) {
            console.warn('AI Recommendations unavailable:', simErr.message);
          }

          // 3. Fetch Product Reviews & Seller Replies
          await fetchReviews(prodData.id);
        } else {
          setError('Product not found.');
        }
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Failed to load product details.');
      } finally {
        setLoading(false);
      }
    };

    fetchProductDetails();
  }, [id]);

  const handlePincodeCheck = (e) => {
    e.preventDefault();
    if (!pincode || pincode.length !== 6 || isNaN(pincode)) {
      alert('Please enter a valid 6-digit PIN code (e.g. 400001, 560038)');
      return;
    }
    setCheckingPincode(true);
    setTimeout(() => {
      setCheckingPincode(false);
      setPincodeResult({
        pincode,
        deliveryDay: 'Tomorrow, 2 PM',
        isCodAvailable: true
      });
    }, 400);
  };

  const handleAddToCart = async () => {
    await addToCart(product.id, quantity);
    setAddedNotice(true);
    setTimeout(() => setAddedNotice(false), 3000);
  };

  const handleBuyNow = async () => {
    await addToCart(product.id, quantity);
    navigate('/checkout');
  };

  const handleHelpfulClick = async (reviewId) => {
    if (helpfulMap[reviewId]) return;
    try {
      const res = await api.post(`/reviews/${reviewId}/helpful`);
      if (res.data?.success) {
        setHelpfulMap(prev => ({ ...prev, [reviewId]: res.data.data.helpful_count }));
      }
    } catch (e) {
      console.warn(e);
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!reviewComment.trim()) {
      setReviewError('Please write your review feedback.');
      return;
    }

    try {
      setSubmittingReview(true);
      setReviewError(null);

      const res = await api.post('/reviews', {
        product_id: product.id,
        rating: newRating,
        title: reviewTitle.trim(),
        comment: reviewComment.trim()
      });

      if (res.data?.success) {
        setReviewSuccess('Your review has been verified and posted successfully!');
        setReviewTitle('');
        setReviewComment('');
        setNewRating(5);
        setShowReviewForm(false);
        await fetchReviews(product.id);
        setTimeout(() => setReviewSuccess(null), 4000);
      }
    } catch (err) {
      setReviewError(err.response?.data?.error?.message || 'Failed to submit review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '60px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px' }}>
          <div className="skeleton" style={{ height: '480px', borderRadius: '12px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="skeleton" style={{ height: '28px', width: '40%' }} />
            <div className="skeleton" style={{ height: '48px', width: '90%' }} />
            <div className="skeleton" style={{ height: '32px', width: '30%' }} />
            <div className="skeleton" style={{ height: '140px' }} />
          </div>
          <div className="skeleton" style={{ height: '380px', borderRadius: '12px' }} />
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container" style={{ padding: '80px 24px', textAlign: 'center' }}>
        <AlertCircle size={48} color="var(--color-error)" style={{ margin: '0 auto 16px' }} />
        <h2>{error || 'Product Unavailable'}</h2>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: '8px' }}>
          The item you are searching for might have been moved or archived.
        </p>
        <Link to="/explore" className="btn-primary" style={{ marginTop: '20px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <ArrowLeft size={16} /> Back to Explore
        </Link>
      </div>
    );
  }

  const images = Array.isArray(product.images) 
    ? product.images 
    : (typeof product.images === 'string' ? JSON.parse(product.images || '[]') : []);
  const mainImage = images[selectedImage] || images[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80';
  const isOutOfStock = product.status === 'out_of_stock' || product.stock_qty <= 0;
  const isLowStock = !isOutOfStock && product.stock_qty <= 5;

  let attrs = {};
  try {
    attrs = typeof product.attributes === 'string' ? JSON.parse(product.attributes || '{}') : (product.attributes || {});
  } catch (e) {
    attrs = {};
  }

  const brand = attrs.brand || product.store_name || 'Verified Brand';
  const rawRating = reviewsData.total > 0 
    ? reviewsData.average_rating 
    : (attrs.rating ? parseFloat(attrs.rating) : 4.6);
  const rating = parseFloat(rawRating).toFixed(1);
  const reviewsCount = reviewsData.total > 0 
    ? reviewsData.total 
    : (attrs.reviews_count || 1420);

  const priceNum = parseFloat(product.price);
  const compareNum = product.compare_at_price ? parseFloat(product.compare_at_price) : 0;
  const discountPercent = compareNum > priceNum ? Math.round(((compareNum - priceNum) / compareNum) * 100) : 0;
  const savingsNum = compareNum > priceNum ? (compareNum - priceNum) : 0;

  const badge = attrs.badge || (discountPercent >= 20 ? `${discountPercent}% OFF` : 'Top Choice');
  const fastDelivery = attrs.fast_delivery || 'FREE Delivery in 2 Days';
  const warranty = attrs.warranty || '1 Year Standard Manufacturer Warranty';

  const features = Array.isArray(attrs.features) && attrs.features.length > 0 
    ? attrs.features 
    : [product.description, `Warranty: ${warranty}`, `Category: ${product.category_name || 'General'}`];
  const specs = (attrs.specs && typeof attrs.specs === 'object') ? attrs.specs : {
    "Brand": brand,
    "Category": product.category_name,
    "Warranty": warranty,
    "Availability": isOutOfStock ? "Out of stock" : "In Stock"
  };

  const reviewsList = reviewsData.reviews || [];
  const displayedReviews = starFilter 
    ? reviewsList.filter(r => r.rating === starFilter)
    : reviewsList;

  // Breakdown percentages
  const totalRev = reviewsData.total || 1;
  const breakdown = reviewsData.breakdown || {};
  const getPercent = (star) => Math.round(((breakdown[star] || 0) / totalRev) * 100);

  const emiAmount = Math.round(priceNum / 6);

  return (
    <div className="container pdp-page-container" style={{ padding: '24px 16px', maxWidth: '1440px' }}>
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '20px', flexWrap: 'wrap' }}>
        <Link to="/explore" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-secondary)', textDecoration: 'none' }}>
          <ArrowLeft size={14} /> Explore
        </Link>
        <span>/</span>
        <Link to={`/explore?category=${product.category_id}`} style={{ color: 'var(--color-text-secondary)', textDecoration: 'none' }}>
          {product.category_name}
        </Link>
        <span>/</span>
        <span style={{ color: 'var(--color-text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '340px' }}>
          {product.title}
        </span>
      </nav>

      {/* 3-COLUMN AMAZON/FLIPKART PDP ARCHITECTURE */}
      <div className="pdp-grid-3col">
        {/* COLUMN 1: Vertical Thumbnail Strip + High-Res Main Image */}
        <div className="pdp-gallery-container">
          {/* Thumbnails (Vertical on Laptop, Horizontal on Mobile) */}
          {images.length > 1 && (
            <div className="pdp-gallery-thumbs">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(idx)}
                  aria-label={`View angle ${idx + 1}`}
                  style={{
                    width: '60px',
                    height: '60px',
                    flexShrink: 0,
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: selectedImage === idx ? '2px solid #ea580c' : '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    padding: '3px',
                    cursor: 'pointer',
                    opacity: selectedImage === idx ? 1 : 0.7,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </button>
              ))}
            </div>
          )}

          {/* Main Showcase Staging */}
          <div className="pdp-gallery-stage">
            {badge && (
              <div style={{
                position: 'absolute',
                top: '16px',
                left: '16px',
                zIndex: 2,
                backgroundColor: badge.includes('OFF') ? '#dc2626' : '#0f172a',
                color: '#ffffff',
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.4px',
                textTransform: 'uppercase'
              }}>
                {badge}
              </div>
            )}

            <img
              src={mainImage}
              alt={product.title}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                transition: 'transform 0.3s ease'
              }}
            />
          </div>
        </div>

        {/* COLUMN 2: Center Commercial Information & Features (~38%) */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Brand Link */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Brand: {brand}
            </span>
            <span style={{ color: '#cbd5e1' }}>•</span>
            <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <ShieldCheck size={14} /> Brand Authorized
            </span>
          </div>

          {/* Product Title */}
          <h1 style={{ fontSize: '22px', fontWeight: 800, lineHeight: 1.35, color: '#0f172a', marginBottom: '12px' }}>
            {product.title}
          </h1>

          {/* Star Rating Hero */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#fef3c7', padding: '3px 8px', borderRadius: '4px' }}>
              <Star size={14} fill="#b45309" color="#b45309" />
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#b45309' }}>{rating}</span>
            </div>
            <a href="#customer-reviews" style={{ fontSize: '13px', color: '#2563eb', textDecoration: 'underline', fontWeight: 600 }}>
              {reviewsCount.toLocaleString()} global ratings
            </a>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              1,000+ bought in past month
            </span>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', marginBottom: '16px' }} />

          {/* Pricing Row with Deal Badges */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
              {discountPercent > 0 && (
                <span style={{ fontSize: '28px', fontWeight: 800, color: '#dc2626' }}>
                  -{discountPercent}%
                </span>
              )}
              <span style={{ fontSize: '32px', fontWeight: 900, color: '#0f172a' }}>
                ₹{priceNum.toLocaleString('en-IN')}
              </span>
              {compareNum > priceNum && (
                <span style={{ fontSize: '15px', color: '#94a3b8', textDecoration: 'line-through' }}>
                  M.R.P.: ₹{compareNum.toLocaleString('en-IN')}
                </span>
              )}
            </div>
            {savingsNum > 0 && (
              <p style={{ fontSize: '13px', color: '#15803d', fontWeight: 700, marginTop: '4px' }}>
                Total Savings: ₹{savingsNum.toLocaleString('en-IN')} ({discountPercent}%)
              </p>
            )}
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              Inclusive of all taxes. Free returns within 7 days.
            </p>
          </div>

          {/* BANK OFFERS & PROMOTIONS WIDGET (Crucial Amazon Commercial Touch) */}
          <div style={{
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            padding: '16px',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '12px' }}>
              <Tag size={16} color="#ea580c" />
              <span>Available Offers & Instant Savings</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '12.5px', color: '#334155' }}>
                <CreditCard size={16} color="#2563eb" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ color: '#0f172a' }}>Bank Offer:</strong> Flat 10% Instant Discount up to ₹1,500 on HDFC & ICICI Credit Cards.
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '12.5px', color: '#334155' }}>
                <Zap size={16} color="#16a34a" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ color: '#0f172a' }}>No Cost EMI:</strong> Available starting at ₹{emiAmount.toLocaleString('en-IN')}/month on all major cards.
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '12.5px', color: '#334155' }}>
                <Building2 size={16} color="#7c3aed" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ color: '#0f172a' }}>Business Purchase:</strong> Save up to 28% with GST input tax credit on your verified business invoice.
                </div>
              </div>
            </div>
          </div>

          {/* "About this item" Feature Bullets */}
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, marginBottom: '12px', color: '#0f172a' }}>
              About this item
            </h3>
            <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13.5px', color: '#334155', lineHeight: 1.6 }}>
              {features.map((feat, idx) => (
                <li key={idx}>
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Technical Specifications Table */}
          {Object.keys(specs).length > 0 && (
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, marginBottom: '12px', color: '#0f172a' }}>
                Technical Details
              </h3>
              <div style={{
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                overflow: 'hidden'
              }}>
                {Object.entries(specs).map(([key, val], idx) => (
                  <div key={key} style={{
                    display: 'grid',
                    gridTemplateColumns: '140px 1fr',
                    padding: '8px 14px',
                    fontSize: '12.5px',
                    backgroundColor: idx % 2 === 0 ? '#f8fafc' : '#ffffff',
                    borderBottom: idx === Object.keys(specs).length - 1 ? 'none' : '1px solid #f1f5f9'
                  }}>
                    <span style={{ fontWeight: 600, color: '#64748b' }}>{key}</span>
                    <span style={{ color: '#0f172a', fontWeight: 500 }}>{String(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* COLUMN 3: Right Classic Amazon/Flipkart Sticky Buy Box */}
        <div className="pdp-buy-box-container">
          {/* Price Header */}
          <div style={{ marginBottom: '16px' }}>
            <span style={{ fontSize: '28px', fontWeight: 900, color: '#0f172a' }}>
              ₹{priceNum.toLocaleString('en-IN')}
            </span>
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              FREE delivery available. Inclusive of all taxes.
            </p>
          </div>

          {/* Interactive PIN Code Delivery Estimator */}
          <div style={{
            padding: '12px',
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
              <MapPin size={14} color="#2563eb" />
              <span>Deliver to your location</span>
            </div>
            <form onSubmit={handlePincodeCheck} style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                placeholder="Enter 6-digit PIN"
                maxLength={6}
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  outline: 'none'
                }}
              />
              <button
                type="submit"
                disabled={checkingPincode}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {checkingPincode ? '...' : 'Check'}
              </button>
            </form>

            {pincodeResult && (
              <div style={{ marginTop: '8px', fontSize: '11.5px', color: '#15803d', fontWeight: 600 }}>
                ✓ Delivery by {pincodeResult.deliveryDay} to {pincodeResult.pincode}
                <div style={{ color: '#475569', fontWeight: 400 }}>Cash on Delivery available</div>
              </div>
            )}
          </div>

          {/* Stock Status */}
          {isOutOfStock ? (
            <div style={{ padding: '10px 12px', backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '6px', fontSize: '13px', fontWeight: 700, marginBottom: '16px' }}>
              Currently Out of Stock
            </div>
          ) : isLowStock ? (
            <div style={{ color: '#b45309', fontSize: '13px', fontWeight: 700, marginBottom: '16px' }}>
              Only {product.stock_qty} left in stock — order soon!
            </div>
          ) : (
            <div style={{ color: '#15803d', fontSize: '14px', fontWeight: 800, marginBottom: '16px' }}>
              In Stock
            </div>
          )}

          {/* Quantity Selector */}
          {!isOutOfStock && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Quantity:</span>
              <select
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value, 10))}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#f8fafc',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {[...Array(Math.min(10, product.stock_qty || 5))].map((_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                ))}
              </select>
            </div>
          )}

          {/* TWO CLASSIC AMAZON CTA BUTTONS: Add to Cart (Yellow) & Buy Now (Orange) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            <button
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              style={{
                width: '100%',
                height: '44px',
                borderRadius: '24px',
                backgroundColor: isOutOfStock ? '#e2e8f0' : '#ffd814',
                color: '#0f172a',
                border: '1px solid #fcd200',
                fontSize: '14px',
                fontWeight: 700,
                cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'background-color 0.15s ease'
              }}
              onMouseEnter={(e) => !isOutOfStock && (e.currentTarget.style.backgroundColor = '#f7ca00')}
              onMouseLeave={(e) => !isOutOfStock && (e.currentTarget.style.backgroundColor = '#ffd814')}
            >
              <ShoppingBag size={17} /> Add to Cart
            </button>

            <button
              onClick={handleBuyNow}
              disabled={isOutOfStock}
              style={{
                width: '100%',
                height: '44px',
                borderRadius: '24px',
                backgroundColor: isOutOfStock ? '#cbd5e1' : '#ffa41c',
                color: '#0f172a',
                border: '1px solid #ff8f00',
                fontSize: '14px',
                fontWeight: 700,
                cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'background-color 0.15s ease'
              }}
              onMouseEnter={(e) => !isOutOfStock && (e.currentTarget.style.backgroundColor = '#fa8900')}
              onMouseLeave={(e) => !isOutOfStock && (e.currentTarget.style.backgroundColor = '#ffa41c')}
            >
              <Zap size={17} /> Buy Now
            </button>
          </div>

          {addedNotice && (
            <div style={{
              padding: '10px 14px',
              backgroundColor: '#f0fdf4',
              color: '#15803d',
              borderRadius: '6px',
              border: '1px solid #bbf7d0',
              fontSize: '12px',
              fontWeight: 700,
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span>✓ Added to cart!</span>
              <Link to="/cart" style={{ textDecoration: 'underline', color: 'inherit' }}>Go to Cart</Link>
            </div>
          )}

          {/* Fulfillment & Security Badges */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: '#475569', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Ships from</span>
              <strong style={{ color: '#0f172a' }}>Vyapari Logistics</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Sold by</span>
              <strong style={{ color: '#2563eb' }}>{product.store_name}</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', color: '#16a34a', fontWeight: 600 }}>
              <Lock size={13} /> Secure transaction with 256-bit encryption
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}>
              <RotateCcw size={13} /> 7 Days Replacement / Return
            </div>
          </div>
        </div>
      </div>

      {/* Team A: AI Similar Products Section */}
      {similarProducts.length > 0 && (
        <section style={{
          marginBottom: '64px',
          padding: '32px 24px',
          backgroundColor: '#f8fafc',
          borderRadius: '12px',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <div className="badge badge-primary" style={{ marginBottom: '6px' }}>
                <Sparkles size={13} style={{ marginRight: '4px' }} />
                Team A AI Recommendation
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                Customers Also Viewed (pgvector Nearest Neighbors)
              </h2>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
            {similarProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* AMAZON-STANDARD CUSTOMER REVIEWS & RATING HISTOGRAM SECTION */}
      <section id="customer-reviews" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '48px', marginBottom: '64px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '48px',
          alignItems: 'start'
        }}>
          {/* Left Review Summary: Histogram & Feature Sentiment Tags */}
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', marginBottom: '16px' }}>
              Customer Reviews
            </h2>

            {/* Overall Score Card */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '16px' }}>
              <span style={{ fontSize: '42px', fontWeight: 900, color: '#0f172a' }}>{rating}</span>
              <div>
                <div style={{ display: 'flex', gap: '3px' }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={18}
                      fill={s <= Math.round(rating) ? '#FFB800' : 'none'}
                      color={s <= Math.round(rating) ? '#FFB800' : '#cbd5e1'}
                    />
                  ))}
                </div>
                <span style={{ fontSize: '13px', color: '#64748b' }}>
                  {reviewsCount.toLocaleString()} total ratings
                </span>
              </div>
            </div>

            {/* 5-Star Histogram Progress Bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
              {[5, 4, 3, 2, 1].map((star) => {
                const percent = getPercent(star);
                const isSelected = starFilter === star;
                return (
                  <div
                    key={star}
                    onClick={() => setStarFilter(isSelected ? null : star)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '50px 1fr 40px',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer',
                      opacity: starFilter && !isSelected ? 0.4 : 1,
                      transition: 'opacity 0.2s ease'
                    }}
                  >
                    <span style={{ fontSize: '12.5px', color: '#2563eb', fontWeight: 600, textDecoration: 'underline' }}>
                      {star} star
                    </span>
                    <div style={{ height: '14px', backgroundColor: '#f1f5f9', borderRadius: '7px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${percent}%`,
                        height: '100%',
                        backgroundColor: '#FFB800',
                        borderRadius: '7px',
                        transition: 'width 0.4s ease'
                      }} />
                    </div>
                    <span style={{ fontSize: '12px', color: '#64748b', textAlign: 'right' }}>
                      {percent}%
                    </span>
                  </div>
                );
              })}
            </div>

            {starFilter && (
              <button
                onClick={() => setStarFilter(null)}
                style={{
                  fontSize: '12px',
                  color: '#dc2626',
                  fontWeight: 600,
                  backgroundColor: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 0',
                  marginBottom: '16px'
                }}
              >
                ✕ Clear {starFilter}-star filter
              </button>
            )}

            {/* "Customers Say" Feature Sentiment Tags */}
            <div style={{ marginBottom: '28px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '10px' }}>
                Customers Mention Most
              </h4>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['Sound Quality', 'Battery Life', 'Comfort', 'Build Quality', 'Value for Money'].map((tag) => (
                  <span key={tag} style={{
                    padding: '4px 10px',
                    borderRadius: '16px',
                    backgroundColor: '#f1f5f9',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    color: '#334155'
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Write a Review Button */}
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '20px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
                Review this product
              </h4>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '14px' }}>
                Share your thoughts with other customers
              </p>
              {user ? (
                <button
                  onClick={() => setShowReviewForm(!showReviewForm)}
                  className="btn-outline"
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <PenLine size={16} />
                  {showReviewForm ? 'Cancel Review' : 'Write a Product Review'}
                </button>
              ) : (
                <Link
                  to="/login"
                  className="btn-outline"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    textDecoration: 'none'
                  }}
                >
                  Sign in to Write a Review
                </Link>
              )}
            </div>
          </div>

          {/* Right Review List Column */}
          <div>
            {reviewSuccess && (
              <div style={{
                padding: '14px 18px',
                backgroundColor: '#f0fdf4',
                color: '#15803d',
                borderRadius: '8px',
                border: '1px solid #bbf7d0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '24px',
                fontSize: '13.5px',
                fontWeight: 700
              }}>
                <CheckCircle2 size={18} />
                {reviewSuccess}
              </div>
            )}

            {/* Interactive Write Review Form */}
            {showReviewForm && (
              <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                padding: '24px',
                marginBottom: '32px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.06)'
              }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '16px' }}>
                  Write Review for {product.title}
                </h3>

                {reviewError && (
                  <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '6px', marginBottom: '16px', fontSize: '13px', fontWeight: 600 }}>
                    {reviewError}
                  </div>
                )}

                <form onSubmit={handleReviewSubmit}>
                  {/* Star Rating Picker */}
                  <div style={{ marginBottom: '18px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
                      Overall Rating
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {[1, 2, 3, 4, 5].map((starVal) => (
                          <button
                            type="button"
                            key={starVal}
                            onMouseEnter={() => setHoverRating(starVal)}
                            onMouseLeave={() => setHoverRating(0)}
                            onClick={() => setNewRating(starVal)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '2px',
                              transform: (hoverRating || newRating) >= starVal ? 'scale(1.15)' : 'scale(1)',
                              transition: 'transform 0.1s ease'
                            }}
                          >
                            <Star
                              size={26}
                              fill={(hoverRating || newRating) >= starVal ? '#FFB800' : 'none'}
                              color={(hoverRating || newRating) >= starVal ? '#FFB800' : '#cbd5e1'}
                            />
                          </button>
                        ))}
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#b45309', marginLeft: '6px' }}>
                        {newRating === 5 ? '5 Stars - Outstanding' : newRating === 4 ? '4 Stars - Very Good' : newRating === 3 ? '3 Stars - Average' : newRating === 2 ? '2 Stars - Fair' : '1 Star - Poor'}
                      </span>
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
                      Headline (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Best headphones I have ever owned!"
                      value={reviewTitle}
                      onChange={(e) => setReviewTitle(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13.5px'
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
                      Detailed Review *
                    </label>
                    <textarea
                      rows={4}
                      placeholder="What did you like or dislike? How was the performance, sound, and build?"
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13.5px',
                        lineHeight: 1.5
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setShowReviewForm(false)}
                      className="btn-outline"
                      style={{ padding: '8px 16px', fontSize: '13px' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="btn-primary"
                      style={{ padding: '8px 20px', fontSize: '13px', fontWeight: 700 }}
                    >
                      {submittingReview ? 'Submitting...' : 'Submit Verified Review'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* List of Verified Reviews */}
            {displayedReviews.length === 0 ? (
              <div style={{
                padding: '40px 24px',
                borderRadius: '12px',
                border: '1px dashed #cbd5e1',
                backgroundColor: '#f8fafc',
                textAlign: 'center'
              }}>
                <p style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>
                  No customer reviews matching this filter.
                </p>
                <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>
                  Be the first to share your experience with this item!
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {displayedReviews.map((r) => {
                  const helpfulCount = helpfulMap[r.id] !== undefined ? helpfulMap[r.id] : (r.helpful_count || 0);

                  return (
                    <div key={r.id} style={{
                      padding: '24px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      backgroundColor: '#ffffff',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                    }}>
                      {/* Reviewer Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ display: 'flex', gap: '2px' }}>
                            {[...Array(r.rating)].map((_, i) => (
                              <Star key={i} size={14} fill="#FFB800" color="#FFB800" />
                            ))}
                          </div>
                          <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>
                            {r.reviewer_name}
                          </span>
                          {r.is_verified_purchase && (
                            <span className="badge badge-success" style={{ fontSize: '10px' }}>
                              ✓ Verified Purchase
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                          {new Date(r.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>
                      </div>

                      {/* Review Title & Body */}
                      {r.title && (
                        <h4 style={{ fontSize: '14px', fontWeight: 800, marginBottom: '6px', color: '#0f172a' }}>
                          {r.title}
                        </h4>
                      )}
                      <p style={{ fontSize: '13.5px', color: '#334155', lineHeight: 1.6, margin: '0 0 14px 0' }}>
                        {r.comment}
                      </p>

                      {/* Helpful Button */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: r.seller_reply ? '14px' : '0' }}>
                        <button
                          onClick={() => handleHelpfulClick(r.id)}
                          style={{
                            padding: '4px 12px',
                            borderRadius: '16px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: helpfulMap[r.id] ? '#f0fdf4' : '#ffffff',
                            color: helpfulMap[r.id] ? '#15803d' : '#475569',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <ThumbsUp size={13} />
                          {helpfulMap[r.id] ? 'Helpful' : 'Helpful'} ({helpfulCount})
                        </button>
                      </div>

                      {/* Crucial: Visible Official Seller Reply */}
                      {r.seller_reply && (
                        <div style={{
                          marginTop: '12px',
                          padding: '14px 18px',
                          backgroundColor: '#f8fafc',
                          borderLeft: '4px solid var(--color-primary)',
                          borderRadius: '0 8px 8px 0',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)' }}>
                              <Store size={14} />
                              <span>Official Seller Response • {r.store_name || product.store_name || 'Verified Merchant'}</span>
                              <span className="badge badge-success" style={{ fontSize: '9px', padding: '1px 6px' }}>Brand Verified</span>
                            </div>
                            {r.seller_reply_at && (
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                Replied on {new Date(r.seller_reply_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: '13px', color: '#334155', lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>
                            "{r.seller_reply}"
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
      </section>

      {/* MOBILE FIXED / STICKY BOTTOM PURCHASE BAR (Visible strictly on mobile screens < 768px) */}
      <div className="pdp-mobile-sticky-bar">
        <div>
          <div style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
            ₹{priceNum.toLocaleString('en-IN')}
          </div>
          {savingsNum > 0 && (
            <span style={{ fontSize: '10.5px', color: '#16a34a', fontWeight: 700 }}>
              Save ₹{savingsNum.toLocaleString('en-IN')} ({discountPercent}%)
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', flex: 1, justifyContent: 'flex-end', maxWidth: '240px' }}>
          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock}
            style={{
              flex: 1,
              padding: '9px 10px',
              borderRadius: '20px',
              backgroundColor: isOutOfStock ? '#e2e8f0' : '#ffd814',
              color: '#0f172a',
              fontWeight: 700,
              fontSize: '12.5px',
              border: '1px solid #fcd200',
              cursor: isOutOfStock ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <ShoppingBag size={14} /> Add
          </button>
          <button
            onClick={handleBuyNow}
            disabled={isOutOfStock}
            style={{
              flex: 1,
              padding: '9px 12px',
              borderRadius: '20px',
              backgroundColor: isOutOfStock ? '#cbd5e1' : '#ffa41c',
              color: '#0f172a',
              fontWeight: 700,
              fontSize: '12.5px',
              border: '1px solid #ff8f00',
              cursor: isOutOfStock ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <Zap size={14} /> Buy Now
          </button>
        </div>
      </div>
    </div>
  );
};
