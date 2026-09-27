import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { SellerLayout } from './components/SellerLayout';
import { AdminLayout } from './components/AdminLayout';
import { GlobalErrorBoundary } from './components/GlobalErrorBoundary';
import { applyUploadConfig } from './lib/imageUrl';
import { trackPageView } from './lib/analytics';

/**
 * Section J1 — code splitting.
 *
 * `HomePage` is the only eager page, deliberately: it is the storefront's landing
 * page, it is what a first-time visitor sees, and putting it behind a dynamic
 * import would trade a real first paint for a tidier chunk list. Every other
 * route is reached by a navigation, and a navigation is allowed to cost a fetch.
 *
 * The split that matters most is the two consoles. Before this, every shopper
 * downloaded the seller product form (35 kB), the admin catalogue (45 kB), the
 * admin order book and the seller showcase page whether or not they would ever
 * open them.
 *
 * `lazyPage` exists because every page is a *named* export and `React.lazy` wants
 * a module whose `default` is the component. Writing
 * `lazy(() => import('./pages/X').then((m) => ({ default: m.XPage })))` forty
 * times is forty chances to typo a name the bundler cannot check.
 */
const lazyPage = (loader, name) =>
  lazy(() => loader().then((mod) => ({ default: mod[name] })));

// Public & customer pages.
const ExplorePage = lazyPage(() => import('./pages/ExplorePage'), 'ExplorePage');
const ProductDetailPage = lazyPage(() => import('./pages/ProductDetailPage'), 'ProductDetailPage');
const CartPage = lazyPage(() => import('./pages/CartPage'), 'CartPage');
const CheckoutPage = lazyPage(() => import('./pages/CheckoutPage'), 'CheckoutPage');
const OrdersPage = lazyPage(() => import('./pages/OrdersPage'), 'OrdersPage');
const OrderDetailPage = lazyPage(() => import('./pages/OrderDetailPage'), 'OrderDetailPage');
const LoginPage = lazyPage(() => import('./pages/LoginPage'), 'LoginPage');
const RegisterPage = lazyPage(() => import('./pages/RegisterPage'), 'RegisterPage');
const ForgotPasswordPage = lazyPage(() => import('./pages/ForgotPasswordPage'), 'ForgotPasswordPage');
const ResetPasswordPage = lazyPage(() => import('./pages/ResetPasswordPage'), 'ResetPasswordPage');
const WishlistPage = lazyPage(() => import('./pages/WishlistPage'), 'WishlistPage');
const AccountPage = lazyPage(() => import('./pages/AccountPage'), 'AccountPage');
const AddressesPage = lazyPage(() => import('./pages/AddressesPage'), 'AddressesPage');
const NotificationsPage = lazyPage(() => import('./pages/NotificationsPage'), 'NotificationsPage');
const StoreFrontPage = lazyPage(() => import('./pages/StoreFrontPage'), 'StoreFrontPage');
const SellerShowcasePage = lazyPage(() => import('./pages/SellerShowcasePage'), 'SellerShowcasePage');

// Informational pages.
const AboutPage = lazyPage(() => import('./pages/AboutPage'), 'AboutPage');
const HelpPage = lazyPage(() => import('./pages/HelpPage'), 'HelpPage');
const TermsPage = lazyPage(() => import('./pages/TermsPage'), 'TermsPage');
const PrivacyPage = lazyPage(() => import('./pages/PrivacyPage'), 'PrivacyPage');
const ReturnsPage = lazyPage(() => import('./pages/ReturnsPage'), 'ReturnsPage');
const ContactPage = lazyPage(() => import('./pages/ContactPage'), 'ContactPage');

// The seller console. A shopper should never download any of it.
const SellerDashboardPage = lazyPage(() => import('./pages/SellerDashboardPage'), 'SellerDashboardPage');
const SellerApprovalsPage = lazyPage(() => import('./pages/SellerApprovalsPage'), 'SellerApprovalsPage');
const SellerOnboardingPage = lazyPage(() => import('./pages/SellerOnboardingPage'), 'SellerOnboardingPage');
const SellerProductsPage = lazyPage(() => import('./pages/SellerProductsPage'), 'SellerProductsPage');
const SellerProductCreatePage = lazyPage(() => import('./pages/SellerProductCreatePage'), 'SellerProductCreatePage');
const SellerProductEditPage = lazyPage(() => import('./pages/SellerProductEditPage'), 'SellerProductEditPage');
const SellerOrdersPage = lazyPage(() => import('./pages/SellerOrdersPage'), 'SellerOrdersPage');
const SellerInventoryPage = lazyPage(() => import('./pages/SellerInventoryPage'), 'SellerInventoryPage');
const SellerAiListingPage = lazyPage(() => import('./pages/SellerAiListingPage'), 'SellerAiListingPage');
const SellerAiChatPage = lazyPage(() => import('./pages/SellerAiChatPage'), 'SellerAiChatPage');
const SellerSettingsPage = lazyPage(() => import('./pages/SellerSettingsPage'), 'SellerSettingsPage');
const SellerReviewsPage = lazyPage(() => import('./pages/SellerReviewsPage'), 'SellerReviewsPage');

