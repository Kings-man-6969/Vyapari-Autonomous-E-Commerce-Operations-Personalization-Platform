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
import { BannerSlot } from '../components/BannerSlot';
import { fetchAllCms, DEFAULT_COPY } from '../lib/content';

export const HomePage = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  // Seeded with the compiled-in copy, so the first paint has real words in it
  // and the CMS round trip only ever *replaces* them. An empty object here would
  // render an empty hero for one frame, which is the single most visible thing
  // on the site.
  const [copy, setCopy] = useState(DEFAULT_COPY);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prodRes, catRes, cms] = await Promise.all([
          api.get('/products?limit=8'),
          api.get('/categories'),
          // Never rejects: `fetchAllCms` resolves to the compiled-in copy when
          // the API is unhappy, so a content outage cannot take the homepage
          // down with it.
          fetchAllCms()
        ]);
        if (prodRes.data?.success) setProducts(prodRes.data.data.products || []);
        if (catRes.data?.success) {
          const list = catRes.data?.data?.categories || catRes.data?.categories || (Array.isArray(catRes.data?.data) ? catRes.data.data : []);
          setCategories(list);
        }
        setCopy(cms);
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

  // The editable sections, each already merged over its compiled-in default by
  // `fetchAllCms`. Read once here rather than inline in the JSX so a missing key
  // is a single `?? {}` at the edge instead of an optional chain on every field.
  const hero = copy['home.hero'] ?? {};
  const trustBar = Array.isArray(copy['home.trust_bar']) ? copy['home.trust_bar'] : [];
  const trending = copy['home.trending'] ?? {};
  const categoriesCopy = copy['home.categories'] ?? {};
  const sellerCta = copy['home.seller_cta'] ?? {};

  // Icon names are data, so the CMS stores a string and this maps it to a
  // component. An unknown name falls back rather than throwing -- a typo in an
  // admin form must not blank a whole section of the homepage.
  const TRUST_ICONS = { truck: Truck, 'rotate-ccw': RotateCcw, shield: ShieldCheck, card: CreditCard };
  const CATEGORY_ICONS = { tv: Tv, shirt: Shirt, home: Home, sparkles: Sparkles };

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
              {hero.eyebrow}
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
            {hero.headline}
          </h1>

          <p style={{
            fontSize: '16px',
            color: 'var(--color-steel-mist)',
            lineHeight: 1.6,
            maxWidth: '680px',
            margin: '0 auto 32px auto',
            fontWeight: 400
          }}>
            {hero.subcopy}
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
            {hero.primary_cta?.label && (
              <Link to={hero.primary_cta.to || '/explore'} className="btn-primary" style={{ padding: '12px 28px', fontSize: '13px' }}>
                {hero.primary_cta.label} <ArrowRight size={14} />
              </Link>
            )}
            {hero.secondary_cta?.label && (
              <Link to={hero.secondary_cta.to || '/explore'} className="btn-outline" style={{ padding: '12px 24px', fontSize: '13px' }}>
                <Star size={14} color="var(--color-silver-glow)" /> {hero.secondary_cta.label}
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* The homepage hero slot. Empty on a fresh install, in which case this
          renders nothing at all and the section above stands on its own. */}
      <BannerSlot
        placement="homepage_hero"
        variant="hero"
        eager
        sizes="(max-width: 1024px) 100vw, 1120px"
        style={{ paddingTop: '32px' }}
      />

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
            {trustBar.map((item, index) => {
              const Icon = TRUST_ICONS[item.icon] || ShieldCheck;
              return (
                <div
                  key={`${item.title}-${index}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '14px' }}
                >
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
                    <Icon size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>{item.title}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-steel-mist)' }}>{item.body}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Second homepage slot, between the trust bar and the grid. Renders
          nothing unless a campaign targets `homepage_strip`. */}
      <BannerSlot
        placement="homepage_strip"
        variant="strip"
        style={{ paddingTop: '32px' }}
      />

      {/* 4. Trending Deals Product Grid */}
      <section style={{ padding: '48px 0', borderBottom: '1px solid var(--color-border-steel)' }}>
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff', margin: 0 }}>
                {trending.headline}
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--color-steel-mist)', marginTop: '4px' }}>
                {trending.subcopy}
              </p>
            </div>
            {trending.cta?.label && (
              <Link to={trending.cta.to || '/explore'} style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-icy-steel)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                {trending.cta.label} <ArrowRight size={14} />
              </Link>
            )}
          </div>

          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
              {[1, 2, 3, 4].map((n) => (
                <div key={n} style={{ height: '340px', backgroundColor: 'var(--color-gunmetal-dark)', borderRadius: '12px', border: '1px solid var(--color-border-steel)' }} className="skeleton" />
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
              {products.map((product, index) => (
                <ProductCard key={product.id} product={product} priority={index === 0} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 5. Shop by Category (Multi-Card Category Banners) */}
      <section style={{ padding: '48px 0', borderBottom: '1px solid var(--color-border-steel)' }}>
        <div className="container">
          <h2 style={{ fontSize: '24px', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff', marginBottom: '24px' }}>
            {categoriesCopy.headline}
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '20px'
          }}>
            {(categoriesCopy.cards || []).map((card, index) => {
              const Icon = CATEGORY_ICONS[card.icon] || Tag;
              return (
                <Link
                  key={`${card.title}-${index}`}
                  to={card.to || '/explore'}
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
                    <Icon size={22} />
                  </div>
                  <h3 style={{ fontSize: '17px', fontWeight: 500, color: '#ffffff', marginBottom: '6px' }}>{card.title}</h3>
                  <p style={{ fontSize: '12px', color: 'var(--color-steel-mist)', lineHeight: 1.5, marginBottom: '14px' }}>
                    {card.body}
                  </p>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-icy-steel)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    {card.cta_label} <ArrowRight size={12} />
                  </span>
                </Link>
              );
            })}
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
                {sellerCta.eyebrow}
              </span>
              <h3 style={{ fontSize: '22px', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff', marginTop: '6px', marginBottom: '8px' }}>
                {sellerCta.headline}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--color-steel-mist)', margin: 0, maxWidth: '560px', lineHeight: 1.6 }}>
                {sellerCta.subcopy}
              </p>
            </div>
            {sellerCta.cta?.label && (
              <Link to={sellerCta.cta.to || '/seller/onboarding'} className="btn-primary" style={{ padding: '12px 28px', fontSize: '13px' }}>
                {sellerCta.cta.label} <ArrowRight size={14} />
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
