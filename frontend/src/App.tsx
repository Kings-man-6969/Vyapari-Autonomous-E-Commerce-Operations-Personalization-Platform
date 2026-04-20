import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AgentSettingsPage } from './pages/AgentSettingsPage'
import { CustomerHome } from './pages/CustomerHome'
import { CustomerCartPage } from './pages/CustomerCartPage'
import { CustomerWishlistPage } from './pages/CustomerWishlistPage'
import { CustomerOrdersPage } from './pages/CustomerOrdersPage'
import { CustomerOrderDetailPage } from './pages/CustomerOrderDetailPage'
import { CustomerProfilePage } from './pages/CustomerProfilePage'
import { LandingPage } from './pages/LandingPage'
import { HitlLog } from './pages/HitlLog'
import { HitlAgentsPage } from './pages/HitlAgentsPage'
import { HitlQueue } from './pages/HitlQueue'
import { ProductPage } from './pages/ProductPage'
import { ReviewApprovals } from './pages/ReviewApprovals'
import { SellerPricingPage } from './pages/SellerPricingPage'
import { SellerInventory } from './pages/SellerInventory'
import { SellerOverview } from './pages/SellerOverview'
import { SellerAnalyticsPage } from './pages/SellerAnalyticsPage'
import { SellerReviewsPage } from './pages/SellerReviewsPage'
import { SellerProductFormPage } from './pages/SellerProductFormPage'
import { ShopPage } from './pages/ShopPage'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ResetPasswordConfirmationPage } from './pages/ResetPasswordConfirmationPage'

function LegacyCustomerProductRedirect() {
  const { id } = useParams()
  return <Navigate to={`/store/product/${id ?? ''}`} replace />
}

function LegacyCustomerPathRedirect({ to }: { to: string }) {
  return <Navigate to={to} replace />
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth/login" element={<LoginPage />} />
      <Route path="/auth/signup" element={<SignupPage />} />
      <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/auth/reset-confirmation" element={<ResetPasswordConfirmationPage />} />

      <Route
        element={
          <ProtectedRoute role="customer">
            <AppLayout portal="customer" />
          </ProtectedRoute>
        }
      >
        <Route path="/store" element={<CustomerHome />} />
        <Route path="/store/search" element={<ShopPage />} />
        <Route path="/store/product/:id" element={<ProductPage />} />
        <Route path="/store/cart" element={<CustomerCartPage />} />
        <Route path="/store/me/wishlist" element={<CustomerWishlistPage />} />
        <Route path="/store/me/profile" element={<CustomerProfilePage />} />
        <Route path="/store/me/orders" element={<CustomerOrdersPage />} />
        <Route path="/store/me/orders/:id" element={<CustomerOrderDetailPage />} />
        <Route path="/product/:id" element={<LegacyCustomerProductRedirect />} />
        <Route path="/search" element={<LegacyCustomerPathRedirect to="/store/search" />} />
        <Route path="/cart" element={<LegacyCustomerPathRedirect to="/store/cart" />} />
        <Route path="/me/wishlist" element={<LegacyCustomerPathRedirect to="/store/me/wishlist" />} />
        <Route path="/me/profile" element={<LegacyCustomerPathRedirect to="/store/me/profile" />} />
        <Route path="/me/orders" element={<LegacyCustomerPathRedirect to="/store/me/orders" />} />
      </Route>

      <Route
        element={
          <ProtectedRoute role="seller">
            <AppLayout portal="seller" />
          </ProtectedRoute>
        }
      >
        <Route path="/seller" element={<SellerOverview />} />
        <Route path="/seller/inventory" element={<SellerInventory />} />
        <Route path="/seller/pricing" element={<SellerPricingPage />} />
        <Route path="/seller/reviews" element={<SellerReviewsPage />} />
        <Route path="/seller/analytics" element={<SellerAnalyticsPage />} />
        <Route path="/seller/products/add" element={<SellerProductFormPage />} />
        <Route path="/seller/products/:id/edit" element={<SellerProductFormPage />} />
        <Route path="/hitl" element={<HitlQueue />} />
        <Route path="/hitl/log" element={<HitlLog />} />
        <Route path="/hitl/agents" element={<HitlAgentsPage />} />
        <Route path="/hitl/reviews" element={<ReviewApprovals />} />
        <Route path="/hitl/settings" element={<AgentSettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
