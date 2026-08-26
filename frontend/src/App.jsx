import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ToastProvider } from './shared/hooks/useToast';
import Toast from './shared/components/Toast';
import { bootstrapSession, clearAccessToken, apiFetch, getSessionId } from './services/api';

// Layout components
import Sidebar from './shared/components/Sidebar';
import Topbar from './shared/components/Topbar';
import CustomerNav from './shared/components/CustomerNav';
import { SpinnerPage } from './shared/components/Spinner';

// Landing + Auth
import LandingPage from './features/landing/LandingPage';
import AuthPage from './features/auth/AuthPage';

// Customer pages
import CustomerHome from './features/customer/CustomerHome';
import CustomerProducts from './features/customer/CustomerProducts';
import CustomerProductDetail from './features/customer/CustomerProductDetail';
import CustomerCart from './features/customer/CustomerCart';
import CustomerCheckout from './features/customer/CustomerCheckout';
import CustomerOrders from './features/customer/CustomerOrders';
import CustomerWishlist from './features/customer/CustomerWishlist';
import CustomerSearch from './features/customer/CustomerSearch';
import CustomerProfile from './features/customer/CustomerProfile';

// Seller pages
import SellerOverview from './features/seller/SellerOverview';
import SellerInventory from './features/seller/SellerInventory';
import SellerPricing from './features/seller/SellerPricing';
import SellerReviewManager from './features/seller/SellerReviewManager';
import SellerOrders from './features/seller/SellerOrders';
import SellerAnalytics from './features/seller/SellerAnalytics';
import SellerFinance from './features/seller/SellerFinance';
import SellerAddProduct from './features/seller/SellerAddProduct';
import SellerSettings from './features/seller/SellerSettings';
import SellerAIAssistant from './features/seller/SellerAIAssistant';

// HITL pages
import HitlQueue from './features/hitl/HitlQueue';
import HitlDecisionDetail from './features/hitl/HitlDecisionDetail';
import HitlHistory from './features/hitl/HitlHistory';
import HitlAnalytics from './features/hitl/HitlAnalytics';

// Admin pages
import AdminOverview from './features/admin/AdminOverview';
import AdminUsers from './features/admin/AdminUsers';
import AdminModeration from './features/admin/AdminModeration';

function CustomerLayout({ auth, onLogout, cartCount, wishlistCount }) {
  return (
    <div className="customer-root">
      <CustomerNav
        cartCount={cartCount}
        wishlistCount={wishlistCount}
        userName={auth?.name}
        onLogout={onLogout}
        token={auth?.token}
        role={auth?.role}
      />
      <Outlet />
    </div>
  );
}