// The admin console, likewise.
const AdminDashboardPage = lazyPage(() => import('./pages/AdminDashboardPage'), 'AdminDashboardPage');
const AdminUsersPage = lazyPage(() => import('./pages/AdminUsersPage'), 'AdminUsersPage');
const AdminSellersPage = lazyPage(() => import('./pages/AdminSellersPage'), 'AdminSellersPage');
const AdminProductsPage = lazyPage(() => import('./pages/AdminProductsPage'), 'AdminProductsPage');
const AdminCategoriesPage = lazyPage(() => import('./pages/AdminCategoriesPage'), 'AdminCategoriesPage');
const AdminSystemPage = lazyPage(() => import('./pages/AdminSystemPage'), 'AdminSystemPage');
const AdminOrdersPage = lazyPage(() => import('./pages/AdminOrdersPage'), 'AdminOrdersPage');
const AdminLeadsPage = lazyPage(() => import('./pages/AdminLeadsPage'), 'AdminLeadsPage');
const AdminContentPage = lazyPage(() => import('./pages/AdminContentPage'), 'AdminContentPage');
const AdminAnalyticsPage = lazyPage(() => import('./pages/AdminAnalyticsPage'), 'AdminAnalyticsPage');

// The one page that must not cost a fetch.
import { HomePage } from './pages/HomePage';

/**
 * One GA4 page view per client-side navigation.
 *
 * GA4 is configured with `send_page_view: false` (see `lib/analytics.js`) because
 * a single-page app that lets the tag send its own views reports exactly one --
 * the initial load -- and then nothing for the rest of the session. This is the
 * half that makes the route changes visible.
 *
 * A no-op when GA4 is not configured, and it renders nothing either way.
 */
const RouteAnalytics = () => {
  const location = useLocation();
  useEffect(() => {
    trackPageView(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);
  return null;
};

/* eslint-disable-next-line */
/**
 * The fallback shown while a route's chunk is fetching.
 *
 * Deliberately a skeleton rather than a spinner, and deliberately tall: a lazy
 * chunk resolves in tens of milliseconds on a warm connection, and a small
 * centred spinner that appears and vanishes in that time reads as a flicker. A
 * full-height block holds the footer down and looks like a page that is arriving.
 */
const RouteLoading = () => (
  <div className="container" style={{ padding: '48px 24px', minHeight: '60vh' }} role="status" aria-live="polite">
    <span
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
        clip: 'rect(0 0 0 0)',
        whiteSpace: 'nowrap'
      }}
    >
      Loading
    </span>
    <div className="skeleton" style={{ height: '34px', width: '38%', borderRadius: '6px', marginBottom: '18px' }} />
    <div className="skeleton" style={{ height: '16px', width: '62%', borderRadius: '6px', marginBottom: '32px' }} />
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
      {[1, 2, 3, 4].map((n) => (
        <div key={n} className="skeleton" style={{ height: '320px', borderRadius: '12px' }} />
      ))}
    </div>
  </div>
);

