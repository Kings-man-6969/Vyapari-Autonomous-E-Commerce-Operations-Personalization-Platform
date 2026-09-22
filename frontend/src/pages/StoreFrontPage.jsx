import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Store, 
  Star, 
  ShieldCheck, 
  MapPin, 
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
        setError(err.response?.data?.message || 'Storefront node not found');
      } finally {
        setLoading(false);
      }
    };
    fetchStore();
  }, [sellerId]);

  if (loading) {
    return (
      <div style={{ backgroundColor: 'var(--color-obsidian-graphite)', minHeight: 'calc(100vh - 76px)', padding: '52px 24px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ height: '220px', marginBottom: '28px', backgroundColor: 'var(--color-gunmetal-dark)', borderRadius: '16px', border: '1px solid var(--color-border-steel)' }} className="skeleton" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '24px' }}>
            {[1, 2, 3, 4].map((n) => (
              <div key={n} style={{ height: '360px', backgroundColor: 'var(--color-gunmetal-dark)', borderRadius: '14px', border: '1px solid var(--color-border-steel)' }} className="skeleton" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !storeData) {
    return (
      <div style={{ backgroundColor: 'var(--color-obsidian-graphite)', minHeight: 'calc(100vh - 76px)', padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: '480px', margin: '0 auto', backgroundColor: 'var(--color-gunmetal-dark)', padding: '44px 36px', borderRadius: '16px', border: '1px solid var(--color-border-steel)' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'var(--color-titanium-brushed)', border: '1px solid var(--color-border-steel)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Store size={28} color="var(--color-ash-label)" />
          </div>
          <h2 className="heading-whisper" style={{ fontSize: '22px', color: '#ffffff', marginBottom: '8px' }}>Storefront Inactive</h2>
          <p style={{ color: 'var(--color-silver-glow)', opacity: 0.75, marginBottom: '24px', fontSize: '13px' }}>
            {error || 'This merchant storefront is currently inactive or undergoing regulatory verification.'}
          </p>
          <Link 
            to="/explore" 
            className="btn-primary"
            style={{ display: 'inline-block', padding: '12px 28px' }}
          >
            Browse All Curations
          </Link>
        </div>
      </div>
    );
  }

  const { seller, products } = storeData;

  return (
    <div style={{ backgroundColor: 'var(--color-obsidian-graphite)', minHeight: 'calc(100vh - 76px)', padding: '40px 24px 80px' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        {/* Back button */}
        <div style={{ marginBottom: '20px' }}>
          <Link 
            to="/explore" 
            style={{ 
              color: 'var(--color-silver-glow)', 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              fontSize: '13px',
              textDecoration: 'none',
              opacity: 0.8
            }}
          >
            <ArrowLeft size={15} />
            <span>Back to Catalog</span>
          </Link>
        </div>

        {/* Store Banner */}
        <div style={{
          backgroundColor: 'var(--color-gunmetal-dark)',
          border: '1px solid var(--color-border-steel)',
          borderRadius: '16px',
          padding: '36px 32px',
          marginBottom: '36px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{
              width: '68px',
              height: '68px',
              borderRadius: '14px',
              backgroundColor: 'var(--color-titanium-brushed)',
              border: '1px solid var(--color-border-chrome)',
              color: 'var(--color-icy-steel)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.85rem',
              fontWeight: 600
            }}>
              {seller.store_name ? seller.store_name[0].toUpperCase() : <Store size={32} />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 className="heading-whisper" style={{ fontSize: '28px', color: '#ffffff', margin: 0 }}>{seller.store_name}</h1>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: 'var(--radius-pills)', backgroundColor: 'var(--color-titanium-brushed)', border: '1px solid var(--color-border-steel)', color: 'var(--color-icy-steel)' }}>
                  <ShieldCheck size={12} />
                  Verified Merchant
                </span>
              </div>
              <p style={{ color: 'var(--color-silver-glow)', opacity: 0.8, fontSize: '13px', marginTop: '6px', maxWidth: '600px', lineHeight: 1.5, margin: '6px 0 0 0' }}>
                {seller.store_description || 'Independent merchant offering verified authentic goods on the Vyapari autonomous network.'}
              </p>
            </div>
          </div>

          {/* Store Metrics */}
          <div style={{ display: 'flex', gap: '14px' }}>
            <div style={{ textAlign: 'center', padding: '12px 20px', backgroundColor: 'var(--color-titanium-brushed)', border: '1px solid var(--color-border-steel)', borderRadius: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <Star size={14} fill="var(--color-silver-glow)" stroke="none" />
                <span style={{ fontSize: '18px', fontWeight: 600, color: '#ffffff' }}>
                  {parseFloat(seller.rating || 4.8).toFixed(1)}
                </span>
              </div>
              <span style={{ fontSize: '10px', color: 'var(--color-ash-label)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Verified Rating
              </span>
            </div>

            <div style={{ textAlign: 'center', padding: '12px 20px', backgroundColor: 'var(--color-titanium-brushed)', border: '1px solid var(--color-border-steel)', borderRadius: '10px' }}>
              <div style={{ fontSize: '18px', fontWeight: 600, color: '#ffffff' }}>
                {products.length}
              </div>
              <span style={{ fontSize: '10px', color: 'var(--color-ash-label)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Live Listings
              </span>
            </div>
          </div>
        </div>

        {/* Catalog Grid */}
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="heading-whisper" style={{ fontSize: '20px', color: '#ffffff', margin: 0 }}>
            Collection by {seller.store_name}
          </h2>
          <span style={{ fontSize: '12px', color: 'var(--color-silver-glow)', opacity: 0.75 }}>
            {products.length} {products.length === 1 ? 'curation' : 'curations'} available
          </span>
        </div>

        {products.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 24px',
            backgroundColor: 'var(--color-gunmetal-dark)',
            borderRadius: '16px',
            border: '1px dashed var(--color-border-steel)'
          }}>
            <Package size={36} color="var(--color-ash-label)" style={{ marginBottom: '12px' }} />
            <h3 className="heading-whisper" style={{ fontSize: '18px', color: '#ffffff', marginBottom: '6px' }}>No items currently listed</h3>
            <p style={{ color: 'var(--color-silver-glow)', opacity: 0.75, fontSize: '13px' }}>
              This merchant has not published public listings yet.
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
    </div>
  );
};

export default StoreFrontPage;
