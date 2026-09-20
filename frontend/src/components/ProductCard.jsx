import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Star, Heart, Zap } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';

export const ProductCard = ({ product }) => {
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const inWish = isInWishlist(product.id);

  const images = Array.isArray(product.images) 
    ? product.images 
    : (typeof product.images === 'string' ? JSON.parse(product.images || '[]') : []);
  const mainImage = images[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80';

  const isOutOfStock = product.status === 'out_of_stock' || product.stock_qty <= 0;
  const isLowStock = !isOutOfStock && product.stock_qty <= 5;

  let attrs = {};
  try {
    attrs = typeof product.attributes === 'string' ? JSON.parse(product.attributes || '{}') : (product.attributes || {});
  } catch (e) {
    attrs = {};
  }

  const brand = attrs.brand || product.store_name || 'Verified Label';
  const rating = attrs.rating ? parseFloat(attrs.rating).toFixed(1) : (product.seller_rating > 0 ? parseFloat(product.seller_rating).toFixed(1) : '4.5');
  const reviewsCount = attrs.reviews_count || (rating ? Math.floor(parseFloat(rating) * 160) : 120);

  const priceNum = parseFloat(product.price);
  const compareNum = product.compare_at_price ? parseFloat(product.compare_at_price) : 0;
  const discountPercent = compareNum > priceNum ? Math.round(((compareNum - priceNum) / compareNum) * 100) : 0;

  const badge = attrs.badge || (discountPercent >= 20 ? `${discountPercent}% OFF` : (parseFloat(rating) >= 4.8 ? 'Top Rated' : null));
  const fastDelivery = attrs.fast_delivery || 'FREE Delivery in 2 Days';

  const handleWishlistClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product);
  };

  return (
    <div className="product-card" style={{ 
      position: 'relative', 
      display: 'flex', 
      flexDirection: 'column', 
      borderRadius: 'var(--radius-md)', 
      overflow: 'hidden', 
      border: '1px solid var(--color-border-card)', 
      backgroundColor: '#ffffff',
      transition: 'box-shadow var(--transition-normal), transform var(--transition-fast)'
    }}>
      {/* Wishlist Button */}
      <button
        onClick={handleWishlistClick}
        aria-label={inWish ? 'Remove from wishlist' : 'Add to wishlist'}
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          zIndex: 3,
          width: '34px',
          height: '34px',
          borderRadius: '50%',
          backgroundColor: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
          border: '1px solid rgba(0,0,0,0.04)',
          cursor: 'pointer',
          transition: 'transform 0.15s ease'
        }}
      >
        <Heart 
          size={16} 
          color={inWish ? 'var(--color-primary)' : 'var(--color-text-secondary)'} 
          fill={inWish ? 'var(--color-primary)' : 'none'} 
        />
      </button>

      {/* Badge (Top-Left) */}
      {badge && (
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          zIndex: 3,
          backgroundColor: badge.includes('OFF') ? '#dc2626' : (badge.includes('Choice') ? '#0f172a' : 'var(--color-primary)'),
          color: '#ffffff',
          padding: '3px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.3px',
          textTransform: 'uppercase',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          {badge}
        </div>
      )}

      {/* Image Container with Subtle Background */}
      <Link to={`/products/${product.id}`} style={{ 
        display: 'block', 
        position: 'relative', 
        overflow: 'hidden', 
        paddingTop: '95%',
        backgroundColor: '#f8fafc'
      }}>
        <img
          src={mainImage}
          alt={product.title}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            padding: '12px',
            transition: 'transform 0.3s ease'
          }}
          onError={(e) => {
            e.target.src = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80';
          }}
        />
        {isOutOfStock && (
          <div style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            color: '#ffffff',
            padding: '3px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 600
          }}>
            Out of Stock
          </div>
        )}
        {isLowStock && (
          <div style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            backgroundColor: '#d97706',
            color: '#ffffff',
            padding: '3px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 600
          }}>
            Only {product.stock_qty} left
          </div>
        )}
      </Link>

      {/* Body Content */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        {/* Brand & Store */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ 
            fontSize: '11px', 
            textTransform: 'uppercase', 
            letterSpacing: '0.5px',
            color: 'var(--color-text-secondary)', 
            fontWeight: 700 
          }}>
            {brand}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            {product.category_name}
          </span>
        </div>

        {/* Product Title */}
        <Link to={`/products/${product.id}`} style={{
          fontSize: '14px',
          fontWeight: 600,
          lineHeight: '1.4',
          marginBottom: '8px',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          color: 'var(--color-text-primary)'
        }}>
          {product.title}
        </Link>

        {/* Star Rating & Review Count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '3px', 
            backgroundColor: '#fef3c7', 
            padding: '2px 6px', 
            borderRadius: '4px', 
            fontSize: '11px', 
            fontWeight: 700,
            color: '#b45309'
          }}>
            <Star size={11} fill="#b45309" color="#b45309" />
            <span>{rating}</span>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
            ({reviewsCount.toLocaleString()})
          </span>
        </div>

        {/* Fast Delivery Pill */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '4px', 
          fontSize: '11px', 
          color: '#15803d', 
          fontWeight: 600,
          marginBottom: '12px'
        }}>
          <Zap size={12} fill="#15803d" />
          <span>{fastDelivery}</span>
        </div>

        {/* Price & CTA Row */}
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '17px', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                ₹{priceNum.toLocaleString('en-IN')}
              </span>
              {compareNum > priceNum && (
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', textDecoration: 'line-through' }}>
                  ₹{compareNum.toLocaleString('en-IN')}
                </span>
              )}
            </div>
            {discountPercent > 0 && (
              <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700 }}>
                {discountPercent}% savings
              </span>
            )}
          </div>

          <button
            onClick={() => addToCart(product.id, 1)}
            disabled={isOutOfStock}
            title={isOutOfStock ? 'Item out of stock' : 'Add to cart'}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              backgroundColor: isOutOfStock ? 'var(--color-surface-subtle)' : 'var(--color-primary)',
              color: isOutOfStock ? 'var(--color-text-muted)' : '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isOutOfStock ? 'not-allowed' : 'pointer',
              border: 'none',
              transition: 'background-color 0.2s ease, transform 0.1s ease'
            }}
          >
            <ShoppingBag size={17} />
          </button>
        </div>
      </div>
    </div>
  );
};