function OperationalLayout({ auth, onLogout, pendingHitlCount }) {
  return (
    <div className="app-layout">
      <Sidebar role={auth?.role} pendingCount={pendingHitlCount} />
      <div className="app-main">
        <Topbar role={auth?.role} userName={auth?.name} onLogout={onLogout} />
        <div className="app-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState(null); // { token, role, userId, name }
  const [ready, setReady] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [pendingHitlCount, setPendingHitlCount] = useState(0);

  useEffect(() => {
    bootstrapSession().then(session => {
      if (session) {
        setAuth({ token: session.access_token, role: session.role, userId: session.user_id, name: session.name });
      }
      setReady(true);
    });
  }, []);

  const refreshCounts = useCallback(async () => {
    if (!auth?.token) return;
    try {
      const sessionId = getSessionId(auth.userId);
      if (auth.role === 'customer') {
        const [cartData, wishlistData] = await Promise.allSettled([
          apiFetch(`/cart?session_id=${sessionId}`),
          apiFetch(`/wishlist?session_id=${sessionId}`),
        ]);
        if (cartData.status === 'fulfilled' && cartData.value) {
          setCartCount(cartData.value.items?.length ?? 0);
        }
        if (wishlistData.status === 'fulfilled' && wishlistData.value) {
          setWishlistCount(wishlistData.value.items?.length ?? 0);
        }
      } else {
        const data = await apiFetch('/hitl/decisions?status=pending&per_page=100').catch(() => null);
        if (data) setPendingHitlCount(data.total ?? data.items?.length ?? 0);
      }
    } catch {}
  }, [auth]);

  useEffect(() => {
    if (auth) refreshCounts();
  }, [auth, refreshCounts]);

  function handleLogin(session) {
    setAuth({ token: session.access_token, role: session.role, userId: session.user_id, name: session.name });
  }

  function handleLogout() {
    clearAccessToken();
    setAuth(null);
    setCartCount(0);
    setWishlistCount(0);
  }

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0b0f' }}>
        <SpinnerPage message="Starting Vyapari..." />
      </div>
    );
  }

  const isAdmin = auth && auth.role === 'admin';
  const isSeller = auth && auth.role === 'seller';
  const isCustomer = auth && auth.role === 'customer';
  const isSellerOrAdmin = isAdmin || isSeller;

  const sessionId = getSessionId(auth?.userId);
  const sharedCustomerProps = {
    token: auth?.token,
    userId: auth?.userId,
    role: auth?.role,
    sessionId,
    onLogout: handleLogout,
    cartCount,
    wishlistCount,
    onCartChange: refreshCounts,
  };

  const sharedOperationalProps = {
    token: auth?.token,
    userId: auth?.userId,
    role: auth?.role,
  };

  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          {/* Public root landing / auth */}
          <Route path="/" element={
            isAdmin ? <Navigate to="/admin/overview" replace /> :
            isSeller ? <Navigate to="/seller/overview" replace /> :
            isCustomer ? <Navigate to="/shop" replace /> :
            <LandingPage />
          } />
          <Route path="/login" element={
            isAdmin ? <Navigate to="/admin/overview" replace /> :
            isSeller ? <Navigate to="/seller/overview" replace /> :
            isCustomer ? <Navigate to="/shop" replace /> :
            <AuthPage onLogin={handleLogin} />
          } />
          <Route path="/register" element={
            isAdmin ? <Navigate to="/admin/overview" replace /> :
            isSeller ? <Navigate to="/seller/overview" replace /> :
            isCustomer ? <Navigate to="/shop" replace /> :
            <AuthPage onLogin={handleLogin} initialMode="register" />
          } />

          {/* Customer Storefront Routes */}
          <Route path="/shop" element={
            <CustomerLayout
              auth={isCustomer ? auth : null}
              onLogout={handleLogout}
              cartCount={cartCount}
              wishlistCount={wishlistCount}
            />
          }>
            <Route index element={<CustomerHome {...sharedCustomerProps} />} />
            <Route path="products" element={<CustomerProducts {...sharedCustomerProps} />} />
            <Route path="product/:productId" element={<CustomerProductDetail {...sharedCustomerProps} />} />
            <Route path="cart" element={<CustomerCart {...sharedCustomerProps} />} />
            <Route path="search" element={<CustomerSearch {...sharedCustomerProps} />} />
            <Route path="checkout" element={auth?.token ? <CustomerCheckout {...sharedCustomerProps} /> : <Navigate to="/login" replace />} />
            <Route path="orders" element={auth?.token ? <CustomerOrders {...sharedCustomerProps} /> : <Navigate to="/login" replace />} />
            <Route path="wishlist" element={auth?.token ? <CustomerWishlist {...sharedCustomerProps} /> : <Navigate to="/login" replace />} />
            <Route path="profile" element={auth?.token ? <CustomerProfile {...sharedCustomerProps} /> : <Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/shop" replace />} />
          </Route>

          {/* Operational Shell (Seller / HITL / Admin) */}
          <Route element={
            isSellerOrAdmin ?
              <OperationalLayout auth={auth} onLogout={handleLogout} pendingHitlCount={pendingHitlCount} /> :
              <Navigate to="/login" replace />
          }>
            {/* Top-level direct entry redirects */}
            <Route path="/seller" element={<Navigate to={isAdmin ? "/admin/overview" : "/seller/overview"} replace />} />
            <Route path="/hitl" element={<HitlQueue {...sharedOperationalProps} />} />
            <Route path="/admin" element={<Navigate to={isAdmin ? "/admin/overview" : "/seller/overview"} replace />} />

            {/* Seller Pages — For Merchant Sellers */}
            <Route path="/seller/overview" element={isSeller ? <SellerOverview {...sharedOperationalProps} /> : <Navigate to="/admin/overview" replace />} />
            <Route path="/seller/inventory" element={isSeller ? <SellerInventory {...sharedOperationalProps} /> : <Navigate to="/admin/overview" replace />} />
            <Route path="/seller/pricing" element={isSeller ? <SellerPricing {...sharedOperationalProps} /> : <Navigate to="/admin/overview" replace />} />
            <Route path="/seller/orders" element={isSeller ? <SellerOrders {...sharedOperationalProps} /> : <Navigate to="/admin/overview" replace />} />
            <Route path="/seller/finance" element={isSeller ? <SellerFinance {...sharedOperationalProps} /> : <Navigate to="/admin/overview" replace />} />
            <Route path="/seller/reviews" element={isSeller ? <SellerReviewManager {...sharedOperationalProps} /> : <Navigate to="/admin/overview" replace />} />
            <Route path="/seller/analytics" element={isSeller ? <SellerAnalytics {...sharedOperationalProps} /> : <Navigate to="/admin/overview" replace />} />
            <Route path="/seller/ai" element={isSeller ? <SellerAIAssistant {...sharedOperationalProps} /> : <Navigate to="/admin/overview" replace />} />
            <Route path="/seller/products/add" element={isSeller ? <SellerAddProduct {...sharedOperationalProps} /> : <Navigate to="/admin/overview" replace />} />
            <Route path="/seller/settings" element={isSeller ? <SellerSettings {...sharedOperationalProps} /> : <Navigate to="/admin/overview" replace />} />

            {/* HITL Pages — Shared Operational Oversight */}
            <Route path="/hitl/queue" element={<HitlQueue {...sharedOperationalProps} />} />
            <Route path="/hitl/decision/:decisionId" element={<HitlDecisionDetail {...sharedOperationalProps} />} />
            <Route path="/hitl/history" element={<HitlHistory {...sharedOperationalProps} />} />
            <Route path="/hitl/analytics" element={<HitlAnalytics {...sharedOperationalProps} />} />

            {/* Admin Pages — For Platform Administrators */}
            <Route path="/admin/overview" element={isAdmin ? <AdminOverview {...sharedOperationalProps} /> : <Navigate to="/seller/overview" replace />} />
            <Route path="/admin/users" element={isAdmin ? <AdminUsers {...sharedOperationalProps} /> : <Navigate to="/seller/overview" replace />} />
            <Route path="/admin/moderation" element={isAdmin ? <AdminModeration {...sharedOperationalProps} /> : <Navigate to="/seller/overview" replace />} />

            {/* Fallback routes within operational track */}
            <Route path="/seller/*" element={<Navigate to={isAdmin ? "/admin/overview" : "/seller/overview"} replace />} />
            <Route path="/admin/*" element={<Navigate to={isAdmin ? "/admin/overview" : "/seller/overview"} replace />} />
            <Route path="/hitl/*" element={<Navigate to="/hitl" replace />} />
          </Route>

          {/* Global catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toast />
      </ToastProvider>
    </BrowserRouter>
  );
}
