import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { apiFetch, getSessionId } from '../../services/api';

/* ─── DESIGN.MD — nav-bar-light ───
   White bg, black ink text, pill hover links, aloe count badges,
   solid-black pill for Sign In CTA
──────────────────────────────────── */

export default function CustomerNav({ cartCount = 0, wishlistCount = 0, userName, onLogout, token, role }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => {
    if (searchOpen && searchRef.current) searchRef.current.focus();
  }, [searchOpen]);

  function handleSearch(e) {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/shop/search?q=${encodeURIComponent(query.trim())}`);
      setSearchOpen(false);
      setQuery('');
    }
  }

  const navLinkStyle = ({ isActive }) => ({
    padding: '7px 16px',
    borderRadius: 9999,
    fontSize: 15,
    fontWeight: 420,
    color: isActive ? '#000000' : '#71717a',
    textDecoration: 'none',
    transition: 'background 0.18s, color 0.18s',
    background: isActive ? 'rgba(0,0,0,0.07)' : 'transparent',
    fontFamily: "'Inter', Helvetica, Arial, sans-serif",
    fontFeatureSettings: '"ss03"',
  });

  return (
    <>
      <nav
        className={`c-nav${scrolled ? ' scrolled' : ''}`}
        style={{ height: 64 }}
      >
        {/* Wordmark */}
        <Link to="/shop" className="c-nav-brand">
          Vyapari
        </Link>

        {/* Center nav links */}
        <div className="c-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <NavLink to="/shop"          end   style={navLinkStyle}>Home</NavLink>
          <NavLink to="/shop/products"       style={navLinkStyle}>Shop</NavLink>
          {token && <NavLink to="/shop/orders" style={navLinkStyle}>Orders</NavLink>}
        </div>

        {/* Right actions */}
        <div className="c-nav-actions">
          {/* Search */}
          <button
            className="c-icon-btn"
            onClick={() => setSearchOpen(!searchOpen)}
            aria-label="Search"
          >
            <SearchIcon />
          </button>

          {/* Wishlist */}
          <Link to="/shop/wishlist" className="c-icon-btn" aria-label={`Wishlist (${wishlistCount})`}>
            <HeartIcon />
            {wishlistCount > 0 && <span className="c-badge">{wishlistCount}</span>}
          </Link>

          {/* Cart */}
          <Link to="/shop/cart" className="c-icon-btn" aria-label={`Cart (${cartCount})`}>
            <CartIcon />
            {cartCount > 0 && <span className="c-badge">{cartCount}</span>}
          </Link>

          {/* Auth */}
          {token ? (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setAccountOpen(!accountOpen)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 14px 6px 8px',
                  borderRadius: 9999,
                  background: 'transparent',
                  border: '1px solid #e4e4e7',
                  color: '#000000',
                  cursor: 'pointer',
                  transition: 'background 0.18s',
                  fontFamily: "'Inter', Helvetica, Arial, sans-serif",
                  fontSize: 14, fontWeight: 420,
                  fontFeatureSettings: '"ss03"',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {/* Avatar initial */}
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: '#c1fbd4',     /* aloe */
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 550, color: '#000',
                  fontFeatureSettings: '"ss03"',
                }}>
                  {userName?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <span style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {userName}
                </span>
                <span style={{ fontSize: 10, color: '#a1a1aa' }}>▾</span>
              </button>

              {accountOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                  background: '#ffffff',
                  border: '1px solid #e4e4e7',
                  borderRadius: 12,
                  padding: 6,
                  minWidth: 170,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)',
                  zIndex: 200,
                  animation: 'floatIn 0.18s ease',
                }}>
                  {[
                    ...(role === 'admin' ? [{ to: '/admin/overview', label: '🛡️ Platform Vitals' }] : []),
                    ...(role === 'seller' ? [{ to: '/seller/overview', label: '🏪 Seller Ops' }] : []),
                    { to: '/shop/profile',  label: 'Profile' },
                    { to: '/shop/orders',   label: 'My Orders' },
                    { to: '/shop/wishlist', label: 'Wishlist' },
                  ].map(item => (
                    <Link key={item.to} to={item.to}
                      onClick={() => setAccountOpen(false)}
                      style={{
                        display: 'block', padding: '9px 12px',
                        borderRadius: 8, textDecoration: 'none',
                        fontSize: 14, fontWeight: 420, color: '#52525b',
                        transition: 'background 0.15s, color 0.15s',
                        fontFamily: "'Inter', Helvetica, Arial, sans-serif",
                        fontFeatureSettings: '"ss03"',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#f5f5f5'; e.currentTarget.style.color = '#000'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#52525b'; }}
                    >{item.label}</Link>
                  ))}
                  <div style={{ height: 1, background: '#e4e4e7', margin: '4px 0' }} />
                  <button onClick={() => { setAccountOpen(false); onLogout?.(); }}
                    style={{
                      display: 'block', width: '100%', padding: '9px 12px',
                      borderRadius: 8, textAlign: 'left',
                      fontSize: 14, fontWeight: 420, color: '#52525b',
                      background: 'none', border: 'none', cursor: 'pointer',
                      transition: 'background 0.15s, color 0.15s',
                      fontFamily: "'Inter', Helvetica, Arial, sans-serif",
                      fontFeatureSettings: '"ss03"',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#991b1b'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#52525b'; }}
                  >Sign out</button>
                </div>
              )}
            </div>
          ) : (
            /* button-primary-pill: solid black */
            <Link to="/login" style={{
              padding: '9px 20px', borderRadius: 9999,
              background: '#000000', color: '#ffffff',
              fontFamily: "'Inter', Helvetica, Arial, sans-serif",
              fontSize: 15, fontWeight: 420,
              textDecoration: 'none',
              transition: 'background 0.18s',
              fontFeatureSettings: '"ss03"',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#3f3f46'}
            onMouseLeave={e => e.currentTarget.style.background = '#000000'}
            >Sign in</Link>
          )}

          {/* Hamburger — mobile */}
          <button
            className="c-nav-hamburger"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="c-nav-mobile-menu" onClick={() => setMenuOpen(false)}>
          <NavLink to="/shop"          end   className="c-nav-mobile-link" onClick={() => setMenuOpen(false)}>Home</NavLink>
          <NavLink to="/shop/products"       className="c-nav-mobile-link" onClick={() => setMenuOpen(false)}>Shop</NavLink>
          {token && <>
            {role === 'admin' && <NavLink to="/admin/overview" className="c-nav-mobile-link" onClick={() => setMenuOpen(false)}>🛡️ Platform Vitals</NavLink>}
            {role === 'seller' && <NavLink to="/seller/overview" className="c-nav-mobile-link" onClick={() => setMenuOpen(false)}>🏪 Seller Ops</NavLink>}
            <NavLink to="/shop/orders"   className="c-nav-mobile-link" onClick={() => setMenuOpen(false)}>Orders</NavLink>
            <NavLink to="/shop/wishlist" className="c-nav-mobile-link" onClick={() => setMenuOpen(false)}>Wishlist</NavLink>
            <NavLink to="/shop/profile"  className="c-nav-mobile-link" onClick={() => setMenuOpen(false)}>Profile</NavLink>
            <div style={{ height: 1, background: '#e4e4e7', margin: '8px 0' }} />
            <button onClick={() => { setMenuOpen(false); onLogout?.(); }}
              style={{
                display: 'block', width: '100%', padding: '12px 16px',
                borderRadius: 9999, textAlign: 'left',
                fontSize: 15, fontWeight: 420, color: '#991b1b',
                background: '#fee2e2', border: 'none', cursor: 'pointer',
                fontFamily: "'Inter', Helvetica, Arial, sans-serif",
                fontFeatureSettings: '"ss03"',
              }}
            >Sign out</button>
          </>}
          {!token && (
            <Link to="/login"
              className="c-nav-mobile-link"
              onClick={() => setMenuOpen(false)}
              style={{ background: '#000000', color: '#ffffff', borderRadius: 9999, textAlign: 'center' }}
            >Sign in</Link>
          )}
        </div>
      )}

      {/* Search overlay */}
      {searchOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999,
          background: 'rgba(251,251,245,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          paddingTop: '15vh',
          animation: 'fadeIn 0.15s ease',
        }}
        onClick={e => { if (e.target === e.currentTarget) setSearchOpen(false); }}
        >
          <form onSubmit={handleSearch} style={{ width: '100%', maxWidth: 560, margin: '0 24px' }}>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
                color: '#a1a1aa', display: 'flex', alignItems: 'center',
              }}><SearchIcon /></span>
              <input
                ref={searchRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search products…"
                style={{
                  width: '100%', padding: '16px 20px 16px 48px',
                  fontSize: 18, fontWeight: 420,
                  background: '#ffffff',
                  border: '1px solid #000000',
                  borderRadius: 9999,
                  color: '#000000',
                  outline: 'none',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                  fontFamily: "'Inter', Helvetica, Arial, sans-serif",
                  fontFeatureSettings: '"ss03"',
                }}
              />
              <button type="button" onClick={() => setSearchOpen(false)}
                style={{
                  position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                  background: '#f5f5f5', border: '1px solid #e4e4e7',
                  borderRadius: 9999, color: '#71717a', cursor: 'pointer',
                  padding: '5px 12px', fontSize: 11,
                  fontFamily: "'Inter', Helvetica, Arial, sans-serif",
                  fontFeatureSettings: '"ss03"',
                }}
              >ESC</button>
            </div>
            <p style={{
              marginTop: 10, fontSize: 13, color: '#a1a1aa',
              textAlign: 'center',
              fontFamily: "'Inter', Helvetica, Arial, sans-serif",
              fontFeatureSettings: '"ss03"',
            }}>
              Press Enter to search
            </p>
          </form>
        </div>
      )}
    </>
  );
}

function SearchIcon() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/></svg>; }
function HeartIcon()  { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>; }
function CartIcon()   { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>; }
