import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Store, 
  Star, 
  ShieldCheck, 
  MapPin, 
  FileText, 
  Package, 
  ArrowLeft 
} from 'lucide-react';
import api from '../services/api';
import { ProductCard } from '../components/ProductCard';

export const StoreFrontPage = () => {
  const { sellerId } = useParams();
  const [storeData, setStoreData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStore = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/stores/${sellerId}`);
        if (res.data?.success) {
          setStoreData(res.data.data);
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Store not found');
      } finally {
        setLoading(false);
      }
    };
    fetchStore();
  }, [sellerId]);

  if (loading) {
    return (
      <div className="container" style={{ padding: '40px 24px' }}>
        <div style={{ height: '240px', marginBottom: '24px' }} className="skeleton" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '24px' }}>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} style={{ height: '320px' }} className="skeleton" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !storeData) {
    return (
      <div className="container" style={{ padding: '80px 24px', textAlign: 'center' }}>
        <Store size={48} color="var(--color-text-muted)" style={{ marginBottom: '16px' }} />
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>Store Not Found</h2>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
          {error || 'This seller storefront does not exist or has been deactivated.'}
        </p>
        <Link to="/explore" className="btn-primary">
          Browse All Products
        </Link>
      </div>
    );
  }

  const { seller, products } = storeData;

  return (
    <div className="container" style={{ padding: '32px 24px 64px' }}>
      {/* Back button */}
      <div style={{ marginBottom: '16px' }}>
        <Link to="/explore" style={{ color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-sm)' }}>
          <ArrowLeft size={16} />
          <span>Back to Catalog</span>
        </Link>
      </div>

      {/* Store Banner & Brand Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
        color: '#ffffff',
        borderRadius: 'var(--radius-lg)',
        padding: '40px 32px',
        marginBottom: '36px',
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: '#ffffff',
            color: 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            fontWeight: 800,
            boxShadow: 'var(--shadow-sm)'
          }}>
            {seller.store_name ? seller.store_name[0].toUpperCase() : <Store size={36} />}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{seller.store_name}</h1>
              <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <ShieldCheck size={12} />
                Verified Merchant
              </span>
            </div>
            <p style={{ color: '#94A3B8', fontSize: 'var(--font-size-sm)', marginTop: '4px', maxWidth: '600px', lineHeight: 1.5 }}>
              {seller.store_description || 'Authentic creator and merchant on Vyapari Marketplace.'}
            </p>
          </div>
        </div>

        {/* Store Metrics */}
        <div style={{ display: 'flex', gap: '24px' }}>
          <div style={{ textAlign: 'center', padding: '12px 18px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: '#FFB800' }}>
              <Star size={16} fill="#FFB800" />
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
                {parseFloat(seller.rating || 4.8).toFixed(1)}
              </span>
            </div>
            <span style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Rating
            </span>
          </div>

          <div style={{ textAlign: 'center', padding: '12px 18px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
              {products.length}
            </div>
            <span style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Live Products
            </span>
          </div>
        </div>
      </div>

      {/* Catalog Grid */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 700 }}>
          Products by {seller.store_name}
        </h2>
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
          {products.length} {products.length === 1 ? 'item' : 'items'} available
        </span>
      </div>

      {products.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 24px',
          backgroundColor: 'var(--color-surface-subtle)',
          borderRadius: 'var(--radius-md)'
        }}>
          <Package size={36} color="var(--color-text-muted)" style={{ marginBottom: '12px' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>No items currently listed</h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            This seller has not posted any active products yet.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '24px'
        }}>
          {products.map((prod) => (
            <ProductCard key={prod.id} product={prod} />
          ))}
        </div>
      )}
    </div>
  );
};

export default StoreFrontPage;
