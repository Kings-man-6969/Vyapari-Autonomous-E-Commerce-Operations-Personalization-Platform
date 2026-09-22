import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, 
  ShieldCheck, 
  Truck, 
  RotateCcw, 
  CreditCard, 
  ShoppingBag,
  Tag,
  Star,
  Sparkles,
  Smartphone,
  Tv,
  Shirt,
  Home,
  BookOpen
} from 'lucide-react';
import api from '../services/api';
import { ProductCard } from '../components/ProductCard';

export const HomePage = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prodRes, catRes] = await Promise.all([
          api.get('/products?limit=8'),
          api.get('/categories')
        ]);
        if (prodRes.data?.success) setProducts(prodRes.data.data.products || []);
        if (catRes.data?.success) {
          const list = catRes.data?.data?.categories || catRes.data?.categories || (Array.isArray(catRes.data?.data) ? catRes.data.data : []);
          setCategories(list);
        }
      } catch (err) {
        console.error('Error fetching homepage data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const defaultCategories = [
    { name: 'All Products', icon: <ShoppingBag size={15} />, link: '/explore' },
    { name: 'Electronics', icon: <Tv size={15} />, link: '/explore?category=1' },
    { name: 'Mobiles & Audio', icon: <Smartphone size={15} />, link: '/explore?q=phone' },
    { name: 'Fashion & Style', icon: <Shirt size={15} />, link: '/explore?category=2' },
    { name: 'Home & Kitchen', icon: <Home size={15} />, link: '/explore?category=3' },
    { name: 'Books & More', icon: <BookOpen size={15} />, link: '/explore?q=book' },
  ];

  return (
    <div style={{ backgroundColor: 'var(--color-obsidian-graphite)', color: '#ffffff', minHeight: '100vh' }}>
      
      {/* 1. Category Navigation Strip (Amazon/Flipkart style) */}
      <nav style={{
        backgroundColor: 'var(--color-gunmetal-dark)',
        borderBottom: '1px solid var(--color-border-steel)',
        padding: '10px 0',
        overflowX: 'auto'
      }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 'max-content' }}>
          {defaultCategories.map((cat, idx) => (
            <Link
              key={idx}
              to={cat.link}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '9999px',
                backgroundColor: 'var(--color-titanium-brushed)',
                border: '1px solid var(--color-border-steel)',
                color: 'var(--color-brushed-aluminum)',
                fontSize: '12.5px',
                fontWeight: 500,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border-chrome)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border-steel)';
                e.currentTarget.style.color = 'var(--color-brushed-aluminum)';
              }}
            >
              {cat.icon}
              <span>{cat.name}</span>
            </Link>
          ))}
          {categories.slice(0, 3).map((c) => (
            <Link
              key={c.id}
              to={`/explore?category=${c.id}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '9999px',
                backgroundColor: 'transparent',
                border: '1px solid transparent',
                color: 'var(--color-steel-mist)',
                fontSize: '12.5px',
                textDecoration: 'none',
                whiteSpace: 'nowrap'
              }}
            >
              {c.name}
            </Link>
          ))}
        </div>
      </nav>

      {/* 2. Hero Deals Banner (High-Conversion E-Commerce) */}
      <section style={{
        position: 'relative',
        padding: '56px 0 48px 0',
        background: 'radial-gradient(ellipse at 50% 10%, rgba(203, 213, 225, 0.08) 0%, rgba(18, 21, 27, 0.5) 50%, transparent 80%), var(--color-obsidian-graphite)',
        borderBottom: '1px solid var(--color-border-steel)'
      }}>
        <div className="container" style={{ maxWidth: '1120px', textAlign: 'center' }}>
          {/* Sale Pill Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 16px',
            borderRadius: '9999px',
            backgroundColor: 'var(--color-gunmetal-dark)',
            border: '1px solid var(--color-border-steel)',
            marginBottom: '20px'
          }}>
            <Tag size={13} color="var(--color-icy-steel)" />
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-brushed-aluminum)' }}>
              Mega Savings • Limited Time Deals
            </span>
          </div>

          <h1 style={{
            fontSize: 'clamp(2rem, 4.5vw, 3.4rem)',
            fontWeight: 330,
            letterSpacing: '0.02em',
            lineHeight: 1.2,
            marginBottom: '16px',
            color: '#ffffff'
          }}>
            Great Deals on Everything You Love
          </h1>

          <p style={{
            fontSize: '16px',
            color: 'var(--color-steel-mist)',
            lineHeight: 1.6,
            maxWidth: '680px',
            margin: '0 auto 32px auto',
            fontWeight: 400
          }}>
            Discover top-rated products from verified independent merchants. Enjoy free delivery on eligible orders, secure checkout, and easy 7-day returns.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <Link to="/explore" className="btn-primary" style={{ padding: '12px 28px', fontSize: '13px' }}>
              Shop All Deals <ArrowRight size={14} />
            </Link>
            <Link to="/explore?sort=rating" className="btn-outline" style={{ padding: '12px 24px', fontSize: '13px' }}>
              <Star size={14} color="var(--color-silver-glow)" /> Top Rated Products
            </Link>
          </div>
        </div>
      </section>

      {/* 3. Value Proposition Bar (Amazon/Flipkart Style Trust Badges) */}
      <section style={{
        padding: '24px 0',
        backgroundColor: 'var(--color-gunmetal-dark)',
        borderBottom: '1px solid var(--color-border-steel)'
      }}>
        <div className="container">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-titanium-brushed)',
                border: '1px solid var(--color-border-steel)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-icy-steel)',
                flexShrink: 0
              }}>
                <Truck size={20} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>Free Fast Delivery</div>
                <div style={{ fontSize: '11px', color: 'var(--color-steel-mist)' }}>On orders over ₹499</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-titanium-brushed)',
                border: '1px solid var(--color-border-steel)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-icy-steel)',
                flexShrink: 0
              }}>
                <RotateCcw size={20} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>7-Day Easy Returns</div>
                <div style={{ fontSize: '11px', color: 'var(--color-steel-mist)' }}>Hassle-free replacement or refund</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-titanium-brushed)',
                border: '1px solid var(--color-border-steel)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-icy-steel)',
                flexShrink: 0
              }}>
                <ShieldCheck size={20} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>100% Genuine Products</div>
                <div style={{ fontSize: '11px', color: 'var(--color-steel-mist)' }}>From verified sellers</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-titanium-brushed)',
                border: '1px solid var(--color-border-steel)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-icy-steel)',
                flexShrink: 0
              }}>
                <CreditCard size={20} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>Secure Payments</div>
                <div style={{ fontSize: '11px', color: 'var(--color-steel-mist)' }}>Cards, UPI & Net Banking</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Trending Deals Product Grid */}
      <section style={{ padding: '48px 0', borderBottom: '1px solid var(--color-border-steel)' }}>
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff', margin: 0 }}>
                Trending Deals of the Day
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--color-steel-mist)', marginTop: '4px' }}>
                Handpicked top offers with special price reductions
              </p>
            </div>
            <Link to="/explore" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-icy-steel)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              See all deals <ArrowRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
              {[1, 2, 3, 4].map((n) => (
                <div key={n} style={{ height: '340px', backgroundColor: 'var(--color-gunmetal-dark)', borderRadius: '12px', border: '1px solid var(--color-border-steel)' }} className="skeleton" />
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 5. Shop by Category (Multi-Card Category Banners) */}
      <section style={{ padding: '48px 0', borderBottom: '1px solid var(--color-border-steel)' }}>
        <div className="container">
          <h2 style={{ fontSize: '24px', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff', marginBottom: '24px' }}>
            Explore Popular Categories
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '20px'
          }}>
            <Link
              to="/explore?category=1"
              style={{
                display: 'block',
                padding: '24px',
                borderRadius: '12px',
                backgroundColor: 'var(--color-gunmetal-dark)',
                border: '1px solid var(--color-border-steel)',
                textDecoration: 'none',
                transition: 'border-color 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-border-chrome)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--color-border-steel)'}
            >
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: 'var(--color-titanium-brushed)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', color: 'var(--color-icy-steel)' }}>
                <Tv size={22} />
              </div>
              <h3 style={{ fontSize: '17px', fontWeight: 500, color: '#ffffff', marginBottom: '6px' }}>Electronics & Audio</h3>
              <p style={{ fontSize: '12px', color: 'var(--color-steel-mist)', lineHeight: 1.5, marginBottom: '14px' }}>
                Headphones, speakers, smart watches and premium gadgets.
              </p>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-icy-steel)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                Shop Electronics <ArrowRight size={12} />
              </span>
            </Link>

            <Link
              to="/explore?category=2"
              style={{
                display: 'block',
                padding: '24px',
                borderRadius: '12px',
                backgroundColor: 'var(--color-gunmetal-dark)',
                border: '1px solid var(--color-border-steel)',
                textDecoration: 'none',
                transition: 'border-color 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-border-chrome)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--color-border-steel)'}
            >
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: 'var(--color-titanium-brushed)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', color: 'var(--color-icy-steel)' }}>
                <Shirt size={22} />
              </div>
              <h3 style={{ fontSize: '17px', fontWeight: 500, color: '#ffffff', marginBottom: '6px' }}>Fashion & Apparel</h3>
              <p style={{ fontSize: '12px', color: 'var(--color-steel-mist)', lineHeight: 1.5, marginBottom: '14px' }}>
                Designer apparel, handcrafted streetwear and accessories.
              </p>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-icy-steel)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                Shop Fashion <ArrowRight size={12} />
              </span>
            </Link>

            <Link
              to="/explore?category=3"
              style={{
                display: 'block',
                padding: '24px',
                borderRadius: '12px',
                backgroundColor: 'var(--color-gunmetal-dark)',
                border: '1px solid var(--color-border-steel)',
                textDecoration: 'none',
                transition: 'border-color 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-border-chrome)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--color-border-steel)'}
            >
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: 'var(--color-titanium-brushed)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', color: 'var(--color-icy-steel)' }}>
                <Home size={22} />
              </div>
              <h3 style={{ fontSize: '17px', fontWeight: 500, color: '#ffffff', marginBottom: '6px' }}>Home & Living</h3>
              <p style={{ fontSize: '12px', color: 'var(--color-steel-mist)', lineHeight: 1.5, marginBottom: '14px' }}>
                Minimalist ceramics, cookware and modern decor.
              </p>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-icy-steel)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                Shop Home <ArrowRight size={12} />
              </span>
            </Link>

            <Link
              to="/explore?sort=rating"
              style={{
                display: 'block',
                padding: '24px',
                borderRadius: '12px',
                backgroundColor: 'var(--color-gunmetal-dark)',
                border: '1px solid var(--color-border-steel)',
                textDecoration: 'none',
                transition: 'border-color 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-border-chrome)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--color-border-steel)'}
            >
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: 'var(--color-titanium-brushed)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', color: 'var(--color-icy-steel)' }}>
                <Sparkles size={22} />
              </div>
              <h3 style={{ fontSize: '17px', fontWeight: 500, color: '#ffffff', marginBottom: '6px' }}>Best Sellers</h3>
              <p style={{ fontSize: '12px', color: 'var(--color-steel-mist)', lineHeight: 1.5, marginBottom: '14px' }}>
                Highest-rated customer favorites and verified bestsellers.
              </p>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-icy-steel)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                Explore Best Sellers <ArrowRight size={12} />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* 6. Become a Seller Callout Banner */}
      <section style={{ padding: '48px 0 64px' }}>
        <div className="container">
          <div style={{
            padding: '36px',
            borderRadius: '16px',
            backgroundColor: 'var(--color-gunmetal-dark)',
            border: '1px solid var(--color-border-steel)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '24px'
          }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-icy-steel)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Merchant Marketplace
              </span>
              <h3 style={{ fontSize: '22px', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff', marginTop: '6px', marginBottom: '8px' }}>
                Sell on Vyapari & Grow Your Business
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--color-steel-mist)', margin: 0, maxWidth: '560px', lineHeight: 1.6 }}>
                Reach customers nationwide. List products with AI assistance, manage your orders seamlessly, and receive fast, guaranteed payouts.
              </p>
            </div>
            <Link to="/seller/onboarding" className="btn-primary" style={{ padding: '12px 28px', fontSize: '13px' }}>
              Become a Seller <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
