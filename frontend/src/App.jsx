import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { SellerLayout } from './components/SellerLayout';
import { AdminLayout } from './components/AdminLayout';

// Public & Customer Pages
import { HomePage } from './pages/HomePage';
import { ExplorePage } from './pages/ExplorePage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrdersPage } from './pages/OrdersPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { WishlistPage } from './pages/WishlistPage';
import { AccountPage } from './pages/AccountPage';
import { AddressesPage } from './pages/AddressesPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { StoreFrontPage } from './pages/StoreFrontPage';

// Informational Pages
import { AboutPage } from './pages/AboutPage';
import { HelpPage } from './pages/HelpPage';
import { TermsPage } from './pages/TermsPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { ReturnsPage } from './pages/ReturnsPage';

// Seller Console Pages
import { SellerDashboardPage } from './pages/SellerDashboardPage';
import { SellerApprovalsPage } from './pages/SellerApprovalsPage';
import { SellerOnboardingPage } from './pages/SellerOnboardingPage';
import { SellerProductsPage } from './pages/SellerProductsPage';
import { SellerProductCreatePage } from './pages/SellerProductCreatePage';
import { SellerProductEditPage } from './pages/SellerProductEditPage';
import { SellerOrdersPage } from './pages/SellerOrdersPage';
import { SellerInventoryPage } from './pages/SellerInventoryPage';
import { SellerAiListingPage } from './pages/SellerAiListingPage';
import { SellerAiChatPage } from './pages/SellerAiChatPage';
import { SellerSettingsPage } from './pages/SellerSettingsPage';
import { SellerReviewsPage } from './pages/SellerReviewsPage';

// Admin Governance Pages
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { AdminSellersPage } from './pages/AdminSellersPage';
import { AdminProductsPage } from './pages/AdminProductsPage';
import { AdminCategoriesPage } from './pages/AdminCategoriesPage';
import { AdminSystemPage } from './pages/AdminSystemPage';

// Route Guards
const CustomerRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const SellerRoute = ({ children }) => {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated || (user?.role !== 'seller' && user?.role !== 'admin')) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const AdminRoute = ({ children }) => {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated || user?.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }
  return children;
};

export const App = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/search" element={<ExplorePage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route path="/stores/:sellerId" element={<StoreFrontPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Legal / Informational Pages */}
          <Route path="/about" element={<AboutPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/returns" element={<ReturnsPage />} />

          {/* Authenticated Customer Routes */}
          <Route path="/checkout" element={<CustomerRoute><CheckoutPage /></CustomerRoute>} />
          <Route path="/orders" element={<CustomerRoute><OrdersPage /></CustomerRoute>} />
          <Route path="/orders/:id" element={<CustomerRoute><OrderDetailPage /></CustomerRoute>} />
          <Route path="/wishlist" element={<CustomerRoute><WishlistPage /></CustomerRoute>} />
          <Route path="/account" element={<CustomerRoute><AccountPage /></CustomerRoute>} />
          <Route path="/account/addresses" element={<CustomerRoute><AddressesPage /></CustomerRoute>} />
          <Route path="/notifications" element={<CustomerRoute><NotificationsPage /></CustomerRoute>} />
          <Route path="/seller/onboarding" element={<CustomerRoute><SellerOnboardingPage /></CustomerRoute>} />

          {/* Seller Console Routes (Persistent SellerLayout) */}
          <Route path="/seller" element={<Navigate to="/seller/dashboard" replace />} />
          <Route path="/seller/dashboard" element={<SellerRoute><SellerLayout><SellerDashboardPage /></SellerLayout></SellerRoute>} />
          <Route path="/seller/products" element={<SellerRoute><SellerLayout><SellerProductsPage /></SellerLayout></SellerRoute>} />
          <Route path="/seller/products/new" element={<SellerRoute><SellerLayout><SellerProductCreatePage /></SellerLayout></SellerRoute>} />
          <Route path="/seller/products/:id/edit" element={<SellerRoute><SellerLayout><SellerProductEditPage /></SellerLayout></SellerRoute>} />
          <Route path="/seller/orders" element={<SellerRoute><SellerLayout><SellerOrdersPage /></SellerLayout></SellerRoute>} />
          <Route path="/seller/reviews" element={<SellerRoute><SellerLayout><SellerReviewsPage /></SellerLayout></SellerRoute>} />
          <Route path="/seller/inventory" element={<SellerRoute><SellerLayout><SellerInventoryPage /></SellerLayout></SellerRoute>} />
          <Route path="/seller/ai/listing" element={<SellerRoute><SellerLayout><SellerAiListingPage /></SellerLayout></SellerRoute>} />
          <Route path="/seller/ai/chat" element={<SellerRoute><SellerLayout><SellerAiChatPage /></SellerLayout></SellerRoute>} />
          <Route path="/seller/approvals" element={<SellerRoute><SellerLayout><SellerApprovalsPage /></SellerLayout></SellerRoute>} />
          <Route path="/seller/settings" element={<SellerRoute><SellerLayout><SellerSettingsPage /></SellerLayout></SellerRoute>} />

          {/* Admin Governance Routes (Persistent AdminLayout) */}
          <Route path="/admin" element={<AdminRoute><AdminLayout><AdminDashboardPage /></AdminLayout></AdminRoute>} />
          <Route path="/admin/users" element={<AdminRoute><AdminLayout><AdminUsersPage /></AdminLayout></AdminRoute>} />
          <Route path="/admin/sellers" element={<AdminRoute><AdminLayout><AdminSellersPage /></AdminLayout></AdminRoute>} />
          <Route path="/admin/products" element={<AdminRoute><AdminLayout><AdminProductsPage /></AdminLayout></AdminRoute>} />
          <Route path="/admin/categories" element={<AdminRoute><AdminLayout><AdminCategoriesPage /></AdminLayout></AdminRoute>} />
          <Route path="/admin/system" element={<AdminRoute><AdminLayout><AdminSystemPage /></AdminLayout></AdminRoute>} />

          {/* 404 Fallback */}
          <Route path="*" element={
            <div className="container" style={{ padding: '80px 24px', textAlign: 'center' }}>
              <h1 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: '16px' }}>404</h1>
              <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
                The requested page does not exist on Vyapari Marketplace.
              </p>
              <a href="/" className="btn-primary">Return to Marketplace</a>
            </div>
          } />
        </Routes>
      </main>
      <Footer />
    </div>
  );
};

export default App;
