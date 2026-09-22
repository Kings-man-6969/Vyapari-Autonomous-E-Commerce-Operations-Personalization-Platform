import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  ShoppingBag, 
  Search, 
  User, 
  Store, 
  ShieldCheck, 
  LogOut, 
  Menu, 
  X,
  Sparkles,
  Heart,
  Bell,
  Package,
  MapPin,
  Settings,
  Boxes,
  FileCheck2,
  TrendingUp,
  Cpu,
  Tag,
  ArrowRight,
  Star
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import api from '../services/api';

export const Header = () => {
  const { user, isAuthenticated, isCustomer, isSeller, isAdmin, logout } = useAuth();
  const { itemCount } = useCart();
  const { wishlistCount } = useWishlist();
  const [searchQuery, setSearchQuery] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Search Autocomplete / Suggestions State
  const [suggestionsData, setSuggestionsData] = useState({ products: [], brands: [], categories: [], suggestions: [] });
  const [isSuggestOpen, setIsSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const menuRef = useRef(null);
  const desktopSearchRef = useRef(null);
  const mobileSearchRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Close dropdown on route change or click outside
  useEffect(() => {
    setUserMenuOpen(false);
    setIsSuggestOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
      if (
        desktopSearchRef.current && !desktopSearchRef.current.contains(event.target) &&
        mobileSearchRef.current && !mobileSearchRef.current.contains(event.target)
      ) {
        setIsSuggestOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch unread notification count
  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadNotifications(0);
      return;
    }
    const fetchUnread = async () => {
      try {
        const res = await api.get('/notifications');
        if (res.data?.success) {
          const count = res.data.data?.unread_count !== undefined
            ? res.data.data.unread_count
            : (Array.isArray(res.data.data?.notifications)
                ? res.data.data.notifications.filter((n) => !n.is_read).length
                : (Array.isArray(res.data.data) ? res.data.data.filter((n) => !n.is_read).length : 0));
          setUnreadNotifications(count);
        }
      } catch {
        // Silently tolerate if notification service is idle
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Debounced search autocomplete
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSuggestionsData({ products: [], brands: [], categories: [], suggestions: [] });
      setIsSuggestOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSuggestLoading(true);
        const res = await api.get(`/products/suggest?q=${encodeURIComponent(searchQuery.trim())}`);
        if (res.data?.success) {
          setSuggestionsData(res.data.data);
          setIsSuggestOpen(true);
        }
      } catch (err) {
        console.warn('Suggest error:', err.message);
      } finally {
        setSuggestLoading(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    if (searchQuery.trim()) {
      setIsSuggestOpen(false);
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const renderSuggestionsDropdown = () => {
    if (!isSuggestOpen) return null;
    const hasAnyContent = (
      (suggestionsData.products && suggestionsData.products.length > 0) ||
      (suggestionsData.brands && suggestionsData.brands.length > 0) ||
      (suggestionsData.categories && suggestionsData.categories.length > 0) ||
      (suggestionsData.suggestions && suggestionsData.suggestions.length > 0)
    );

    if (!hasAnyContent && !suggestLoading) return null;

    return (
      <div style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        left: 0,
        right: 0,
        backgroundColor: 'var(--color-deep-canopy)',
        borderRadius: '12px',
        border: '1px solid var(--color-iron-veil)',
        boxShadow: 'var(--shadow-floating)',
        zIndex: 1100,
        overflow: 'hidden',
        maxHeight: '440px',
        overflowY: 'auto'
      }}>
        {suggestLoading && (
          <div style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--color-steel-mist)', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-border-steel)' }}>
            <Sparkles size={13} color="var(--color-icy-steel)" />
            <span>Searching products, categories, and brands...</span>
          </div>
        )}

        {/* 1. Quick Brand & Category Discovery Badges */}
        {(suggestionsData.brands?.length > 0 || suggestionsData.categories?.length > 0) && (
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border-steel)', display: 'flex', gap: '8px', flexWrap: 'wrap', backgroundColor: 'var(--color-gunmetal-dark)' }}>
            {suggestionsData.brands?.map((b) => (
              <button
                key={b.name}
                type="button"
                onClick={() => {
                  setIsSuggestOpen(false);
                  navigate(`/explore?brand=${encodeURIComponent(b.name)}`);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  borderRadius: '9999px',
                  backgroundColor: 'var(--color-slate-chrome)',
                  border: '1px solid var(--color-border-steel)',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <Store size={13} color="var(--color-icy-steel)" />
                <span>Brand: {b.name}</span>
                <span style={{ color: 'var(--color-slate-caption)', fontSize: '11px' }}>({b.count})</span>
              </button>
            ))}

            {suggestionsData.categories?.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setIsSuggestOpen(false);
                  navigate(`/explore?category=${c.id}`);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  borderRadius: '9999px',
                  backgroundColor: 'var(--color-deep-canopy)',
                  border: '1px solid var(--color-iron-veil)',
                  color: 'var(--color-tide-pool)',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                <Tag size={13} color="var(--color-cyan-pulse)" />
                <span>in {c.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* 2. Suggested Queries Autocomplete */}
        {suggestionsData.suggestions?.length > 0 && (
          <div style={{ padding: '6px 0', borderBottom: '1px solid var(--color-iron-veil)' }}>
            {suggestionsData.suggestions.map((s, idx) => (
              <div
                key={idx}
                onClick={() => {
                  setSearchQuery(s);
                  setIsSuggestOpen(false);
                  navigate(`/search?q=${encodeURIComponent(s)}`);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  color: '#ffffff',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-forest-floor)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Search size={14} color="var(--color-ash-label)" />
                <span style={{ fontWeight: 500 }}>{s}</span>
              </div>
            ))}
          </div>
        )}

        {/* 3. Matching Products Preview */}
        {suggestionsData.products?.length > 0 && (
          <div style={{ padding: '6px 0' }}>
            <div style={{ padding: '4px 16px 6px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-ash-label)', letterSpacing: '0.06em' }}>
              Products
            </div>
            {suggestionsData.products.map((prod) => {
              const images = Array.isArray(prod.images) ? prod.images : (typeof prod.images === 'string' ? JSON.parse(prod.images || '[]') : []);
              const thumb = images[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80';
              const priceNum = parseFloat(prod.price);

              return (
                <div
                  key={prod.id}
                  onClick={() => {
                    setIsSuggestOpen(false);
                    navigate(`/products/${prod.id}`);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 16px',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-forest-floor)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <img
                    src={thumb}
                    alt=""
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '6px',
                      objectFit: 'contain',
                      backgroundColor: 'var(--color-abyssal-ink)',
                      padding: '2px',
                      border: '1px solid var(--color-iron-veil)',
                      flexShrink: 0
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {prod.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--color-tide-pool)' }}>
                        {prod.brand || prod.category_name}
                      </span>
                      {prod.rating && (
                        <span style={{ fontSize: '11px', color: 'var(--color-icy-steel)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Star size={11} fill="var(--color-icy-steel)" stroke="none" />
                          {parseFloat(prod.rating).toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', flexShrink: 0 }}>
                    ₹{priceNum.toLocaleString('en-IN')}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 4. Bottom Natural Language Action */}
        <div
          onClick={handleSearch}
          style={{
            padding: '11px 16px',
            backgroundColor: 'var(--color-forest-floor)',
            borderTop: '1px solid var(--color-iron-veil)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            fontSize: '12.5px',
            color: 'var(--color-tide-pool)'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(24, 29, 38, 0.8)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-forest-floor)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={15} color="var(--color-icy-steel)" />
            <span>Search <strong>"{searchQuery}"</strong> with pgvector AI semantic intent</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--color-ash-label)' }}>
            <span>Enter</span>
            <ArrowRight size={13} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      backgroundColor: 'rgba(9, 10, 13, 0.92)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--color-border-steel)',
      boxShadow: 'var(--shadow-sm)'
    }}>
      <div className="container header-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
        {/* Mobile Hamburger Button — rightmost on mobile */}
        <button
          className="header-mobile-menu-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle navigation menu"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#ffffff',
            cursor: 'pointer',
            padding: '6px',
            alignItems: 'center',
            justifyContent: 'center',
            order: 3,
            marginLeft: '6px'
          }}
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        {/* Brand Logo & System Status Badge — always leftmost */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0, order: 0 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '9px',
              background: 'linear-gradient(135deg, #181d26 0%, #12151b 100%)',
              border: '1px solid var(--color-border-chrome)',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 4px 12px rgba(0, 0, 0, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-brushed-aluminum)'
            }}>
              <ShoppingBag size={18} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 330, letterSpacing: '0.04em', color: '#ffffff', lineHeight: 1.1 }}>
                Vyapari
              </span>
              <span style={{ fontSize: '0.62rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-steel-mist)', letterSpacing: '0.08em' }}>
                Online Store
              </span>
            </div>
          </Link>
        </div>

        {/* Global Desktop Search Bar (Hidden on Mobile) */}
        <div ref={desktopSearchRef} className="header-desktop-search" style={{ position: 'relative', flex: '1', maxWidth: '520px' }}>
          <form onSubmit={handleSearch} style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            backgroundColor: 'var(--color-gunmetal-dark)',
            borderRadius: 'var(--radius-pills)',
            padding: '6px 14px',
            border: isSuggestOpen ? '1px solid var(--color-icy-steel)' : '1px solid var(--color-border-steel)',
            boxShadow: 'var(--shadow-sm)',
            transition: 'all var(--transition-fast)'
          }}>
            <Search size={16} color="var(--color-ash-label)" style={{ marginRight: '8px', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search for products, brands and more..."
              value={searchQuery}
              onFocus={() => {
                if (suggestionsData.products?.length > 0 || suggestionsData.suggestions?.length > 0) {
                  setIsSuggestOpen(true);
                }
              }}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setIsSuggestOpen(false);
              }}
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '13px',
                color: '#ffffff'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setIsSuggestOpen(false);
                }}
                style={{ padding: '4px', cursor: 'pointer', color: 'var(--color-ash-label)', marginRight: '4px' }}
                title="Clear input"
              >
                <X size={14} />
              </button>
            )}
            <button type="submit" aria-label="Submit search" style={{
              backgroundColor: '#ffffff',
              color: '#02090a',
              borderRadius: 'var(--radius-pills)',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              cursor: 'pointer'
            }}>
              <Search size={12} />
            </button>
          </form>

          {renderSuggestionsDropdown()}
        </div>

        {/* Mobile Full-Width Search Bar */}
        <div ref={mobileSearchRef} className="header-mobile-search" style={{ position: 'relative', width: '100%' }}>
          <form onSubmit={handleSearch} style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            backgroundColor: 'var(--color-gunmetal-dark)',
            borderRadius: 'var(--radius-pills)',
            padding: '6px 14px',
            border: isSuggestOpen ? '1px solid var(--color-icy-steel)' : '1px solid var(--color-border-steel)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <Search size={16} color="var(--color-ash-label)" style={{ marginRight: '8px', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search for products, brands and more..."
              value={searchQuery}
              onFocus={() => {
                if (suggestionsData.products?.length > 0 || suggestionsData.suggestions?.length > 0) {
                  setIsSuggestOpen(true);
                }
              }}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setIsSuggestOpen(false);
              }}
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '13px',
                color: '#ffffff'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setIsSuggestOpen(false);
                }}
                style={{ padding: '4px', cursor: 'pointer', color: 'var(--color-ash-label)', marginRight: '4px' }}
                title="Clear input"
              >
                <X size={14} />
              </button>
            )}
            <button type="submit" aria-label="Submit search" style={{
              backgroundColor: '#ffffff',
              color: '#02090a',
              borderRadius: 'var(--radius-pills)',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Search size={12} />
            </button>
          </form>

          {renderSuggestionsDropdown()}
        </div>

        {/* Action Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, order: 2 }}>
          {/* Desktop-only text links */}
          <div className="header-desktop-links">
            <Link 
              to="/explore" 
              style={{ 
                fontSize: '13px', 
                fontWeight: 500, 
                color: 'var(--color-tide-pool)',
                padding: '6px 12px',
                borderRadius: 'var(--radius-pills)',
                transition: 'color 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-tide-pool)')}
            >
              Catalog
            </Link>

            {/* Seller Quick Entry */}
            {isSeller && (
              <Link 
                to="/seller/dashboard" 
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  fontSize: '13px', 
                  fontWeight: 500,
                  color: '#ffffff',
                  backgroundColor: 'var(--color-gunmetal-dark)',
                  border: '1px solid var(--color-border-steel)',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-pills)'
                }}
              >
                <Store size={14} color="var(--color-icy-steel)" />
                <span>Seller Console</span>
              </Link>
            )}

            {/* Admin Quick Entry */}
            {isAdmin && (
              <Link 
                to="/admin" 
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  fontSize: '13px', 
                  fontWeight: 500,
                  color: '#ffffff',
                  backgroundColor: 'var(--color-forest-floor)',
                  border: '1px solid var(--color-iron-veil)',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-pills)'
                }}
              >
                <ShieldCheck size={14} color="var(--color-cyan-pulse)" />
                <span>Admin Desk</span>
              </Link>
            )}
          </div>

          {/* Wishlist Link — customers only */}
          {isCustomer && (
            <Link 
              to="/wishlist" 
              title="My Wishlist"
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-pills)',
                border: '1px solid var(--color-iron-veil)',
                backgroundColor: 'var(--color-forest-floor)'
              }}
            >
              <Heart size={16} color="var(--color-tide-pool)" />
              {wishlistCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  backgroundColor: 'var(--color-icy-steel)',
                  color: '#090a0d',
                  fontSize: '10px',
                  fontWeight: 700,
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {wishlistCount}
                </span>
              )}
            </Link>
          )}

          {/* Notifications Link with Badge */}
          {isAuthenticated && (
            <Link 
              to="/notifications" 
              title="Notifications"
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-pills)',
                border: '1px solid var(--color-border-steel)',
                backgroundColor: 'var(--color-gunmetal-dark)'
              }}
            >
              <Bell size={16} color="var(--color-steel-mist)" />
              {unreadNotifications > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  backgroundColor: 'var(--color-icy-steel)',
                  color: '#090a0d',
                  fontSize: '10px',
                  fontWeight: 700,
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              )}
            </Link>
          )}

          {/* Cart Link — customers only */}
          {isCustomer && (
            <Link 
              to="/cart" 
              title="Shopping Cart"
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-pills)',
                border: '1px solid var(--color-iron-veil)',
                backgroundColor: 'var(--color-forest-floor)'
              }}
            >
              <ShoppingBag size={16} color="var(--color-tide-pool)" />
              {itemCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  backgroundColor: '#ffffff',
                  color: '#02090a',
                  fontSize: '10px',
                  fontWeight: 700,
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {itemCount}
                </span>
              )}
            </Link>
          )}

          {/* User Profile Pill & Dropdown */}
          <div style={{ position: 'relative' }} ref={menuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 10px 4px 12px',
                borderRadius: 'var(--radius-pills)',
                border: '1px solid var(--color-iron-veil)',
                backgroundColor: 'var(--color-forest-floor)',
                cursor: 'pointer'
              }}
            >
              <Menu size={15} color="var(--color-tide-pool)" />
              <div style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                backgroundColor: isAuthenticated ? 'var(--color-slate-chrome)' : 'var(--color-titanium-brushed)',
                color: isAuthenticated ? 'var(--color-icy-steel)' : 'var(--color-silver-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: '11px',
                border: '1px solid var(--color-border-steel)'
              }}>
                {isAuthenticated && user.name ? user.name[0].toUpperCase() : <User size={13} />}
              </div>
            </button>

            {/* Comprehensive Dropdown Menu */}
            {userMenuOpen && (
              <div style={{
                position: 'absolute',
                right: 0,
                top: '46px',
                width: '260px',
                backgroundColor: 'var(--color-deep-canopy)',
                borderRadius: '12px',
                boxShadow: 'var(--shadow-floating)',
                border: '1px solid var(--color-iron-veil)',
                padding: '8px 0',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 110
              }}>
                {isAuthenticated ? (
                  <>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-iron-veil)' }}>
                      <p style={{ fontWeight: 600, fontSize: '14px', color: '#ffffff' }}>{user.name}</p>
                      <p style={{ fontSize: '12px', color: 'var(--color-tide-pool)', wordBreak: 'break-all' }}>{user.email}</p>
                      <span className="badge badge-primary" style={{ marginTop: '6px', textTransform: 'capitalize' }}>
                        {user.role}
                      </span>
                    </div>

                    {/* Catalog Link */}
                    <Link 
                      to="/explore" 
                      onClick={() => setUserMenuOpen(false)}
                      style={{ padding: '9px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-tide-pool)' }}
                    >
                      <Boxes size={15} color="var(--color-ash-label)" />
                      Explore Catalog
                    </Link>

                    {/* Customer Links */}
                    <Link 
                      to="/account" 
                      onClick={() => setUserMenuOpen(false)}
                      style={{ padding: '9px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-tide-pool)' }}
                    >
                      <User size={15} color="var(--color-ash-label)" />
                      Profile & Security
                    </Link>

                    {/* Customer-only links: Orders, Addresses, Wishlist */}
                    {isCustomer && (
                      <>
                        <Link 
                          to="/orders" 
                          onClick={() => setUserMenuOpen(false)}
                          style={{ padding: '9px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-tide-pool)' }}
                        >
                          <Package size={15} color="var(--color-ash-label)" />
                          My Orders
                        </Link>

                        <Link 
                          to="/account/addresses" 
                          onClick={() => setUserMenuOpen(false)}
                          style={{ padding: '9px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-tide-pool)' }}
                        >
                          <MapPin size={15} color="var(--color-ash-label)" />
                          Saved Addresses
                        </Link>

                        <Link 
                          to="/wishlist" 
                          onClick={() => setUserMenuOpen(false)}
                          style={{ padding: '9px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-tide-pool)' }}
                        >
                          <Heart size={15} color="var(--color-ash-label)" />
                          Wishlist ({wishlistCount})
                        </Link>
                      </>
                    )}

                    {/* Seller Console Submenu */}
                    {isSeller ? (
                      <div style={{ borderTop: '1px solid var(--color-iron-veil)', marginTop: '4px', paddingTop: '4px' }}>
                        <div style={{ padding: '6px 16px 2px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-ash-label)', letterSpacing: '0.06em' }}>
                          Merchant Operations
                        </div>
                        <Link 
                          to="/seller/dashboard" 
                          onClick={() => setUserMenuOpen(false)}
                          style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-icy-steel)' }}
                        >
                          <Store size={15} />
                          Seller Dashboard
                        </Link>
                        <Link 
                          to="/seller/products" 
                          onClick={() => setUserMenuOpen(false)}
                          style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-steel-mist)' }}
                        >
                          <Boxes size={15} color="var(--color-slate-caption)" />
                          Manage Catalog
                        </Link>
                        <Link 
                          to="/seller/orders" 
                          onClick={() => setUserMenuOpen(false)}
                          style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-steel-mist)' }}
                        >
                          <Package size={15} color="var(--color-slate-caption)" />
                          Fulfill Orders
                        </Link>
                        <Link 
                          to="/seller/ai/listing" 
                          onClick={() => setUserMenuOpen(false)}
                          style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-steel-mist)' }}
                        >
                          <Sparkles size={15} color="var(--color-icy-steel)" />
                          AI Listing Studio
                        </Link>
                        <Link 
                          to="/seller/approvals" 
                          onClick={() => setUserMenuOpen(false)}
                          style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-steel-mist)' }}
                        >
                          <FileCheck2 size={15} color="var(--color-slate-caption)" />
                          AI Approval Queue
                        </Link>
                      </div>
                    ) : isAdmin ? null : (
                      // Customer: show "Become a Seller" upsell
                      <div style={{ borderTop: '1px solid var(--color-border-steel)', marginTop: '4px', paddingTop: '4px' }}>
                        <Link 
                          to="/seller/onboarding" 
                          onClick={() => setUserMenuOpen(false)}
                          style={{ padding: '9px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-icy-steel)', fontWeight: 600 }}
                        >
                          <Store size={15} />
                          Become a Seller
                        </Link>
                      </div>
                    )}

                    {/* Admin Desk Submenu */}
                    {isAdmin && (
                      <div style={{ borderTop: '1px solid var(--color-iron-veil)', marginTop: '4px', paddingTop: '4px' }}>
                        <div style={{ padding: '6px 16px 2px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-ash-label)', letterSpacing: '0.06em' }}>
                          Platform Governance
                        </div>
                        <Link 
                          to="/admin" 
                          onClick={() => setUserMenuOpen(false)}
                          style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-cyan-pulse)', fontWeight: 600 }}
                        >
                          <ShieldCheck size={15} />
                          Admin Console
                        </Link>
                        <Link 
                          to="/admin/sellers" 
                          onClick={() => setUserMenuOpen(false)}
                          style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-tide-pool)' }}
                        >
                          <FileCheck2 size={15} color="var(--color-ash-label)" />
                          Seller KYC Desk
                        </Link>
                        <Link 
                          to="/admin/system" 
                          onClick={() => setUserMenuOpen(false)}
                          style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-tide-pool)' }}
                        >
                          <Cpu size={15} color="var(--color-ash-label)" />
                          System Health
                        </Link>
                      </div>
                    )}

                    <div style={{ borderTop: '1px solid var(--color-iron-veil)', marginTop: '4px', paddingTop: '4px' }}>
                      <button
                        onClick={() => {
                          logout();
                          setUserMenuOpen(false);
                        }}
                        style={{
                          padding: '10px 16px',
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          color: 'var(--color-error)',
                          textAlign: 'left',
                          width: '100%',
                          cursor: 'pointer'
                        }}
                      >
                        <LogOut size={15} />
                        Log out
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <Link 
                      to="/login" 
                      onClick={() => setUserMenuOpen(false)}
                      style={{ padding: '12px 16px', fontWeight: 600, fontSize: '13px', color: '#ffffff', display: 'block' }}
                    >
                      Sign In
                    </Link>
                    <Link 
                      to="/register" 
                      onClick={() => setUserMenuOpen(false)}
                      style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--color-tide-pool)', display: 'block' }}
                    >
                      Create Account
                    </Link>
                    <div style={{ borderTop: '1px solid var(--color-border-steel)', marginTop: '4px', paddingTop: '4px' }}>
                      <Link 
                        to="/seller/onboarding" 
                        onClick={() => setUserMenuOpen(false)}
                        style={{ padding: '10px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-icy-steel)', fontWeight: 500 }}
                      >
                        <Store size={15} />
                        Become a Seller
                      </Link>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div 
          className="mobile-nav-drawer"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: 'rgba(9, 10, 13, 0.98)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid var(--color-border-steel)',
            boxShadow: 'var(--shadow-floating)',
            zIndex: 99,
            padding: '20px 24px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            animation: 'fadeIn 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-slate-caption)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Navigation
            </span>
            <Link 
              to="/explore" 
              onClick={() => setMobileMenuOpen(false)}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
                padding: '10px 14px', 
                borderRadius: '8px', 
                backgroundColor: 'var(--color-gunmetal-dark)',
                border: '1px solid var(--color-border-steel)',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 500
              }}
            >
              <Boxes size={16} color="var(--color-icy-steel)" />
              <span>Explore Marketplace Catalog</span>
            </Link>

            {isSeller ? (
              <Link 
                to="/seller/dashboard" 
                onClick={() => setMobileMenuOpen(false)}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  padding: '10px 14px', 
                  borderRadius: '8px', 
                  backgroundColor: 'var(--color-gunmetal-dark)',
                  border: '1px solid var(--color-border-steel)',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 500
                }}
              >
                <Store size={16} color="var(--color-icy-steel)" />
                <span>Seller Operations Console</span>
              </Link>
            ) : (
              <Link 
                to="/seller/onboarding" 
                onClick={() => setMobileMenuOpen(false)}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  padding: '10px 14px', 
                  borderRadius: '8px', 
                  backgroundColor: 'var(--color-gunmetal-dark)',
                  border: '1px solid var(--color-border-steel)',
                  color: 'var(--color-icy-steel)',
                  fontSize: '13px',
                  fontWeight: 600
                }}
              >
                <Store size={16} color="var(--color-icy-steel)" />
                <span>Become a Verified Seller</span>
              </Link>
            )}

            {isAdmin && (
              <Link 
                to="/admin" 
                onClick={() => setMobileMenuOpen(false)}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  padding: '10px 14px', 
                  borderRadius: '8px', 
                  backgroundColor: 'var(--color-forest-floor)',
                  border: '1px solid var(--color-iron-veil)',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 500
                }}
              >
                <ShieldCheck size={16} color="var(--color-cyan-pulse)" />
                <span>Governance Admin Desk</span>
              </Link>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid var(--color-iron-veil)', paddingTop: '12px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-ash-label)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
              Quick Links
            </span>
            {isAuthenticated ? (
              <>
                {isCustomer && (
                  <Link 
                    to="/orders" 
                    onClick={() => setMobileMenuOpen(false)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 4px', color: 'var(--color-tide-pool)', fontSize: '13px' }}
                  >
                    <Package size={15} />
                    <span>My Orders</span>
                  </Link>
                )}
                {isCustomer && (
                  <Link 
                    to="/wishlist" 
                    onClick={() => setMobileMenuOpen(false)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 4px', color: 'var(--color-tide-pool)', fontSize: '13px' }}
                  >
                    <Heart size={15} />
                    <span>Wishlist ({wishlistCount})</span>
                  </Link>
                )}
                <Link 
                  to="/notifications" 
                  onClick={() => setMobileMenuOpen(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 4px', color: 'var(--color-tide-pool)', fontSize: '13px' }}
                >
                  <Bell size={15} />
                  <span>Notifications ({unreadNotifications})</span>
                </Link>
                <Link 
                  to="/account" 
                  onClick={() => setMobileMenuOpen(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 4px', color: 'var(--color-tide-pool)', fontSize: '13px' }}
                >
                  <User size={15} />
                  <span>Profile Settings</span>
                </Link>
                <button 
                  onClick={() => { setMobileMenuOpen(false); logout(); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 4px', color: 'var(--color-error)', fontSize: '13px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', marginTop: '4px' }}
                >
                  <LogOut size={15} />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <Link 
                  to="/login" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn-primary" 
                  style={{ flex: 1, textAlign: 'center', padding: '8px 14px', fontSize: '13px' }}
                >
                  Sign In
                </Link>
                <Link 
                  to="/register" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn-outline" 
                  style={{ flex: 1, textAlign: 'center', padding: '8px 14px', fontSize: '13px' }}
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
