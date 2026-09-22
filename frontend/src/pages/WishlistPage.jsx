import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, ArrowRight } from 'lucide-react';
import { useWishlist } from '../context/WishlistContext';
import { ProductCard } from '../components/ProductCard';

export const WishlistPage = () => {
  const { wishlistItems, loading } = useWishlist();

  return (
    <div style={{ backgroundColor: 'var(--color-obsidian-graphite)', minHeight: 'calc(100vh - 76px)', padding: '52px 24px 80px' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '36px',
          borderBottom: '1px solid var(--color-border-steel)',
          paddingBottom: '20px',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <h1 className="heading-whisper" style={{ fontSize: '32px', color: '#ffffff', letterSpacing: '0.02em', margin: 0 }}>
              My Wishlist
            </h1>
            <p style={{ color: 'var(--color-silver-glow)', opacity: 0.75, fontSize: '13px', marginTop: '6px' }}>
              {wishlistItems.length} {wishlistItems.length === 1 ? 'item bookmarked' : 'items bookmarked'} for future allocation
            </p>
          </div>
          <Link 
            to="/explore" 
            className="btn-outline"
            style={{ padding: '8px 20px', fontSize: '12px' }}
          >
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
              <div key={n} style={{ height: '360px', backgroundColor: 'var(--color-gunmetal-dark)', borderRadius: '14px', border: '1px solid var(--color-border-steel)' }} className="skeleton" />
            ))}
          </div>
        ) : wishlistItems.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '80px 24px',
            backgroundColor: 'var(--color-gunmetal-dark)',
            borderRadius: '16px',
            border: '1px dashed var(--color-border-steel)',
            maxWidth: '560px',
            margin: '40px auto'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-titanium-brushed)',
              border: '1px solid var(--color-border-steel)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              color: 'var(--color-icy-steel)'
            }}>
              <Heart size={28} />
            </div>
            <h2 className="heading-whisper" style={{ fontSize: '22px', color: '#ffffff', marginBottom: '8px' }}>
              Your wishlist is empty
            </h2>
            <p style={{ color: 'var(--color-silver-glow)', opacity: 0.75, fontSize: '13px', marginBottom: '24px', lineHeight: 1.6 }}>
              Explore our curated catalog and tap the heart icon on any listing to bookmark it for rapid checkout.
            </p>
            <Link 
              to="/explore" 
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 28px',
                fontSize: '13px'
              }}
            >
              <span>Explore Marketplace</span>
              <ArrowRight size={15} />
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
    </div>
  );
};

export default WishlistPage;
