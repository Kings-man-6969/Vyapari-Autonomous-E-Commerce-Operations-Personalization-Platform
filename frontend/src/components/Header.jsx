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
  PlusCircle,
  FileCheck2,
  TrendingUp,
  Cpu,
  HelpCircle,
  ChevronDown,
  Tag,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import api from '../services/api';

export const Header = () => {
  const { user, isAuthenticated, isSeller, isAdmin, logout } = useAuth();
  const { itemCount } = useCart();
  const { wishlistCount } = useWishlist();
  const [searchQuery, setSearchQuery] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
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
          const unread = res.data.data.filter((n) => !n.is_read).length;
          setUnreadNotifications(unread);
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
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 16px 36px rgba(0, 0, 0, 0.14)',
        zIndex: 1100,
        overflow: 'hidden',
        maxHeight: '440px',
        overflowY: 'auto'
      }}>
        {suggestLoading && (
          <div style={{ padding: '10px 16px', fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #f8fafc' }}>
            <Sparkles size={13} color="var(--color-primary)" />
            <span>Scanning marketplace & AI semantic embeddings...</span>
          </div>
        )}

        {/* 1. Quick Brand & Category Discovery Badges */}
        {(suggestionsData.brands?.length > 0 || suggestionsData.categories?.length > 0) && (
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '8px', flexWrap: 'wrap', backgroundColor: '#fcfcfd' }}>
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
                  borderRadius: '16px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  color: '#0f172a',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                }}
              >
                <Store size={13} color="#008489" />
                <span>Brand: {b.name}</span>
                <span style={{ color: '#64748b', fontSize: '11px', fontWeight: 500 }}>({b.count})</span>
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
                  borderRadius: '16px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                }}
              >
                <Tag size={13} color="#6366f1" />
                <span>in {c.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* 2. Suggested Queries Autocomplete */}
        {suggestionsData.suggestions?.length > 0 && (
          <div style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
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
                  color: '#1e293b',
                  cursor: 'pointer',
                  transition: 'background-color 0.1s ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Search size={14} color="#94a3b8" />
                <span style={{ fontWeight: 600 }}>{s}</span>
              </div>
            ))}
          </div>
        )}

        {/* 3. Matching Products Preview */}
        {suggestionsData.products?.length > 0 && (
          <div style={{ padding: '6px 0' }}>
            <div style={{ padding: '4px 16px 6px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.5px' }}>
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
                    transition: 'background-color 0.1s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
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
                      backgroundColor: '#f8fafc',
                      padding: '2px',
                      border: '1px solid #e2e8f0',
                      flexShrink: 0
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {prod.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        {prod.brand || prod.category_name}
                      </span>
                      {prod.rating && (
                        <span style={{ fontSize: '11px', color: '#b45309', fontWeight: 700 }}>
                          ★ {parseFloat(prod.rating).toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', flexShrink: 0 }}>
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
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            fontSize: '12.5px',
            color: '#334155',
            fontWeight: 600
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={15} color="var(--color-primary)" />
            <span>Search <strong>"{searchQuery}"</strong> with Natural Language AI</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#64748b' }}>
            <span>Press Enter</span>
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
      backgroundColor: '#ffffff',
      borderBottom: '1px solid var(--color-border-subtle)',
      boxShadow: 'var(--shadow-xs)'
    }}>
      <div className="container header-container">
        {/* Brand Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, order: 1 }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: 'var(--radius-sm)',
            background: 'linear-gradient(135deg, #FF385C 0%, #E00B41 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff'
          }}>
            <Sparkles size={20} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--color-primary)', lineHeight: 1.1 }}>
              Vyapari
            </span>
            <span style={{ fontSize: '0.62rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-text-secondary)', letterSpacing: '0.8px' }}>
              Autonomous Market
            </span>
          </div>
        </Link>

        {/* Global Desktop Search Bar (Hidden on Mobile) */}
        <div ref={desktopSearchRef} className="header-desktop-search" style={{ position: 'relative', flex: '1', maxWidth: '540px' }}>
          <form onSubmit={handleSearch} style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            background: 'var(--color-surface-subtle)',
            borderRadius: 'var(--radius-full)',
            padding: '6px 14px',
            border: isSuggestOpen ? '1px solid var(--color-primary)' : '1px solid var(--color-border-subtle)',
            boxShadow: 'var(--shadow-xs)',
            transition: 'all var(--transition-fast)'
          }}>
            <Search size={17} color="var(--color-text-secondary)" style={{ marginRight: '8px', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search or ask in Natural Language (e.g. 'headphones under 10000')..."
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
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-primary)'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setIsSuggestOpen(false);
                }}
                style={{ padding: '4px', cursor: 'pointer', color: '#94a3b8', marginRight: '4px' }}
                title="Clear input"
              >
                <X size={14} />
              </button>
            )}
            <button type="submit" aria-label="Submit search" style={{
              background: 'var(--color-primary)',
              color: '#ffffff',
              borderRadius: 'var(--radius-full)',
              width: '30px',
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Search size={13} />
            </button>
          </form>

          {renderSuggestionsDropdown()}
        </div>

        {/* Mobile Full-Width Search Bar (Visible strictly on screens < 768px) */}
        <div ref={mobileSearchRef} className="header-mobile-search" style={{ position: 'relative', width: '100%' }}>
          <form onSubmit={handleSearch} style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            background: 'var(--color-surface-subtle)',
            borderRadius: 'var(--radius-full)',
            padding: '6px 14px',
            border: isSuggestOpen ? '1px solid var(--color-primary)' : '1px solid var(--color-border-subtle)',
            boxShadow: 'var(--shadow-xs)'
          }}>
            <Search size={16} color="var(--color-text-secondary)" style={{ marginRight: '8px', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search or ask in Natural Language..."
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
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-primary)'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setIsSuggestOpen(false);
                }}
                style={{ padding: '4px', cursor: 'pointer', color: '#94a3b8', marginRight: '4px' }}
                title="Clear input"
              >
                <X size={14} />
              </button>
            )}
            <button type="submit" aria-label="Submit search" style={{
              background: 'var(--color-primary)',
              color: '#ffffff',
              borderRadius: 'var(--radius-full)',
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
                fontSize: 'var(--font-size-sm)', 
                fontWeight: 600, 
                color: 'var(--color-text-primary)',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              Explore
            </Link>

            {/* Seller Quick Entry */}
            {isSeller && (
              <Link 
                to="/seller/dashboard" 
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  fontSize: 'var(--font-size-sm)', 
                  fontWeight: 600,
                  color: 'var(--color-secondary)',
                  backgroundColor: 'var(--color-secondary-light)',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-full)'
                }}
              >
                <Store size={15} />
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
                  fontSize: 'var(--font-size-sm)', 
                  fontWeight: 600,
                  color: '#6366F1',
                  backgroundColor: '#EEF2FF',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-full)'
                }}
              >
                <ShieldCheck size={15} />
                <span>Admin Desk</span>
              </Link>
            )}
          </div>

          {/* Wishlist Link with Badge */}
          <Link 
            to="/wishlist" 
            title="My Wishlist"
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--color-border-subtle)',
              backgroundColor: '#ffffff'
            }}
          >
            <Heart size={18} color="var(--color-text-primary)" />
            {wishlistCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                backgroundColor: 'var(--color-primary)',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 700,
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {wishlistCount}
              </span>
            )}
          </Link>

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
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--color-border-subtle)',
                backgroundColor: '#ffffff'
              }}
            >
              <Bell size={18} color="var(--color-text-primary)" />
              {unreadNotifications > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  backgroundColor: 'var(--color-error)',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 700,
                  width: '18px',
                  height: '18px',
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

          {/* Cart Link with Badge */}
          <Link 
            to="/cart" 
            title="Shopping Cart"
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--color-border-subtle)',
              backgroundColor: '#ffffff'
            }}
          >
            <ShoppingBag size={18} color="var(--color-text-primary)" />
            {itemCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                backgroundColor: 'var(--color-primary)',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 700,
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {itemCount}
              </span>
            )}
          </Link>

          {/* User Profile Pill & Dropdown */}
          <div style={{ position: 'relative' }} ref={menuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '5px 12px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--color-border-subtle)',
                backgroundColor: '#ffffff'
              }}
            >
              <Menu size={16} color="var(--color-text-secondary)" />
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: isAuthenticated ? 'var(--color-primary-light)' : 'var(--color-surface-subtle)',
                color: isAuthenticated ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '12px'
              }}>
                {isAuthenticated && user.name ? user.name[0].toUpperCase() : <User size={15} />}
              </div>
            </button>

            {/* Comprehensive Dropdown Menu */}
            {userMenuOpen && (
              <div style={{
                position: 'absolute',
                right: 0,
                top: '48px',
                width: '260px',
                backgroundColor: '#ffffff',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-floating)',
                border: '1px solid var(--color-border-card)',
                padding: '8px 0',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 110
              }}>
                {isAuthenticated ? (
                  <>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <p style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>{user.name}</p>
                      <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', wordBreak: 'break-all' }}>{user.email}</p>
                      <span className="badge badge-primary" style={{ marginTop: '6px', textTransform: 'capitalize' }}>
                        {user.role}
                      </span>
                    </div>

                    {/* Customer Links */}
                    <Link 
                      to="/account" 
                      onClick={() => setUserMenuOpen(false)}
                      style={{ padding: '9px 16px', fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: '10px' }}
                    >
                      <User size={15} color="var(--color-text-secondary)" />
                      My Profile & Security
                    </Link>

                    <Link 
                      to="/orders" 
                      onClick={() => setUserMenuOpen(false)}
                      style={{ padding: '9px 16px', fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: '10px' }}
                    >
                      <Package size={15} color="var(--color-text-secondary)" />
                      My Orders
                    </Link>

                    <Link 
                      to="/account/addresses" 
                      onClick={() => setUserMenuOpen(false)}
                      style={{ padding: '9px 16px', fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: '10px' }}
                    >
                      <MapPin size={15} color="var(--color-text-secondary)" />
                      Saved Addresses
                    </Link>

                    <Link 
                      to="/wishlist" 
                      onClick={() => setUserMenuOpen(false)}
                      style={{ padding: '9px 16px', fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: '10px' }}
                    >
                      <Heart size={15} color="var(--color-text-secondary)" />
                      Wishlist ({wishlistCount})
                    </Link>

                    {/* Seller Console Submenu */}
                    {isSeller ? (
                      <div style={{ borderTop: '1px solid var(--color-border-subtle)', marginTop: '4px', paddingTop: '4px' }}>
                        <div style={{ padding: '6px 16px 2px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                          Merchant Operations
                        </div>
                        <Link 
                          to="/seller/dashboard" 
                          onClick={() => setUserMenuOpen(false)}
                          style={{ padding: '8px 16px', fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-secondary)' }}
                        >
                          <Store size={15} />
                          Seller Dashboard
                        </Link>
                        <Link 
                          to="/seller/products" 
                          onClick={() => setUserMenuOpen(false)}
                          style={{ padding: '8px 16px', fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: '10px' }}
                        >
                          <Boxes size={15} color="var(--color-text-secondary)" />
                          Manage Products
                        </Link>
                        <Link 
                          to="/seller/orders" 
                          onClick={() => setUserMenuOpen(false)}
                          style={{ padding: '8px 16px', fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: '10px' }}
                        >
                          <Package size={15} color="var(--color-text-secondary)" />
                          Fulfill Orders
                        </Link>
                        <Link 
                          to="/seller/inventory" 
                          onClick={() => setUserMenuOpen(false)}
                          style={{ padding: '8px 16px', fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: '10px' }}
                        >
                          <TrendingUp size={15} color="var(--color-text-secondary)" />
                          Inventory Velocity
                        </Link>
                        <Link 
                          to="/seller/approvals" 
                          onClick={() => setUserMenuOpen(false)}
                          style={{ padding: '8px 16px', fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: '10px' }}
                        >
                          <FileCheck2 size={15} color="var(--color-text-secondary)" />
                          AI Approval Queue
                        </Link>
                        <Link 
                          to="/seller/settings" 
                          onClick={() => setUserMenuOpen(false)}
                          style={{ padding: '8px 16px', fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: '10px' }}
                        >
                          <Settings size={15} color="var(--color-text-secondary)" />
                          Store Policies
                        </Link>
                      </div>
                    ) : (
                      <div style={{ borderTop: '1px solid var(--color-border-subtle)', marginTop: '4px', paddingTop: '4px' }}>
                        <Link 
                          to="/seller/onboarding" 
                          onClick={() => setUserMenuOpen(false)}
                          style={{ padding: '9px 16px', fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-primary)', fontWeight: 600 }}
                        >
                          <Store size={15} />
                          Become a Seller (KYC)
                        </Link>
                      </div>
                    )}

                    {/* Admin Desk Submenu */}
                    {isAdmin && (
                      <div style={{ borderTop: '1px solid var(--color-border-subtle)', marginTop: '4px', paddingTop: '4px' }}>
                        <div style={{ padding: '6px 16px 2px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                          Platform Governance
                        </div>
                        <Link 
                          to="/admin" 
                          onClick={() => setUserMenuOpen(false)}
                          style={{ padding: '8px 16px', fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: '10px', color: '#6366F1', fontWeight: 600 }}
                        >
                          <ShieldCheck size={15} />
                          Admin Console
                        </Link>
                        <Link 
                          to="/admin/users" 
                          onClick={() => setUserMenuOpen(false)}
                          style={{ padding: '8px 16px', fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: '10px' }}
                        >
                          <User size={15} color="var(--color-text-secondary)" />
                          Manage Users
                        </Link>
                        <Link 
                          to="/admin/sellers" 
                          onClick={() => setUserMenuOpen(false)}
                          style={{ padding: '8px 16px', fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: '10px' }}
                        >
                          <FileCheck2 size={15} color="var(--color-text-secondary)" />
                          Seller KYC Desk
                        </Link>
                        <Link 
                          to="/admin/system" 
                          onClick={() => setUserMenuOpen(false)}
                          style={{ padding: '8px 16px', fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: '10px' }}
                        >
                          <Cpu size={15} color="var(--color-text-secondary)" />
                          System Health
                        </Link>
                      </div>
                    )}

                    <div style={{ borderTop: '1px solid var(--color-border-subtle)', marginTop: '4px', paddingTop: '4px' }}>
                      <button
                        onClick={() => {
                          logout();
                          setUserMenuOpen(false);
                        }}
                        style={{
                          padding: '10px 16px',
                          fontSize: 'var(--font-size-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          color: 'var(--color-error)',
                          textAlign: 'left',
                          width: '100%'
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
                      style={{ padding: '12px 16px', fontWeight: 600, fontSize: 'var(--font-size-sm)', display: 'block' }}
                    >
                      Sign In
                    </Link>
                    <Link 
                      to="/register" 
                      onClick={() => setUserMenuOpen(false)}
                      style={{ padding: '10px 16px', fontSize: 'var(--font-size-sm)', display: 'block' }}
                    >
                      Create Account
                    </Link>
                    <div style={{ borderTop: '1px solid var(--color-border-subtle)', marginTop: '4px', paddingTop: '4px' }}>
                      <Link 
                        to="/seller/onboarding" 
                        onClick={() => setUserMenuOpen(false)}
                        style={{ padding: '10px 16px', fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-secondary)', fontWeight: 600 }}
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
    </header>
  );
};