// Allows any authenticated user (customer, seller, admin)
const AuthRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Strictly customer-only: blocks sellers and admins from shopping routes
const CustomerRoute = ({ children }) => {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (user?.role === 'seller') {
    return <Navigate to="/seller/dashboard" replace />;
  }
  if (user?.role === 'admin') {
    return <Navigate to="/admin" replace />;
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
  // Ask the API which rendition widths it actually stores, so a srcSet is built
  // from the real ladder rather than the copy of it in `imageUrl.js`. Fire and
  // forget: the mirror of `IMAGE_VARIANT_WIDTHS` is already in the bundle, so
  // the first paint is correct whether or not this call lands first.
  useEffect(() => {
    applyUploadConfig();
  }, []);

  return (
    <GlobalErrorBoundary>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header />
        <main style={{ flex: 1 }}>
          <RouteAnalytics />
          {/* One boundary for the whole route tree rather than one per route. A
              per-route boundary can only show its own fallback, so navigating
              between two lazy routes unmounts one skeleton and mounts another;
              one boundary around the tree keeps the shell, the header and the
              footer on screen while the page it is fetching arrives. */}
          <Suspense fallback={<RouteLoading />}>
            <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/search" element={<ExplorePage />} />
            <Route path="/products/:id" element={<ProductDetailPage />} />
            <Route path="/stores/:sellerId" element={<StoreFrontPage />} />
            {/* Instagram-style seller showcase page. Public by design: these are
                indexable and are the upsell surface for paid seller plans. The
                handle is resolved by the API, which 404s unpublished pages. */}
            <Route path="/store/:handle" element={<SellerShowcasePage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            {/* Password recovery. Both must stay outside every *Route guard:
                a locked-out user has no session, which is the reason they are
                on these pages. */}
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Legal / Informational Pages */}
            <Route path="/about" element={<AboutPage />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/returns" element={<ReturnsPage />} />
            <Route path="/contact" element={<ContactPage />} />

            {/* Authenticated Customer-Only Routes */}
            <Route path="/cart" element={<CustomerRoute><CartPage /></CustomerRoute>} />
            <Route path="/checkout" element={<CustomerRoute><CheckoutPage /></CustomerRoute>} />
            <Route path="/orders" element={<CustomerRoute><OrdersPage /></CustomerRoute>} />
            <Route path="/orders/:id" element={<CustomerRoute><OrderDetailPage /></CustomerRoute>} />
            <Route path="/wishlist" element={<CustomerRoute><WishlistPage /></CustomerRoute>} />
            <Route path="/account" element={<CustomerRoute><AccountPage /></CustomerRoute>} />
            <Route path="/account/addresses" element={<CustomerRoute><AddressesPage /></CustomerRoute>} />
            {/* Notifications & Seller onboarding: any authenticated user */}
            <Route path="/notifications" element={<AuthRoute><NotificationsPage /></AuthRoute>} />
            <Route path="/seller/onboarding" element={<AuthRoute><SellerOnboardingPage /></AuthRoute>} />

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
            <Route path="/seller/ai" element={<SellerRoute><SellerLayout><SellerAiChatPage /></SellerLayout></SellerRoute>} />
            <Route path="/seller/ai/chat" element={<Navigate to="/seller/ai" replace />} />
            <Route path="/seller/approvals" element={<SellerRoute><SellerLayout><SellerApprovalsPage /></SellerLayout></SellerRoute>} />
            <Route path="/seller/settings" element={<SellerRoute><SellerLayout><SellerSettingsPage /></SellerLayout></SellerRoute>} />

            {/* Admin Governance Routes (Persistent AdminLayout) */}
            <Route path="/admin" element={<AdminRoute><AdminLayout><AdminDashboardPage /></AdminLayout></AdminRoute>} />
            <Route path="/admin/users" element={<AdminRoute><AdminLayout><AdminUsersPage /></AdminLayout></AdminRoute>} />
            <Route path="/admin/sellers" element={<AdminRoute><AdminLayout><AdminSellersPage /></AdminLayout></AdminRoute>} />
            <Route path="/admin/products" element={<AdminRoute><AdminLayout><AdminProductsPage /></AdminLayout></AdminRoute>} />
            <Route path="/admin/categories" element={<AdminRoute><AdminLayout><AdminCategoriesPage /></AdminLayout></AdminRoute>} />
            <Route path="/admin/system" element={<AdminRoute><AdminLayout><AdminSystemPage /></AdminLayout></AdminRoute>} />
            <Route path="/admin/orders" element={<AdminRoute><AdminLayout><AdminOrdersPage /></AdminLayout></AdminRoute>} />
            <Route path="/admin/leads" element={<AdminRoute><AdminLayout><AdminLeadsPage /></AdminLayout></AdminRoute>} />
            <Route path="/admin/content" element={<AdminRoute><AdminLayout><AdminContentPage /></AdminLayout></AdminRoute>} />
            <Route path="/admin/analytics" element={<AdminRoute><AdminLayout><AdminAnalyticsPage /></AdminLayout></AdminRoute>} />

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
          </Suspense>
        </main>
        <Footer />
      </div>
    </GlobalErrorBoundary>
  );
};

export default App;
