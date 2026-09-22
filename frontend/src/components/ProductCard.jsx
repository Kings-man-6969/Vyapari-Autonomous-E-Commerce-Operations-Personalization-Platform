import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Star, Heart } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';

export const ProductCard = ({ product }) => {
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { isCustomer, isAuthenticated } = useAuth();
  // Only customers (not sellers or admins) can interact with cart/wishlist
  const canShop = isCustomer || !isAuthenticated;
  const inWish = isInWishlist(product.id);

  const images = Array.isArray(product.images) 
    ? product.images 
    : (typeof product.images === 'string' ? JSON.parse(product.images || '[]') : []);
  const mainImage = images[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80';

  const stock = product.inventory_count !== undefined ? product.inventory_count : (product.stock_qty !== undefined ? product.stock_qty : 0);
  const isOutOfStock = product.status === 'out_of_stock' || stock <= 0;
  const isLowStock = !isOutOfStock && stock <= 5;

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

  const badge = attrs.badge || (discountPercent >= 20 ? `${discountPercent}% OFF` : (parseFloat(rating) >= 4.8 ? 'Curated' : null));

  const handleWishlistClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product);
  };

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isOutOfStock) {
      addToCart(product.id, 1);
    }
  };

  return (
    <div className="product-card" style={{ 
      position: 'relative', 
      display: 'flex', 
      flexDirection: 'column', 
      borderRadius: '12px', 
      overflow: 'hidden', 
      border: '1px solid var(--color-border-steel)', 
      backgroundColor: 'var(--color-gunmetal-dark)',
      boxShadow: 'var(--shadow-card)',
      transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>
      {/* Wishlist Button — customers only */}
      {canShop && (
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
            backgroundColor: 'rgba(18, 21, 27, 0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--color-border-steel)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <Heart 
            size={15} 
            color={inWish ? 'var(--color-pure-white)' : 'var(--color-steel-mist)'} 
            fill={inWish ? '#ffffff' : 'none'} 
          />
        </button>
      )}

      {/* Badge (Top-Left) */}
      {badge && (
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          zIndex: 3,
          backgroundColor: 'rgba(9, 10, 13, 0.88)',
          backdropFilter: 'blur(8px)',
          color: 'var(--color-brushed-aluminum)',
          border: '1px solid var(--color-border-chrome)',
          padding: '3px 8px',
          borderRadius: '4px',
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase'
        }}>
          {badge}
        </div>
      )}

      {/* Image Container with Dark Obsidian Backdrop */}
      <Link to={`/products/${product.id}`} style={{ 
        display: 'block', 
        position: 'relative', 
        overflow: 'hidden', 
        paddingTop: '92%',
        backgroundColor: 'var(--color-obsidian-graphite)'
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
            padding: '16px',
            transition: 'transform 0.4s ease'
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
            backgroundColor: 'rgba(244, 63, 94, 0.18)',
            color: 'var(--color-error)',
            border: '1px solid rgba(244, 63, 94, 0.35)',
            padding: '3px 8px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }}>
            Out of Stock
          </div>
        )}
        {isLowStock && (
          <div style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            backgroundColor: 'rgba(245, 158, 11, 0.18)',
            color: 'var(--color-warning)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            padding: '3px 8px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }}>
            Low Stock ({stock} left)
          </div>
        )}
      </Link>

      {/* Card Content Details */}
      <div className="card-content" style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        {/* Brand & Rating Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-slate-caption)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {brand}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--color-brushed-aluminum)' }}>
            <Star size={12} fill="var(--color-silver-glow)" stroke="none" />
            <span style={{ fontWeight: 600 }}>{rating}</span>
            <span style={{ color: 'var(--color-slate-caption)', fontSize: '10px' }}>({reviewsCount})</span>
          </div>
        </div>

        {/* Title */}
        <Link to={`/products/${product.id}`} style={{ textDecoration: 'none' }}>
          <h3 className="card-title" style={{
            fontSize: '14px',
            fontWeight: 450,
            color: '#ffffff',
            lineHeight: 1.4,
            marginBottom: '12px',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minHeight: '39px'
          }}>
            {product.title}
          </h3>
        </Link>

        {/* Price & Action Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--color-border-steel)' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span className="card-price" style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff' }}>
                ₹{priceNum.toLocaleString('en-IN')}
              </span>
              {compareNum > priceNum && (
                <span style={{ fontSize: '11px', color: 'var(--color-slate-caption)', textDecoration: 'line-through' }}>
                  ₹{compareNum.toLocaleString('en-IN')}
                </span>
              )}
            </div>
            {discountPercent > 0 && (
              <span style={{ fontSize: '10px', color: 'var(--color-icy-steel)', fontWeight: 600 }}>
                Save {discountPercent}%
              </span>
            )}
          </div>

          {/* Add to cart — customers only */}
          {canShop && (
            <button
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              aria-label="Add to cart"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: isOutOfStock ? 'transparent' : '#ffffff',
                color: '#090a0d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                border: isOutOfStock ? '1px solid var(--color-border-steel)' : 'none',
                boxShadow: isOutOfStock ? 'none' : '0 2px 10px rgba(255, 255, 255, 0.15)',
                opacity: isOutOfStock ? 0.4 : 1,
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                if (!isOutOfStock) {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isOutOfStock) {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                  e.currentTarget.style.transform = 'scale(1)';
                }
              }}
            >
              <ShoppingBag size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
