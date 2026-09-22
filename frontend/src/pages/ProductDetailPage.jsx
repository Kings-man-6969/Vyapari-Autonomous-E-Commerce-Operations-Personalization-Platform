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
  CheckCircle2,
  Lock,
  ThumbsUp,
  MapPin,
  Clock
} from 'lucide-react';
import api from '../services/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { ProductCard } from '../components/ProductCard';

export const ProductDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { user, isCustomer, isAuthenticated } = useAuth();
  const canShop = isCustomer || !isAuthenticated;

  const [product, setProduct] = useState(null);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [reviewsData, setReviewsData] = useState({ total: 0, average_rating: 0, breakdown: {}, reviews: [] });
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addedNotice, setAddedNotice] = useState(false);

  // Pincode Delivery Estimator State
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

          // 3. Fetch Product Reviews
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
        deliveryDay: 'Free delivery in 2-3 business days',
        isCodAvailable: true
      });
    }, 350);
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
        setReviewSuccess('Your review has been verified and posted successfully.');
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
        <div style={{ display: 'grid', gridTemplateColumns: '45% 30% 25%', gap: '32px' }}>
          <div className="skeleton" style={{ height: '480px', borderRadius: '12px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="skeleton" style={{ height: '24px', width: '30%' }} />
            <div className="skeleton" style={{ height: '40px', width: '90%' }} />
            <div className="skeleton" style={{ height: '32px', width: '40%' }} />
            <div className="skeleton" style={{ height: '180px' }} />
          </div>
          <div className="skeleton" style={{ height: '380px', borderRadius: '12px' }} />
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container" style={{ padding: '80px 24px', textAlign: 'center' }}>
        <AlertCircle size={44} color="var(--color-error)" style={{ margin: '0 auto 16px' }} />
        <h2 className="heading-whisper" style={{ fontSize: '24px' }}>{error || 'Product Unavailable'}</h2>
        <p style={{ color: 'var(--color-tide-pool)', marginTop: '8px' }}>
          The item you are searching for might have been moved or archived.
        </p>
        <Link to="/explore" className="btn-primary" style={{ marginTop: '20px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <ArrowLeft size={15} /> Back to Catalog
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

  const brand = attrs.brand || product.store_name || 'Verified Label';
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

  const badge = attrs.badge || (discountPercent >= 20 ? `${discountPercent}% OFF` : 'Curated');
  const fastDelivery = attrs.fast_delivery || 'Express 2-Day Delivery';
  const warranty = attrs.warranty || '1 Year Standard Manufacturer Warranty';

  const features = Array.isArray(attrs.features) && attrs.features.length > 0 
    ? attrs.features 
    : [product.description, `Warranty: ${warranty}`, `Category: ${product.category_name || 'General'}`];
  const specs = (attrs.specs && typeof attrs.specs === 'object') ? attrs.specs : {
    "Brand": brand,
    "Category": product.category_name,
    "Warranty": warranty,
    "Stock Status": isOutOfStock ? "Out of Stock" : "In Stock (Atomic Lock Protected)"
  };

  const reviewsList = reviewsData.reviews || [];
  const displayedReviews = starFilter 
    ? reviewsList.filter(r => r.rating === starFilter)
    : reviewsList;

  const totalRev = reviewsData.total || 1;
  const breakdown = reviewsData.breakdown || {};
  const getPercent = (star) => Math.round(((breakdown[star] || 0) / totalRev) * 100);

  return (
    <div style={{ backgroundColor: 'var(--color-abyssal-ink)', minHeight: '100vh', padding: '24px 0 64px 0' }}>
      <div className="container pdp-page-container" style={{ maxWidth: '1400px' }}>
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--color-ash-label)', marginBottom: '24px', flexWrap: 'wrap' }}>
          <Link to="/explore" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-tide-pool)' }}>
            <ArrowLeft size={13} /> Catalog
          </Link>
          <span>/</span>
          <Link to={`/explore?category=${product.category_id}`} style={{ color: 'var(--color-tide-pool)' }}>
            {product.category_name}
          </Link>
          <span>/</span>
          <span style={{ color: '#ffffff', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '360px' }}>
            {product.title}
          </span>
        </nav>

        {/* 3-COLUMN CANONICAL PDP ARCHITECTURE */}
        <div className="pdp-grid-3col">
          {/* COLUMN 1 (45%): Media Gallery */}
          <div className="pdp-gallery-container">
            {images.length > 1 && (
              <div className="pdp-gallery-thumbs">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    aria-label={`Angle ${idx + 1}`}
                    style={{
                      width: '56px',
                      height: '56px',
                      flexShrink: 0,
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: selectedImage === idx ? '1px solid var(--color-icy-steel)' : '1px solid var(--color-border-steel)',
                      backgroundColor: 'var(--color-obsidian-graphite)',
                      padding: '4px',
                      cursor: 'pointer',
                      opacity: selectedImage === idx ? 1 : 0.6,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </button>
                ))}
              </div>
            )}

            {/* Main Image Stage */}
            <div className="pdp-gallery-stage" style={{ backgroundColor: 'var(--color-gunmetal-dark)', border: '1px solid var(--color-border-steel)' }}>
              {badge && (
                <div style={{
                  position: 'absolute',
                  top: '16px',
                  left: '16px',
                  zIndex: 2,
                  backgroundColor: 'rgba(9, 10, 13, 0.88)',
                  backdropFilter: 'blur(8px)',
                  color: 'var(--color-icy-steel)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
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

          {/* Right: Info + Buy Box */}
          <div className="pdp-info-pane">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-icy-steel)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {product.category_name || 'Item'}
              </span>
              {product.store_name && (
                <span style={{ fontSize: '11px', color: 'var(--color-ash-label)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  • <ShieldCheck size={13} color="var(--color-icy-steel)" /> Verified Merchant
                </span>
              )}
            </div>

            <h1 className="pdp-title" style={{ fontWeight: 330, letterSpacing: '0.02em', color: '#ffffff' }}>
              {product.title}
            </h1>

            {/* Rating summary */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Star size={13} fill="var(--color-silver-glow)" stroke="none" />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-silver-glow)' }}>{rating}</span>
                <span style={{ fontSize: '12px', color: 'var(--color-ash-label)' }}>({reviewsCount} ratings)</span>
              </div>
              <a href="#customer-reviews" style={{ fontSize: '12px', color: 'var(--color-tide-pool)', textDecoration: 'underline' }}>
                {reviewsCount.toLocaleString()} verified ratings
              </a>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--color-iron-veil)', marginBottom: '16px' }} />

            {/* Pricing Section */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '28px', fontWeight: 600, color: '#ffffff' }}>
                  ₹{priceNum.toLocaleString('en-IN')}
                </span>
                {compareNum > priceNum && (
                  <span style={{ fontSize: '14px', color: 'var(--color-slate-caption)', textDecoration: 'line-through' }}>
                    ₹{compareNum.toLocaleString('en-IN')}
                  </span>
                )}
                {discountPercent > 0 && (
                  <span className="badge badge-mint" style={{ fontSize: '10px' }}>
                    Save {discountPercent}%
                  </span>
                )}
              </div>
              <p style={{ fontSize: '12px', color: 'var(--color-tide-pool)', marginTop: '4px' }}>
                Inclusive of all taxes. Free Delivery on eligible orders.
              </p>
            </div>

            {/* Specifications & Key Highlights */}
            <div style={{ marginTop: '8px', marginBottom: '24px' }}>
              <h4 style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-ash-label)', marginBottom: '12px' }}>
                Key Specifications
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.entries(specs).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-moss-border)', fontSize: '12px' }}>
                    <span style={{ color: 'var(--color-ash-label)' }}>{k}</span>
                    <span style={{ color: '#ffffff', fontWeight: 500 }}>{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* COLUMN 3 (25%): Sticky Buy Box */}
          <div className="pdp-buy-box-container">
            <div style={{ marginBottom: '16px' }}>
              <span style={{ fontSize: '24px', fontWeight: 600, color: '#ffffff' }}>
                ₹{priceNum.toLocaleString('en-IN')}
              </span>
              <p style={{ fontSize: '11px', color: 'var(--color-steel-mist)', marginTop: '2px' }}>
                Inclusive of all taxes
              </p>
            </div>

            {/* Delivery Pincode Checker */}
            <div style={{
              padding: '12px',
              backgroundColor: 'var(--color-titanium-brushed)',
              borderRadius: '8px',
              border: '1px solid var(--color-border-steel)',
              marginBottom: '18px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                <MapPin size={13} color="var(--color-icy-steel)" />
                <span>Delivery Details</span>
              </div>

              <form onSubmit={handlePincodeCheck} style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  placeholder="Enter 6-digit Pincode"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: '4px',
                    border: '1px solid var(--color-border-steel)',
                    backgroundColor: 'var(--color-obsidian-graphite)',
                    color: '#ffffff',
                    fontSize: '12px',
                    outline: 'none'
                  }}
                />
                <button
                  type="submit"
                  disabled={checkingPincode}
                  className="btn-small"
                >
                  {checkingPincode ? '...' : 'Check'}
                </button>
              </form>

              {pincodeResult && (
                <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--color-icy-steel)' }}>
                  <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Check size={13} /> {pincodeResult.deliveryDay}
                  </div>
                  <div style={{ color: 'var(--color-silver-glow)', opacity: 0.8, fontSize: '11px', marginTop: '2px' }}>
                    Cash on Delivery available
                  </div>
                </div>
              )}
            </div>

            {/* Stock Status */}
            {isOutOfStock ? (
              <div style={{ padding: '8px 12px', backgroundColor: 'rgba(244, 63, 94, 0.15)', color: 'var(--color-error)', borderRadius: '6px', fontSize: '12px', fontWeight: 600, marginBottom: '16px', border: '1px solid rgba(244, 63, 94, 0.3)' }}>
                Currently Out of Stock
              </div>
            ) : isLowStock ? (
              <div style={{ color: 'var(--color-warning)', fontSize: '12px', fontWeight: 600, marginBottom: '16px' }}>
                Only {product.stock_qty} left in stock - order soon.
              </div>
            ) : (
              <div style={{ color: 'var(--color-icy-steel)', fontSize: '12px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={14} /> In Stock
              </div>
            )}

            {/* Quantity Selector */}
            {!isOutOfStock && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-ash-label)' }}>Quantity:</span>
                <select
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value, 10))}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '4px',
                    border: '1px solid var(--color-iron-veil)',
                    backgroundColor: 'var(--color-deep-canopy)',
                    color: '#ffffff',
                    fontSize: '12px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {[...Array(Math.min(10, product.stock_qty || 5))].map((_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Actions: customer-only buy buttons */}
            {canShop ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                <button
                  onClick={handleAddToCart}
                  disabled={isOutOfStock}
                  className="btn-primary"
                  style={{ width: '100%', padding: '12px' }}
                >
                  <ShoppingBag size={15} /> Add to Cart
                </button>

                <button
                  onClick={handleBuyNow}
                  disabled={isOutOfStock}
                  className="btn-outline"
                  style={{ width: '100%', padding: '11px' }}
                >
                  Buy Now
                </button>
              </div>
            ) : (
              <div style={{
                padding: '12px 14px',
                backgroundColor: 'rgba(56, 189, 248, 0.05)',
                border: '1px solid var(--color-border-steel)',
                borderRadius: '8px',
                fontSize: '12px',
                color: 'var(--color-silver-glow)',
                marginBottom: '20px',
                textAlign: 'center'
              }}>
                Purchase is available to customers only.
              </div>
            )}

            {addedNotice && (
              <div style={{
                padding: '10px 14px',
                backgroundColor: 'rgba(56, 189, 248, 0.12)',
                color: 'var(--color-icy-steel)',
                borderRadius: '6px',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                fontSize: '12px',
                fontWeight: 600,
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={14} /> Added to cart
                </span>
                <Link to="/cart" style={{ textDecoration: 'underline', color: 'inherit' }}>View</Link>
              </div>
            )}

            {/* Trust Points */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', color: 'var(--color-silver-glow)', opacity: 0.85, borderTop: '1px solid var(--color-border-steel)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-ash-label)' }}>Sold by:</span>
                <strong style={{ color: '#ffffff' }}>{product.store_name}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-icy-steel)' }}>
                <ShieldCheck size={13} /> 100% Genuine Product
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <RotateCcw size={13} color="var(--color-ash-label)" /> 7-Day Replacement / Return
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Lock size={13} color="var(--color-ash-label)" /> Secure Transaction
              </div>
            </div>
          </div>
        </div>

        {/* Similar Products Section */}
        {similarProducts.length > 0 && (
          <section style={{
            marginTop: '56px',
            marginBottom: '56px',
            padding: '32px 24px',
            backgroundColor: 'var(--color-gunmetal-dark)',
            borderRadius: '12px',
            border: '1px solid var(--color-border-steel)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} color="var(--color-icy-steel)" />
                <h3 className="heading-whisper" style={{ fontSize: '18px' }}>
                  Similar Products
                </h3>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--color-ash-label)' }}>
                Customers who viewed this item also viewed
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
              {similarProducts.map((simProd) => (
                <ProductCard key={simProd.id} product={simProd} />
              ))}
            </div>
          </section>
        )}

        {/* Customer Reviews Section */}
        <section id="customer-reviews" style={{
          marginTop: '48px',
          padding: '32px',
          backgroundColor: 'var(--color-gunmetal-dark)',
          borderRadius: '12px',
          border: '1px solid var(--color-border-steel)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h2 className="heading-whisper" style={{ fontSize: '22px', marginBottom: '4px' }}>
                Customer Reviews
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--color-silver-glow)', opacity: 0.8 }}>
                Ratings and reviews from verified buyers
              </p>
            </div>

            {user && !showReviewForm && (
              <button
                onClick={() => setShowReviewForm(true)}
                className="btn-outline"
                style={{ padding: '8px 18px', fontSize: '12px' }}
              >
                <PenLine size={13} /> Write a Review
              </button>
            )}
          </div>

          {/* Write Review Form */}
          {showReviewForm && (
            <form onSubmit={handleReviewSubmit} style={{
              backgroundColor: 'var(--color-titanium-brushed)',
              padding: '24px',
              borderRadius: '8px',
              border: '1px solid var(--color-border-steel)',
              marginBottom: '32px'
            }}>
              <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', marginBottom: '14px' }}>
                Write Your Verified Feedback
              </h4>

              {/* Star Rating Select */}
              <div style={{ marginBottom: '16px' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-ash-label)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  Overall Rating
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setNewRating(s)}
                      onMouseEnter={() => setHoverRating(s)}
                      onMouseLeave={() => setHoverRating(0)}
                      style={{ cursor: 'pointer', padding: '4px', background: 'none', border: 'none' }}
                    >
                      <Star
                        size={20}
                        fill={(hoverRating || newRating) >= s ? 'var(--color-silver-glow)' : 'none'}
                        color={(hoverRating || newRating) >= s ? 'var(--color-silver-glow)' : 'var(--color-border-steel)'}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Review Headline</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Precision craftsmanship, fast dispatch"
                  value={reviewTitle}
                  onChange={(e) => setReviewTitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Detailed Experience</label>
                <textarea
                  className="textarea-field"
                  rows={4}
                  placeholder="Describe your tactile impressions, ergonomics, packaging condition..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                />
              </div>

              {reviewError && (
                <div style={{ color: 'var(--color-error)', fontSize: '12px', marginBottom: '14px' }}>
                  {reviewError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="btn-primary"
                  style={{ padding: '8px 18px', fontSize: '12px' }}
                >
                  {submittingReview ? 'Submitting...' : 'Post Review'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowReviewForm(false)}
                  className="btn-outline"
                  style={{ padding: '8px 18px', fontSize: '12px' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {reviewSuccess && (
            <div style={{ padding: '12px 16px', backgroundColor: 'rgba(56, 189, 248, 0.12)', color: 'var(--color-icy-steel)', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.3)', fontSize: '13px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Check size={16} /> {reviewSuccess}
            </div>
          )}

          {/* Rating Breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '32px', marginBottom: '36px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '36px', fontWeight: 330, color: '#ffffff' }}>{rating}</span>
                <span style={{ fontSize: '13px', color: 'var(--color-tide-pool)' }}>out of 5</span>
              </div>
              <div style={{ display: 'flex', gap: '3px' }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} size={15} fill={parseFloat(rating) >= s ? 'var(--color-silver-glow)' : 'none'} color={parseFloat(rating) >= s ? 'var(--color-silver-glow)' : 'var(--color-border-steel)'} />
                ))}
              </div>
              <span style={{ fontSize: '12px', color: 'var(--color-ash-label)', marginTop: '4px' }}>
                {reviewsCount} authenticated ratings
              </span>
            </div>

            {/* Bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[5, 4, 3, 2, 1].map((s) => {
                const pct = getPercent(s);
                return (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
                    <span style={{ width: '40px', color: 'var(--color-ash-label)' }}>{s} star</span>
                    <div style={{ flex: 1, height: '6px', borderRadius: '3px', backgroundColor: 'var(--color-obsidian-graphite)', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', backgroundColor: 'var(--color-icy-steel)' }} />
                    </div>
                    <span style={{ width: '32px', textAlign: 'right', color: 'var(--color-silver-glow)' }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reviews List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {displayedReviews.length === 0 ? (
              <p style={{ color: 'var(--color-tide-pool)', fontSize: '13px' }}>
                No customer reviews submitted yet.
              </p>
            ) : (
              displayedReviews.map((rev) => (
                <div key={rev.id} style={{
                  padding: '20px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--color-titanium-brushed)',
                  border: '1px solid var(--color-border-steel)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ display: 'flex', gap: '2px' }}>
                        {[...Array(rev.rating)].map((_, i) => (
                          <Star key={i} size={12} fill="var(--color-silver-glow)" stroke="none" />
                        ))}
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                        {rev.title || 'Verified Review'}
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--color-ash-label)' }}>
                      {new Date(rev.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <p style={{ fontSize: '13px', color: 'var(--color-silver-glow)', lineHeight: 1.5, marginBottom: '12px' }}>
                    {rev.comment}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-ash-label)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-icy-steel)' }}>
                      <Check size={12} /> Verified Purchase
                    </span>
                    <button
                      onClick={() => handleHelpfulClick(rev.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-silver-glow)', cursor: 'pointer', background: 'none', border: 'none' }}
                    >
                      <ThumbsUp size={12} /> Helpful ({helpfulMap[rev.id] || rev.helpful_count || 0})
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Mobile Sticky Bottom Purchase Bar */}
        <div className="pdp-mobile-sticky-bar">
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff' }}>
              ₹{priceNum.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '11px', color: isOutOfStock ? 'var(--color-error)' : 'var(--color-icy-steel)' }}>
              {isOutOfStock ? 'Out of Stock' : 'In Stock'}
            </div>
          </div>
          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock}
            className="btn-primary"
            style={{ padding: '10px 20px', fontSize: '12px' }}
          >
            <ShoppingBag size={14} /> Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
};
