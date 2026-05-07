import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiFetch } from '@/services/api'

/*
  CUSTOMER NAV — upgraded
  - Live search dropdown with debounced suggestions
  - Wishlist heart with count
  - Accessible dropdown menu
  - Mobile-responsive
  Playfair Display brand, Source Sans 3 body
*/

const RECENT_KEY = 'vyapari_recent_searches'

function getRecentSearches() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').slice(0, 5) } catch { return [] }
}
function saveSearch(q) {
  try {
    const existing = getRecentSearches().filter(s => s !== q)
    localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...existing].slice(0, 5)))
  } catch { /* noop */ }
}

export default function CustomerNav({ cartCount = 0, wishlistCount = 0, role, onLogout, userId }) {
  const [query, setQuery]         = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [recentSearches, setRecentSearches] = useState(getRecentSearches())
  const [searchFocused, setSearchFocused] = useState(false)
  const [menuOpen, setMenuOpen]   = useState(false)
  const navigate  = useNavigate()
  const menuRef   = useRef(null)
  const searchRef = useRef(null)
  const debounceRef = useRef(null)

  // Debounced search suggestions
  useEffect(() => {
    if (query.trim().length < 2) { setSuggestions([]); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await apiFetch(`/search?q=${encodeURIComponent(query.trim())}&top_n=5`)
        setSuggestions((data.results || []).slice(0, 5))
      } catch { setSuggestions([]) }
    }, 350)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  // Close menu on outside click
  useEffect(() => {
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchFocused(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleSearch(e) {
    e.preventDefault()
    const q = query.trim()
    if (q.length >= 2) {
      saveSearch(q)
      setRecentSearches(getRecentSearches())
      setSearchFocused(false)
      navigate(`/shop/search?q=${encodeURIComponent(q)}`)
    }
  }

  function pickSuggestion(productId, name) {
    setSearchFocused(false)
    setSuggestions([])
    navigate(`/shop/product/${productId}`)
  }

  function pickRecent(q) {
    setQuery(q)
    setSearchFocused(false)
    navigate(`/shop/search?q=${encodeURIComponent(q)}`)
  }

  const showDropdown = searchFocused && (suggestions.length > 0 || recentSearches.length > 0 || query.length === 0)

  return (
    <nav className="customer-nav" role="navigation" aria-label="Store navigation">
      {/* Brand */}
      <Link to="/shop" className="customer-nav-brand" aria-label="Vyapari home">
        <div className="customer-nav-logo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
            <path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
        </div>
        <div className="hide-mobile">
          <div className="customer-brand-name">Vyapari</div>
          <div className="customer-brand-tag">Store</div>
        </div>
      </Link>

      {/* Search with live dropdown */}
      <div ref={searchRef} style={{ flex: 1, maxWidth: 520, position: 'relative' }}>
        <form className="customer-nav-search" onSubmit={handleSearch} role="search">
          <span className="search-icon" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
          </span>
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            placeholder="Search products, brands, categories…"
            aria-label="Search products"
            aria-autocomplete="list"
            aria-expanded={showDropdown}
            autoComplete="off"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => { setQuery(''); setSuggestions([]) }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(167,243,208,.4)', padding: '0 8px',
                fontSize: 16, lineHeight: 1, display: 'flex', alignItems: 'center',
              }}
              aria-label="Clear search"
            >×</button>
          )}
        </form>

        {/* Search dropdown */}
        {showDropdown && (
          <div
            role="listbox"
            className="animate-fade-in"
            style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
              background: '#0d1f14',
              border: '1px solid rgba(52,211,153,.18)',
              borderRadius: 12,
              boxShadow: '0 16px 48px rgba(0,0,0,.6)',
              zIndex: 400,
              overflow: 'hidden',
            }}
          >
            {/* Live suggestions */}
            {suggestions.length > 0 && (
              <div>
                <div style={{ padding: '8px 14px 4px', fontSize: 10, fontWeight: 700, color: 'rgba(167,243,208,.35)', letterSpacing: '.08em', fontFamily: "'Source Sans 3', sans-serif", textTransform: 'uppercase' }}>
                  Products
                </div>
                {suggestions.map(p => (
                  <div
                    key={p.product_id}
                    role="option"
                    onClick={() => pickSuggestion(p.product_id, p.name)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px',
                      cursor: 'pointer',
                      transition: 'background 120ms',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52,211,153,.06)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <span style={{ fontSize: 18 }}>{{'Electronics':'💻','Clothing':'👕','Books':'📚','Home & Kitchen':'🏠','Sports':'⚽'}[p.category] || '📦'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#d1fae5', fontSize: 13, fontFamily: "'Source Sans 3', sans-serif", fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                      <div style={{ color: 'rgba(167,243,208,.4)', fontSize: 11, fontFamily: "'Source Sans 3', sans-serif" }}>{p.category}</div>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#34d399', fontFamily: "'Source Sans 3', sans-serif", flexShrink: 0 }}>₹{Number(p.price).toFixed(0)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Recent searches */}
            {recentSearches.length > 0 && query.length === 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px 4px' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(167,243,208,.35)', letterSpacing: '.08em', fontFamily: "'Source Sans 3', sans-serif", textTransform: 'uppercase' }}>Recent</span>
                  <button
                    onClick={() => { localStorage.removeItem(RECENT_KEY); setRecentSearches([]) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(167,243,208,.3)', fontSize: 10, fontFamily: "'Source Sans 3', sans-serif" }}
                  >Clear</button>
                </div>
                {recentSearches.map(q => (
                  <div
                    key={q}
                    role="option"
                    onClick={() => pickRecent(q)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 14px', cursor: 'pointer',
                      transition: 'background 120ms',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52,211,153,.06)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(167,243,208,.3)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                    <span style={{ color: 'rgba(167,243,208,.6)', fontSize: 13, fontFamily: "'Source Sans 3', sans-serif" }}>{q}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        {/* Wishlist */}
        <Link
          to="/shop/wishlist"
          className="cust-icon-btn"
          title="Wishlist"
          aria-label={`Wishlist${wishlistCount > 0 ? `, ${wishlistCount} items` : ''}`}
          style={{ position: 'relative' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          {wishlistCount > 0 && (
            <span className="cust-cart-badge" style={{ background: '#e11d48' }}>
              {wishlistCount > 9 ? '9+' : wishlistCount}
            </span>
          )}
        </Link>

        {/* Cart */}
        <Link
          to="/shop/cart"
          className="cust-icon-btn"
          title={`Cart (${cartCount})`}
          aria-label={`Shopping cart, ${cartCount} item${cartCount !== 1 ? 's' : ''}`}
          style={{ position: 'relative' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" />
            <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
          </svg>
          {cartCount > 0 && (
            <span className="cust-cart-badge">{cartCount > 99 ? '99+' : cartCount}</span>
          )}
        </Link>

        {/* Account menu */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="cust-icon-btn"
            aria-label="Account menu"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              background: 'linear-gradient(135deg,#059669,#34d399)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800, color: '#fff',
              fontFamily: "'Source Sans 3', sans-serif",
            }}>
              {userId ? userId[0]?.toUpperCase() : role?.[0]?.toUpperCase() || '?'}
            </div>
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="animate-fade-in"
              style={{
                position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                minWidth: 200,
                background: '#0d1f14',
                border: '1px solid rgba(52,211,153,.18)',
                borderRadius: 'var(--r-lg)',
                boxShadow: '0 16px 48px rgba(0,0,0,.6)',
                overflow: 'hidden', zIndex: 300,
              }}
            >
              <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid rgba(52,211,153,.08)' }}>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'rgba(167,243,208,.45)', fontFamily: "'Source Sans 3',sans-serif" }}>Signed in as</div>
                <div style={{ fontWeight: 700, color: '#d1fae5', fontSize: 'var(--fs-sm)', textTransform: 'capitalize', fontFamily: "'Source Sans 3',sans-serif", marginTop: 2 }}>{role || 'Customer'}</div>
              </div>

              {[
                { to: '/shop/orders',  label: 'My Orders',        icon: '📋' },
                { to: '/shop/wishlist',label: 'My Wishlist',      icon: '♡' },
                { to: '/shop/profile', label: 'Account Settings', icon: '⚙' },
              ].map(item => (
                <Link
                  key={item.to}
                  to={item.to}
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 16px',
                    color: '#d1fae5', fontSize: 'var(--fs-sm)', textDecoration: 'none',
                    fontFamily: "'Source Sans 3',sans-serif",
                    transition: 'background 150ms',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.05)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ fontSize: 14 }}>{item.icon}</span>
                  {item.label}
                </Link>
              ))}

              <div style={{ height: 1, background: 'rgba(52,211,153,.1)', margin: '4px 0' }} />
              <button
                role="menuitem"
                onClick={() => { setMenuOpen(false); onLogout() }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '10px 16px',
                  border: 'none', background: 'transparent',
                  color: '#f87171', fontSize: 'var(--fs-sm)', fontWeight: 600,
                  textAlign: 'left', cursor: 'pointer',
                  fontFamily: "'Source Sans 3',sans-serif",
                  transition: 'background 150ms',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,.08)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
