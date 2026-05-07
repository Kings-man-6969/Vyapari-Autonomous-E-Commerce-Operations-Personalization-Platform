import React, { useCallback, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ToastProvider } from '@/shared/components/Toast'
import Sidebar from '@/shared/components/Sidebar'
import Topbar from '@/shared/components/Topbar'
import CustomerNav from '@/shared/components/CustomerNav'
import { SpinnerPage } from '@/shared/components/Spinner'
import { apiFetch, bootstrapSession, clearAccessToken, setAccessToken } from '@/services/api'
import LoginPage from '@/features/auth/LoginPage'

// Seller pages
import SellerOverview from '@/features/seller/SellerOverview'
import SellerInventory from '@/features/seller/SellerInventory'
import SellerPricing from '@/features/seller/SellerPricing'
import SellerReviewManager from '@/features/seller/SellerReviewManager'
import SellerOrders from '@/features/seller/SellerOrders'
import SellerFinance from '@/features/seller/SellerFinance'
import SellerSettings from '@/features/seller/SellerSettings'
import SellerAIAssistant from '@/features/seller/SellerAIAssistant'

// HITL pages
import HitlQueue from '@/features/hitl/HitlQueue'
import HitlDecisionDetail from '@/features/hitl/HitlDecisionDetail'
import HitlHistory from '@/features/hitl/HitlHistory'
import HitlAnalytics from '@/features/hitl/HitlAnalytics'

// Admin pages
import AdminLayout from '@/features/admin/AdminLayout'
import AdminOverview from '@/features/admin/AdminOverview'
import AdminUsers from '@/features/admin/AdminUsers'
import AdminModeration from '@/features/admin/AdminModeration'

// Customer pages
import CustomerHome from '@/features/customer/CustomerHome'
import CustomerProductDetail from '@/features/customer/CustomerProductDetail'
import CustomerCart from '@/features/customer/CustomerCart'
import CustomerSearch from '@/features/customer/CustomerSearch'
import CustomerCheckout from '@/features/customer/CustomerCheckout'
import CustomerOrders from '@/features/customer/CustomerOrders'
import CustomerWishlist from '@/features/customer/CustomerWishlist'
import CustomerProfile from '@/features/customer/CustomerProfile'

import '@/customer.css'

/* ─── Persistent session ID for guest cart ──────────────────── */
function getSessionId(userId) {
  if (userId) return userId
  let id = localStorage.getItem('vyapari_session_id')
  if (!id) {
    id = 'sess_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
    localStorage.setItem('vyapari_session_id', id)
  }
  return id
}

export default function App() {
  const [token, setToken]   = useState('')
  const [role, setRole]     = useState('')
  const [userId, setUserId] = useState('')
  const [ready, setReady]   = useState(false)

  const isPrivileged = role === 'seller' || role === 'admin'
  const isCustomer   = role === 'customer'
  const sessionId    = getSessionId(userId)

  useEffect(() => {
    let mounted = true
    bootstrapSession()
      .then(async (session) => {
        if (!mounted) return
        if (!session?.access_token) { setReady(true); return }
        setToken(session.access_token)
        setAccessToken(session.access_token)
        setRole(session.role || '')
        if (session.user_id) setUserId(session.user_id)
        try {
          const me = await apiFetch('/auth/me', {}, session.access_token, false)
          if (mounted && me?.account_type) setRole(me.account_type)
          if (mounted && me?.user_id)      setUserId(me.user_id)
        } catch {
          if (mounted) { clearAccessToken(); setToken(''); setRole(''); setUserId('') }
        }
        if (mounted) setReady(true)
      })
      .catch(() => { if (mounted) setReady(true) })
    return () => { mounted = false }
  }, [])

  async function handleLogin(email, password) {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setAccessToken(data.access_token)
    setToken(data.access_token)
    setRole(data.role)
    setUserId(data.user_id || '')
  }

  async function handleLogout() {
    try { await apiFetch('/auth/logout', { method: 'POST' }, token, false) } catch { /* best effort */ }
    clearAccessToken()
    setToken(''); setRole(''); setUserId('')
  }

  if (!ready) return <SpinnerPage message="Restoring session…" />

  if (!token) {
    return (
      <ToastProvider>
        <LoginPage onLogin={handleLogin} />
      </ToastProvider>
    )
  }

  if (isCustomer) {
    return (
      <ToastProvider>
        <BrowserRouter>
          <CustomerShell
            role={role}
            token={token}
            userId={userId}
            sessionId={sessionId}
            onLogout={handleLogout}
          />
        </BrowserRouter>
      </ToastProvider>
    )
  }

  if (role === 'admin') {
    return (
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/admin" element={<AdminLayout token={token} role={role} onLogout={handleLogout} />}>
              <Route index element={<Navigate to="overview" replace />} />
              <Route path="overview" element={<AdminOverview token={token} />} />
              <Route path="users" element={<AdminUsers token={token} />} />
              <Route path="moderation" element={<AdminModeration token={token} />} />
            </Route>
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    )
  }

  if (isPrivileged) {
    return (
      <ToastProvider>
        <BrowserRouter>
          <SellerShell role={role} onLogout={handleLogout} token={token} />
        </BrowserRouter>
      </ToastProvider>
    )
  }

  // Unknown role
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 16, padding: 32, textAlign: 'center', background: 'var(--c-bg)' }}>
      <div style={{ fontSize: 48 }}>🔒</div>
      <h2 style={{ color: 'var(--c-text)' }}>Access Denied</h2>
      <p style={{ color: 'var(--c-text-muted)', maxWidth: 340, lineHeight: 1.6 }}>
        This app is restricted to registered accounts.<br />
        You signed in as <strong>{role || 'unknown'}</strong>.
      </p>
      <button onClick={handleLogout} className="btn btn-secondary">Sign in with a different account</button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   CUSTOMER SHELL
