import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

/* ─── DESIGN.MD — ProductCard (Transactional Track) ───
   card-pricing: white bg, hairline border, rounded-lg 12px, Level-3 stacked shadows
   button-primary-pill: solid black pill
   Category eyebrow: eyebrow-cap style
   Wishlist: pill-tag-mint (aloe) when active
─────────────────────────────────────────────────────── */

const fmt = n => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0 });

export const CATEGORY_DATA = {
  'Electronics':    { emoji: '⚡', color: '#52525b' },
  'Clothing':       { emoji: '👗', color: '#52525b' },
  'Books':          { emoji: '📚', color: '#52525b' },
  'Home & Kitchen': { emoji: '🏠', color: '#52525b' },
  'Sports':         { emoji: '🏃', color: '#52525b' },
};

function Stars({ rating }) {
  const r = Math.round(rating || 0);
  return (
    <span style={{ display: 'flex', gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ color: i <= r ? '#d97706' : '#d4d4d8', fontSize: 12 }}>★</span>
      ))}
    </span>
  );
}

export function ProductCard({ product, onAddToCart, onWishlist, inWishlist }) {
  const [hovered, setHovered] = useState(false);
  const navigate = useNavigate();
  const cat = CATEGORY_DATA[product.category] || { emoji: '📦', color: '#71717a' };
  const stock = product.stock ?? product.quantity ?? 0;

  return (
    <div
      className="c-product-card"
      style={{
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: hovered
          ? '0 16px 16px rgba(0,0,0,0.1), 0 8px 8px rgba(0,0,0,0.08), 0 4px 4px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.08)'
          : '0 8px 8px rgba(0,0,0,0.08), 0 4px 4px rgba(0,0,0,0.07), 0 2px 2px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.06)',
        cursor: 'pointer',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => navigate(`/shop/product/${product.product_id}`)}
    >
      {/* Image area — card-photo-frame style on product images */}
      <div style={{
        position: 'relative',
        height: 200,
        background: '#f5f5f5',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {product.image_url && product.image_url.startsWith('http') ? (
          <img
            src={product.image_url}
            alt={product.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span style={{
            fontSize: '3.5rem',
            transform: hovered ? 'scale(1.05) translateY(-3px)' : 'scale(1) translateY(0)',
            transition: 'transform 0.3s cubic-bezier(0.16,1,0.3,1)',
            display: 'block',
            userSelect: 'none',
          }}>{cat.emoji}</span>
        )}

        {/* Wishlist button — pill-tag-mint when active */}
        <button
          onClick={e => { e.stopPropagation(); onWishlist && onWishlist(product); }}
          style={{
            position: 'absolute', top: 10, right: 10,
            padding: inWishlist ? '4px 10px' : '0',
            width: inWishlist ? 'auto' : 32,
            height: 32,
            borderRadius: 9999,
            background: inWishlist ? '#c1fbd4' : 'rgba(255,255,255,0.9)',
            border: '1px solid rgba(0,0,0,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#000000',
            transition: 'all 0.2s',
            zIndex: 10,
            fontFamily: "'Inter', Helvetica, Arial, sans-serif",
            fontSize: inWishlist ? 12 : 14, fontWeight: 400,
            letterSpacing: '0.5px',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = inWishlist ? '#b0f0c8' : 'rgba(255,255,255,1)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = inWishlist ? '#c1fbd4' : 'rgba(255,255,255,0.9)'; }}
        >
          {inWishlist ? '♥' : '♡'}
        </button>

        {/* Stock badges — pill-tag style */}
        {stock <= 0 && (
          <div style={{
            position: 'absolute', bottom: 10, left: 10,
            background: '#fee2e2', color: '#991b1b',
            fontSize: 10, fontWeight: 500,
            padding: '3px 10px', borderRadius: 9999,
            letterSpacing: '0.5px', textTransform: 'uppercase',
            fontFeatureSettings: '"ss03"',
          }}>Out of Stock</div>
        )}
        {stock > 0 && stock <= 10 && (
          <div style={{
            position: 'absolute', bottom: 10, left: 10,
            background: '#fef3c7', color: '#92400e',
            fontSize: 10, fontWeight: 500,
            padding: '3px 10px', borderRadius: 9999,
            letterSpacing: '0.5px', textTransform: 'uppercase',
            fontFeatureSettings: '"ss03"',
          }}>Only {stock} left</div>
        )}
      </div>

      {/* Body — card-pricing layout */}
      <div className="c-product-body">
        {/* Category eyebrow-cap */}
        <div className="c-product-category">{product.category}</div>

        {/* Product name */}
        <div className="c-product-name">{product.name}</div>

        {/* Stars */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
          <Stars rating={product.avg_rating} />
          <span style={{
            fontSize: 12, color: '#71717a',
            fontFeatureSettings: '"ss03"',
            fontFamily: "'Inter', Helvetica, Arial, sans-serif",
          }}>
            ({product.review_count || 0})
          </span>
        </div>

        {/* Price + Add to Cart */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span className="c-product-price">{fmt(product.price)}</span>
          <button
            className="c-btn-cart"
            onClick={e => { e.stopPropagation(); onAddToCart && onAddToCart(product); }}
            disabled={stock <= 0}
            style={{
              width: 'auto', flex: 1, maxWidth: 110,
              padding: '9px 14px', fontSize: 14,
              opacity: stock <= 0 ? 0.4 : 1,
              cursor: stock <= 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {stock <= 0 ? 'Sold out' : '+ Cart'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProductSkeleton() {
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e4e4e7',
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: '0 2px 2px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
    }}>
      <div style={{ height: 200, background: '#f5f5f5', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(90deg, #f5f5f5 25%, #ebebeb 50%, #f5f5f5 75%)',
          backgroundSize: '800px 100%',
          animation: 'shimmer 1.5s infinite',
        }} />
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ height: 10, width: '35%', background: '#e4e4e7', borderRadius: 4, marginBottom: 10 }} />
        <div style={{ height: 16, background: '#e4e4e7', borderRadius: 4, marginBottom: 8 }} />
        <div style={{ height: 14, width: '60%', background: '#e4e4e7', borderRadius: 4, marginBottom: 16 }} />
        <div style={{ height: 40, background: '#e4e4e7', borderRadius: 9999 }} />
      </div>
    </div>
  );
}
