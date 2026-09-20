import unittest
from app.main import app
from app.auth.service import hash_password, verify_password, generate_tokens, verify_access_token, verify_refresh_token
from app.routers.products import parse_natural_language_query


class TestVyapariCoreBackend(unittest.TestCase):
    def test_routes_registered(self):
        """Verify all Express API endpoints are mounted on FastAPI app."""
        routes = [r.path for r in app.routes]
        
        # Health
        self.assertIn("/health", routes)
        
        # Auth
        self.assertIn("/api/auth/register", routes)
        self.assertIn("/api/auth/login", routes)
        self.assertIn("/api/auth/refresh", routes)
        self.assertIn("/api/auth/logout", routes)
        self.assertIn("/api/auth/me", routes)
        
        # Categories
        self.assertIn("/api/categories", routes)
        self.assertIn("/api/categories/{slug}", routes)
        
        # Products
        self.assertIn("/api/products", routes)
        self.assertIn("/api/products/facets", routes)
        self.assertIn("/api/products/suggest", routes)
        self.assertIn("/api/products/{id}", routes)
        
        # Cart
        self.assertIn("/api/cart", routes)
        self.assertIn("/api/cart/items", routes)
        self.assertIn("/api/cart/items/{id}", routes)
        
        # Orders
        self.assertIn("/api/orders", routes)
        self.assertIn("/api/orders/{id}", routes)
        self.assertIn("/api/orders/{id}/confirm-payment", routes)
        
        # Seller
        self.assertIn("/api/seller/onboarding/status", routes)
        self.assertIn("/api/seller/onboarding", routes)
        self.assertIn("/api/seller/dashboard", routes)
        self.assertIn("/api/seller/products", routes)
        self.assertIn("/api/seller/products/{id}", routes)
        self.assertIn("/api/seller/orders", routes)
        self.assertIn("/api/seller/orders/{id}/fulfill", routes)
        self.assertIn("/api/seller/inventory/velocity", routes)
        self.assertIn("/api/seller/inventory/advisory", routes)
        self.assertIn("/api/seller/ai/chat", routes)
        self.assertIn("/api/seller/settings", routes)
        
        # Approvals
        self.assertIn("/api/approvals", routes)
        self.assertIn("/api/approvals/{item_id}/approve", routes)
        self.assertIn("/api/approvals/{item_id}/reject", routes)
        
        # AI
        self.assertIn("/api/ai/similar/{product_id}", routes)
        self.assertIn("/api/ai/popular", routes)
        self.assertIn("/api/ai/search", routes)
        self.assertIn("/api/ai/generate-listing", routes)
        self.assertIn("/api/ai/inventory-advisory", routes)
        self.assertIn("/api/ai/support-reply", routes)
        
        # Users
        self.assertIn("/api/users/profile", routes)
        self.assertIn("/api/users/addresses", routes)
        self.assertIn("/api/users/addresses/{addr_id}", routes)
        self.assertIn("/api/users/addresses/{addr_id}/default", routes)
        
        # Wishlist
        self.assertIn("/api/wishlist", routes)
        self.assertIn("/api/wishlist/{product_id}", routes)
        
        # Notifications
        self.assertIn("/api/notifications", routes)
        self.assertIn("/api/notifications/{notif_id}/read", routes)
        self.assertIn("/api/notifications/read-all", routes)
        
        # Stores
        self.assertIn("/api/stores/{seller_id}", routes)
        
        # Admin
        self.assertIn("/api/admin/metrics", routes)
        self.assertIn("/api/admin/dashboard", routes)
        self.assertIn("/api/admin/users", routes)
        self.assertIn("/api/admin/users/{user_id}/status", routes)
        self.assertIn("/api/admin/sellers", routes)
        self.assertIn("/api/admin/sellers/{seller_id}/verify", routes)
        self.assertIn("/api/admin/sellers/{seller_id}/reject", routes)
        self.assertIn("/api/admin/products", routes)
        self.assertIn("/api/admin/products/{product_id}/moderate", routes)
        self.assertIn("/api/admin/products/{product_id}/status", routes)
        self.assertIn("/api/admin/categories", routes)
        self.assertIn("/api/admin/system/health", routes)
        self.assertIn("/api/admin/system", routes)
        self.assertIn("/api/admin/system/sync-embeddings", routes)
        
        # Reviews
        self.assertIn("/api/reviews/product/{product_id}", routes)
        self.assertIn("/api/reviews/seller", routes)
        self.assertIn("/api/reviews", routes)
        self.assertIn("/api/reviews/{review_id}/reply", routes)
        self.assertIn("/api/reviews/{review_id}/helpful", routes)

    def test_auth_password_hashing(self):
        """Verify bcrypt password hashing and verification."""
        pwd = "VyapariSecurePass123!"
        hashed = hash_password(pwd)
        self.assertTrue(verify_password(pwd, hashed))
        self.assertFalse(verify_password("WrongPassword", hashed))

    def test_auth_jwt_tokens(self):
        """Verify JWT generation and token verification."""
        user = {"id": "11111111-1111-1111-1111-111111111111", "email": "seller@vyapari.in", "role": "seller"}
        access_token, refresh_token = generate_tokens(user)
        self.assertTrue(bool(access_token))
        self.assertTrue(bool(refresh_token))
        
        payload = verify_access_token(access_token)
        self.assertEqual(payload["id"], user["id"])
        self.assertEqual(payload["email"], user["email"])
        self.assertEqual(payload["role"], user["role"])
        
        refresh_payload = verify_refresh_token(refresh_token)
        self.assertEqual(refresh_payload["id"], user["id"])

    def test_nlq_parser(self):
        """Verify port of natural language search query engine."""
        parsed = parse_natural_language_query("red silk saree under 2000")
        self.assertTrue(parsed.get("hasIntent"))
        self.assertEqual(parsed["intent"].get("max_price"), 2000.0)
        self.assertEqual(parsed.get("cleanQuery"), "red silk saree")

        # Test between price & top rated
        parsed2 = parse_natural_language_query("top rated cotton kurta between 500 and 1500")
        self.assertEqual(parsed2["intent"].get("min_price"), 500.0)
        self.assertEqual(parsed2["intent"].get("max_price"), 1500.0)
        self.assertEqual(parsed2["intent"].get("min_rating"), 4.0)
        self.assertEqual(parsed2["intent"].get("sort"), "rating_desc")


if __name__ == "__main__":
    unittest.main()