═══════════════════════════════════════════════════════════ */
function CustomerShell({ role, token, userId, sessionId, onLogout }) {
  const [cartCount, setCartCount] = useState(0)
  const [wishlistCount, setWishlistCount] = useState(0)

  // Refresh wishlist count when token changes
  useEffect(() => {
    if (!token) return
    apiFetch('/wishlist', {}, token)
      .then(d => setWishlistCount(Array.isArray(d) ? d.length : 0))
      .catch(() => {})
  }, [token])

  const handleAddToCart = useCallback(async (productId, qty) => {
    await apiFetch(`/cart/add?session_id=${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      body: JSON.stringify({ product_id: productId, qty }),
    })
    // Refresh count
    const cart = await apiFetch(`/cart?session_id=${encodeURIComponent(sessionId)}`)
    setCartCount(cart.items?.length || 0)
  }, [sessionId])

  return (
    <>
      <CustomerNav
        cartCount={cartCount}
        wishlistCount={wishlistCount}
        role={role}
        onLogout={onLogout}
        userId={userId}
      />
      <Routes>
        <Route path="/"                         element={<Navigate to="/shop" replace />} />
        <Route path="/shop"                     element={<CustomerHome sessionId={sessionId} onAddToCart={handleAddToCart} />} />
        <Route path="/shop/product/:productId"  element={<CustomerProductDetail sessionId={sessionId} token={token} userId={userId} onAddToCart={handleAddToCart} />} />
        <Route path="/shop/cart"                element={<CustomerCart sessionId={sessionId} onCartUpdate={setCartCount} />} />
        <Route path="/shop/search"              element={<CustomerSearch onAddToCart={handleAddToCart} />} />
        <Route path="/shop/checkout"            element={token ? <CustomerCheckout sessionId={sessionId} token={token} onCartUpdate={setCartCount} /> : <Navigate to="/" replace />} />
        <Route path="/shop/orders"              element={token ? <CustomerOrders token={token} /> : <Navigate to="/" replace />} />
        <Route path="/shop/wishlist"            element={token ? <CustomerWishlist token={token} onAddToCart={handleAddToCart} /> : <Navigate to="/" replace />} />
        <Route path="/shop/profile"             element={token ? <CustomerProfile token={token} /> : <Navigate to="/" replace />} />
        <Route path="*"                         element={<Navigate to="/shop" replace />} />
      </Routes>
    </>
  )
}

/* ═══════════════════════════════════════════════════════════
   SELLER / ADMIN SHELL
═══════════════════════════════════════════════════════════ */
function SellerShell({ role, onLogout, token }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  const pageTitles = {
    '/seller/overview':  'Dashboard Overview',
    '/seller/inventory': 'Inventory Management',
    '/seller/pricing':   'Pricing Control',
    '/seller/reviews':   'Review Manager',
    '/seller/orders':    'Order Management',
    '/seller/finance':   'Financial Dashboard',
    '/seller/settings':  'Store Settings',
    '/seller/agent':     'AI Assistant',
    '/hitl':             'Decision Queue',
    '/hitl/history':     'Decision History',
    '/hitl/analytics':   'HITL Analytics',
  }
  const pageTitle = Object.entries(pageTitles).find(([path]) =>
    path === '/hitl' ? location.pathname === '/hitl' : location.pathname.startsWith(path)
  )?.[1] || 'Vyapari Console'

  return (
    <div className="app-layout">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="app-main">
        <Topbar
          role={role}
          token={token}
          onLogout={onLogout}
          onMenuToggle={() => setSidebarOpen((v) => !v)}
          pageTitle={pageTitle}
        />
        <main className="app-content page-enter">
          <Routes>
            <Route path="/"                                  element={<Navigate to="/seller/overview" replace />} />
            <Route path="/seller"                            element={<Navigate to="/seller/overview" replace />} />
            <Route path="/seller/overview"                   element={<SellerOverview token={token} />} />
            <Route path="/seller/inventory"                  element={<SellerInventory token={token} />} />
            <Route path="/seller/pricing"                    element={<SellerPricing token={token} />} />
            <Route path="/seller/reviews"                    element={<SellerReviewManager token={token} />} />
            <Route path="/seller/orders"                     element={<SellerOrders token={token} />} />
            <Route path="/seller/finance"                    element={<SellerFinance token={token} />} />
            <Route path="/seller/settings"                   element={<SellerSettings token={token} />} />
            <Route path="/seller/agent"                      element={<SellerAIAssistant token={token} />} />
            <Route path="/hitl"                              element={<HitlQueue token={token} />} />
            <Route path="/hitl/decision/:decisionId"         element={<HitlDecisionDetail token={token} />} />
            <Route path="/hitl/history"                      element={<HitlHistory token={token} />} />
            <Route path="/hitl/analytics"                    element={<HitlAnalytics token={token} />} />
            <Route path="*"                                  element={<Navigate to="/seller/overview" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
