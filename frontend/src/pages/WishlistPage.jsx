import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingBag, ArrowRight } from 'lucide-react';
import { useWishlist } from '../context/WishlistContext';
import { ProductCard } from '../components/ProductCard';

export const WishlistPage = () => {
  const { wishlistItems, loading } = useWishlist();

  return (
    <div className="container" style={{ padding: '40px 24px', minHeight: '60vh' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '28px',
        borderBottom: '1px solid var(--color-border-card)',
        paddingBottom: '16px'
      }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            My Wishlist
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
            {wishlistItems.length} {wishlistItems.length === 1 ? 'item saved' : 'items saved'} for later
          </p>
        </div>
        <Link to="/explore" className="btn-outline" style={{ fontSize: 'var(--font-size-xs)' }}>
          Continue Shopping
        </Link>
      </div>

      {loading ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '24px'
        }}>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} style={{ height: '360px' }} className="skeleton" />
          ))}
        </div>
      ) : wishlistItems.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '80px 24px',
          background: 'var(--color-surface-subtle)',
          borderRadius: 'var(--radius-lg)',
          border: '1px dashed var(--color-border-subtle)',
          maxWidth: '560px',
          margin: '40px auto'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: 'var(--shadow-xs)'
          }}>
            <Heart size={32} color="var(--color-primary)" />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>
            Your wishlist is empty
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: '24px', lineHeight: 1.6 }}>
            Explore our curated catalog and tap the heart icon on any product to save it here for easy checkout later.
          </p>
          <Link to="/explore" className="btn-primary">
            <span>Explore Marketplace</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '24px'
        }}>
          {wishlistItems.map((item) => (
            <ProductCard
              key={item.id || item.product_id}
              product={{
                id: item.product_id || item.id,
                title: item.title,
                price: item.price,
                compare_at_price: item.compare_at_price,
                images: item.images,
                status: item.inventory_count > 0 ? 'active' : 'out_of_stock',
                stock_qty: item.inventory_count || 10
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default WishlistPage;
