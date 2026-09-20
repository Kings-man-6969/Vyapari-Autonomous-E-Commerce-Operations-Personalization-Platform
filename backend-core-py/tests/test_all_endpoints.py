"""
Comprehensive end-to-end integration and logic tests for all 15 Vyapari Core FastAPI modules.
Tests every route, logic branch, auth guard, role check, and response shape.
"""
import datetime
import json
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from app.auth.service import generate_tokens, hash_password
from app.db import get_db, get_pool, set_pool
from app.main import app
from tests.mock_db import MockConnection, MockPool, MockRecord


class TestAllVyapariEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app, raise_server_exceptions=False)

        cls.customer_id = "11111111-1111-1111-1111-111111111111"
        cls.seller_id = "22222222-2222-2222-2222-222222222222"
        cls.admin_id = "33333333-3333-3333-3333-333333333333"

        cls.customer_token, cls.customer_refresh = generate_tokens({
            "id": cls.customer_id,
            "email": "customer@vyapari.in",
            "role": "customer",
            "name": "Customer Ramesh",
        })
        cls.seller_token, cls.seller_refresh = generate_tokens({
            "id": cls.seller_id,
            "email": "seller@vyapari.in",
            "role": "seller",
            "name": "Seller Suresh",
        })
        cls.admin_token, cls.admin_refresh = generate_tokens({
            "id": cls.admin_id,
            "email": "admin@vyapari.in",
            "role": "admin",
            "name": "Admin Admin",
        })

    def setUp(self):
        def db_handler(op, query, *args):
            q = " ".join(query.lower().split())

            # 1. Health
            if "select 1 as alive" in q:
                return [{"alive": 1}]
            if "pg_extension" in q:
                return [{"extversion": "0.5.1"}]
            if "from information_schema.tables" in q:
                return 25

            # 2. Specific Subquery & Aggregate Queries (Must match BEFORE generic table checks)
            if "product_embeddings" in q:
                return {"total_products": 450, "indexed_products": 440}
            if "total_revenue" in q or "coalesce(sum(oi.quantity" in q:
                return {"total_revenue": 150000.0, "total_orders": 45, "active_products_count": 12}
            if "count(*) as total from products" in q:
                return {"total": 5}
            if "min(price)::int as min_price" in q:
                return {"min_price": 299, "max_price": 49999}
            if "select distinct attributes->>'brand'" in q:
                return [{"brand": "FabIndia"}, {"brand": "Biba"}]

            # Admin fetchval scalars
            if "coalesce(sum(total_amount), 0) from orders" in q:
                return 5400000.0
            if "count(*) from users where role = 'customer'" in q:
                return 1250
            if "count(*) from seller_profiles where is_verified = true" in q:
                return 85
            if "count(*) from orders" in q:
                return 3400
            if "count(*) from products where status = 'active'" in q:
                return 450
            if "seller_profiles where is_verified = false" in q:
                return 7
            if "count(*) as count from agent_approval_queue" in q or "count(*) from agent_approval_queue" in q:
                return {"count": 3} if op == "fetchrow" else 3
            if "count(*) from notifications" in q:
                return 1
            if "count(*) from addresses" in q:
                return 1
            if "count(*) from wishlist_items" in q:
                return 3

            # 3. Auth & Users
            if "from users where email = $1" in q:
                email = args[0]
                if email in ("existing@vyapari.in", "customer@vyapari.in", "seller@vyapari.in", "admin@vyapari.in"):
                    return {
                        "id": self.customer_id,
                        "name": "Existing User",
                        "email": email,
                        "password_hash": hash_password("ValidPass123!"),
                        "role": "customer",
                        "phone": "9876543210",
                        "is_active": True,
                        "created_at": datetime.datetime.now(),
                    }
                return None

            if "insert into users" in q:
                return {
                    "id": self.customer_id,
                    "name": args[0],
                    "email": args[1],
                    "role": args[3],
                    "phone": args[4],
                    "created_at": datetime.datetime.now(),
                }

            if "from users where id = $1" in q or "from users where id=$1" in q:
                uid = str(args[0])
                role = "seller" if uid == self.seller_id else ("admin" if uid == self.admin_id else "customer")
                return {
                    "id": uid,
                    "name": "Test User",
                    "email": "test@vyapari.in",
                    "role": role,
                    "phone": "9876543210",
                    "is_active": True,
                    "created_at": datetime.datetime.now(),
                    "updated_at": datetime.datetime.now(),
                    "password_hash": hash_password("ValidPass123!"),
                }

            # 4. Cart Items
            if "from carts where user_id = $1" in q:
                return {"id": "cart-123"}
            if "from cart_items ci" in q and op == "fetchrow":
                return {"id": "item-1", "stock_qty": 15}
            if "from cart_items ci" in q and op == "fetch":
                return [{
                    "cart_item_id": "item-1",
                    "quantity": 2,
                    "created_at": datetime.datetime.now(),
                    "product_id": "11111111-0000-0000-0000-000000000001",
                    "title": "Silk Saree",
                    "price": 1999.0,
                    "compare_at_price": 2999.0,
                    "stock_qty": 15,
                    "status": "active",
                    "images": ["saree.jpg"],
                    "store_name": "Royal Silks",
                }]

            # 5. Orders & Order Items
            if "from order_items oi" in q and "status = 'delivered'" in q:
                return {"id": "oi-1", "order_id": "order-123"}
            if "from orders o" in q and op == "fetch":
                return [{
                    "id": "order-123",
                    "total_amount": 3998.0,
                    "status": "processing",
                    "created_at": datetime.datetime.now(),
                    "payment_status": "paid",
                    "payment_gateway": "razorpay",
                    "item_count": 2,
                }]
            if "from orders" in q and op == "fetchrow":
                return {
                    "id": "order-123",
                    "user_id": self.customer_id,
                    "total_amount": 3998.0,
                    "status": "processing",
                    "created_at": datetime.datetime.now(),
                    "payment_status": "paid",
                    "payment_gateway": "razorpay",
                    "shipping_address": {"full_name": "Ramesh", "city": "Bengaluru"},
                }

            # 6. Seller Profiles
            if "insert into seller_profiles" in q:
                return {
                    "id": "profile-1",
                    "user_id": self.seller_id,
                    "store_name": args[1] if len(args) > 1 else "Store",
                    "description": args[2] if len(args) > 2 else "",
                    "is_verified": True,
                    "business_info": json.dumps({"pan": "ABCDE1234F"}),
                    "created_at": datetime.datetime.now(),
                    "updated_at": datetime.datetime.now(),
                }
            if "from seller_profiles" in q and op == "fetchrow":
                return {
                    "id": "profile-1",
                    "user_id": self.seller_id,
                    "store_name": "Royal Silks",
                    "description": "Authentic Silks",
                    "is_verified": True,
                    "business_info": json.dumps({
                        "pan": "ABCDE1234F",
                        "business_address": "45 Market Yard, Pune",
                        "return_policy": "7-day return",
                        "shipping_policy": "Express",
                        "support_email": "support@royalsilks.in",
                        "support_phone": "9876543210",
                    }),
                    "created_at": datetime.datetime.now(),
                    "updated_at": datetime.datetime.now(),
                    "role": "seller",
                }
            if "from seller_profiles" in q and op == "fetch":
                return [{
                    "id": "profile-1",
                    "user_id": self.seller_id,
                    "store_name": "Royal Silks",
                    "description": "Authentic Silks",
                    "is_verified": True,
                    "created_at": datetime.datetime.now(),
                    "owner_name": "Seller Suresh",
                    "owner_email": "seller@vyapari.in",
                    "owner_phone": "9876543210",
                    "pan": "ABCDE1234F",
                    "gstin": "27ABCDE1234F1Z5",
                    "bank_ifsc": "HDFC0001234",
                    "account_holder_name": "Royal Silks",
                    "business_address": "45 Market Yard, Pune",
                    "onboarding_status": "verified",
                    "product_count": 12,
                }]

            # 7. Agent Approvals
            if "from agent_approval_queue" in q:
                return [{
                    "id": "app-1",
                    "task_id": "task-1",
                    "item_type": "listing_draft",
                    "reference_id": "draft-1",
                    "risk_level": "low",
                    "payload": json.dumps({"suggested_price": 2499}),
                    "status": "pending",
                    "seller_edit": None,
                    "created_at": datetime.datetime.now(),
                    "resolved_at": None,
                    "task_type": "generate_listing",
                }]

            # 8. Categories
            if "from categories" in q and op == "fetch":
                return [
                    {"id": "cat-1", "name": "Fashion", "slug": "fashion", "parent_id": None, "icon_url": None, "created_at": datetime.datetime.now()},
                    {"id": "cat-2", "name": "Ethnic", "slug": "ethnic", "parent_id": "cat-1", "icon_url": None, "created_at": datetime.datetime.now()},
                ]
            if "from categories where slug = $1" in q:
                return {"id": "cat-1", "name": "Fashion", "slug": args[0], "parent_id": None, "created_at": datetime.datetime.now()}
            if "insert into categories" in q:
                return {"id": "cat-3", "name": args[0], "slug": args[1], "parent_id": args[2], "created_at": datetime.datetime.now()}

            # 9. Wishlist
            if "from wishlists where user_id = $1" in q:
                return {"id": "wish-123"}
            if "from wishlist_items wi" in q and op == "fetch":
                return [{
                    "wishlist_item_id": "wi-1",
                    "added_at": datetime.datetime.now(),
                    "product_id": "11111111-0000-0000-0000-000000000001",
                    "title": "Silk Saree",
                    "slug": "silk-saree",
                    "price": 1999.0,
                    "compare_at_price": 2999.0,
                    "stock_qty": 15,
                    "status": "active",
                    "images": json.dumps(["saree.jpg"]),
                    "store_name": "Royal Silks",
                    "category_name": "Ethnic",
                }]

            # 10. Notifications
            if "from notifications" in q and op == "fetch":
                return [{
                    "id": "notif-1",
                    "type": "order_update",
                    "title": "Order Shipped",
                    "body": "Your order has shipped",
                    "link": "/orders/order-123",
                    "is_read": False,
                    "metadata": None,
                    "created_at": datetime.datetime.now(),
                }]

            # 11. Addresses
            if "from addresses" in q and op == "fetch":
                return [{
                    "id": "addr-1",
                    "full_name": "Ramesh Kumar",
                    "name": "Ramesh Kumar",
                    "phone": "9876543210",
                    "line1": "123 MG Road",
                    "address_line1": "123 MG Road",
                    "city": "Bengaluru",
                    "state": "Karnataka",
                    "pincode": "560001",
                    "postal_code": "560001",
                    "is_default": True,
                    "created_at": datetime.datetime.now(),
                }]
            if "from addresses" in q and op == "fetchrow":
                return {
                    "id": "addr-1",
                    "full_name": "Ramesh Kumar",
                    "name": "Ramesh Kumar",
                    "phone": "9876543210",
                    "line1": "123 MG Road",
                    "address_line1": "123 MG Road",
                    "city": "Bengaluru",
                    "state": "Karnataka",
                    "pincode": "560001",
                    "postal_code": "560001",
                    "is_default": True,
                    "created_at": datetime.datetime.now(),
                }

            # 12. Reviews
            if "from reviews r" in q and op == "fetch":
                return [{
                    "id": "rev-1",
                    "product_id": "11111111-0000-0000-0000-000000000001",
                    "rating": 5,
                    "title": "Excellent Quality",
                    "comment": "Authentic silk, fast shipping!",
                    "is_verified_purchase": True,
                    "seller_reply": "Thank you!",
                    "seller_reply_at": datetime.datetime.now(),
                    "helpful_count": 12,
                    "created_at": datetime.datetime.now(),
                    "reviewer_id": self.customer_id,
                    "reviewer_name": "Ramesh",
                    "product_title": "Silk Saree",
                    "store_name": "Royal Silks",
                }]
            if "insert into reviews" in q:
                return {
                    "id": "rev-1",
                    "product_id": "11111111-0000-0000-0000-000000000001",
                    "user_id": self.customer_id,
                    "rating": 5,
                    "title": "Great",
                    "comment": "Loved it!",
                    "is_verified_purchase": True,
                    "created_at": datetime.datetime.now(),
                }
            if "update reviews" in q and "helpful_count" in q:
                return {"helpful_count": 13}

            # 13. Products (Generic fallback)
            if "from products" in q and op == "fetchrow":
                return {
                    "id": "11111111-0000-0000-0000-000000000001",
                    "seller_id": self.seller_id,
                    "category_id": "cat-1",
                    "title": "Silk Saree",
                    "slug": "silk-saree",
                    "description": "Pure Kanjivaram silk saree",
                    "price": 1999.0,
                    "compare_at_price": 2999.0,
                    "stock_qty": 15,
                    "images": json.dumps(["https://images.example.com/saree.jpg"]),
                    "attributes": json.dumps({"brand": "FabIndia"}),
                    "status": "active",
                    "created_at": datetime.datetime.now(),
                    "category_name": "Ethnic",
                    "category_slug": "ethnic",
                    "store_name": "Royal Silks",
                    "store_description": "Finest silk store",
                    "store_rating": 4.9,
                    "is_verified": True,
                }
            if "from products" in q and op == "fetch":
                return [{
                    "id": "11111111-0000-0000-0000-000000000001",
                    "seller_id": self.seller_id,
                    "category_id": "cat-1",
                    "title": "Silk Saree",
                    "slug": "silk-saree",
                    "description": "Pure Kanjivaram silk saree",
                    "price": 1999.0,
                    "compare_at_price": 2999.0,
                    "stock_qty": 15,
                    "images": json.dumps(["https://images.example.com/saree.jpg"]),
                    "attributes": json.dumps({"brand": "FabIndia", "rating": 4.8}),
                    "status": "active",
                    "created_at": datetime.datetime.now(),
                    "category_name": "Ethnic",
                    "category_slug": "ethnic",
                    "store_name": "Royal Silks",
                    "seller_rating": 4.9,
                }]
            if "insert into products" in q:
                return {
                    "id": "11111111-0000-0000-0000-000000000002",
                    "seller_id": self.seller_id,
                    "title": args[2] if len(args) > 2 else "New Product",
                    "description": "Created item",
                    "price": 1499.0,
                    "stock_qty": 10,
                    "created_at": datetime.datetime.now(),
                }
            if "update products" in q:
                return {
                    "id": "11111111-0000-0000-0000-000000000001",
                    "seller_id": self.seller_id,
                    "title": "Updated Silk Saree",
                    "price": 1899.0,
                    "status": "active",
                    "created_at": datetime.datetime.now(),
                    "updated_at": datetime.datetime.now(),
                }

            return None

        self.mock_conn = MockConnection(db_handler)
        self.mock_pool = MockPool(self.mock_conn)

        set_pool(self.mock_pool)
        app.dependency_overrides[get_db] = lambda: self.mock_conn
        app.dependency_overrides[get_pool] = lambda: self.mock_pool

    def tearDown(self):
        set_pool(None)
        app.dependency_overrides.clear()

    # ------------------------------------------------------------------------
    # 1. Health Endpoints
    # ------------------------------------------------------------------------
    def test_health_check(self):
        r1 = self.client.get("/health")
        self.assertEqual(r1.status_code, 200)
        d1 = r1.json()
        self.assertTrue(d1["success"])
        self.assertEqual(d1["services"]["backend_core"], "healthy")

        r2 = self.client.get("/health/")
        self.assertEqual(r2.status_code, 200)

    # ------------------------------------------------------------------------
    # 2. Auth Endpoints
    # ------------------------------------------------------------------------
    def test_auth_register_success(self):
        resp = self.client.post("/api/auth/register", json={
            "name": "New User",
            "email": "brandnew@vyapari.in",
            "password": "Password123!",
            "phone": "9998887776"
        })
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertTrue(data["success"])
        self.assertIn("access_token", data["data"])
        self.assertIn("user", data["data"])
        self.assertIn("refresh_token", resp.cookies)

    def test_auth_register_duplicate(self):
        resp = self.client.post("/api/auth/register", json={
            "name": "Existing User",
            "email": "existing@vyapari.in",
            "password": "Password123!",
        })
        self.assertEqual(resp.status_code, 409)
        self.assertEqual(resp.json()["error"]["code"], "EMAIL_EXISTS")

    def test_auth_login_success(self):
        resp = self.client.post("/api/auth/login", json={
            "email": "existing@vyapari.in",
            "password": "ValidPass123!"
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["success"])
        self.assertIn("access_token", data["data"])
        self.assertIn("refresh_token", resp.cookies)

    def test_auth_login_invalid_password(self):
        resp = self.client.post("/api/auth/login", json={
            "email": "existing@vyapari.in",
            "password": "WrongPassword!"
        })
        self.assertEqual(resp.status_code, 401)
        self.assertEqual(resp.json()["error"]["code"], "INVALID_CREDENTIALS")

    def test_auth_refresh_token(self):
        self.client.cookies.set("refresh_token", self.customer_refresh)
        resp = self.client.post("/api/auth/refresh")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("access_token", resp.json()["data"])
        self.client.cookies.clear()

    def test_auth_logout(self):
        resp = self.client.post("/api/auth/logout")
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()["success"])

    def test_auth_me(self):
        resp = self.client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {self.customer_token}"}
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["data"]["user"]["email"], "test@vyapari.in")

    # ------------------------------------------------------------------------
    # 3. Categories Endpoints
    # ------------------------------------------------------------------------
    def test_categories_tree_and_slug(self):
        resp = self.client.get("/api/categories")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["success"])
        self.assertIn("categories", data)
        self.assertIn("flat", data)

        resp2 = self.client.get("/api/categories/fashion")
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(resp2.json()["data"]["category"]["slug"], "fashion")

    # ------------------------------------------------------------------------
    # 4. Products Endpoints
    # ------------------------------------------------------------------------
    def test_products_list_and_facets(self):
        resp_facets = self.client.get("/api/products/facets")
        self.assertEqual(resp_facets.status_code, 200)
        self.assertTrue(resp_facets.json()["success"])

        resp_list = self.client.get("/api/products?page=1&limit=10")
        self.assertEqual(resp_list.status_code, 200)
        data = resp_list.json()
        self.assertTrue(data["success"])
        self.assertIn("products", data["data"])
        self.assertIn("pagination", data["data"])

        # Natural language query search
        resp_nlq = self.client.get("/api/products?q=silk saree under 2000")
        self.assertEqual(resp_nlq.status_code, 200)

        # Single product
        resp_p = self.client.get("/api/products/11111111-0000-0000-0000-000000000001")
        self.assertEqual(resp_p.status_code, 200)
        self.assertEqual(resp_p.json()["data"]["product"]["title"], "Silk Saree")

    # ------------------------------------------------------------------------
    # 5. Cart Endpoints
    # ------------------------------------------------------------------------
    def test_cart_workflow(self):
        headers = {"Authorization": f"Bearer {self.customer_token}"}

        # Get Cart
        r_get = self.client.get("/api/cart", headers=headers)
        self.assertEqual(r_get.status_code, 200)
        self.assertIn("items", r_get.json()["data"])

        # Add Item
        r_add = self.client.post("/api/cart/items", headers=headers, json={
            "product_id": "11111111-0000-0000-0000-000000000001",
            "quantity": 2
        })
        self.assertEqual(r_add.status_code, 200)

        # Update Item
        r_put = self.client.put("/api/cart/items/item-1", headers=headers, json={"quantity": 3})
        self.assertEqual(r_put.status_code, 200)

        # Delete Item
        r_del = self.client.delete("/api/cart/items/item-1", headers=headers)
        self.assertEqual(r_del.status_code, 200)

        # Clear Cart
        r_clear = self.client.delete("/api/cart", headers=headers)
        self.assertEqual(r_clear.status_code, 200)

    # ------------------------------------------------------------------------
    # 6. Orders Endpoints
    # ------------------------------------------------------------------------
    def test_orders_workflow(self):
        headers = {"Authorization": f"Bearer {self.customer_token}"}

        # List orders
        r_list = self.client.get("/api/orders", headers=headers)
        self.assertEqual(r_list.status_code, 200)
        self.assertTrue(r_list.json()["success"])

        # Get single order
        r_single = self.client.get("/api/orders/order-123", headers=headers)
        self.assertEqual(r_single.status_code, 200)
        self.assertEqual(r_single.json()["data"]["order"]["id"], "order-123")

    # ------------------------------------------------------------------------
    # 7. Seller Endpoints
    # ------------------------------------------------------------------------
    def test_seller_onboarding_and_dashboard(self):
        cust_headers = {"Authorization": f"Bearer {self.customer_token}"}
        seller_headers = {"Authorization": f"Bearer {self.seller_token}"}

        # Onboarding status
        r_status = self.client.get("/api/seller/onboarding/status", headers=cust_headers)
        self.assertEqual(r_status.status_code, 200)

        # Onboarding submit
        r_submit = self.client.post("/api/seller/onboarding", headers=cust_headers, json={
            "store_name": "New Fabric Store",
            "store_description": "Finest cotton",
            "business_address": "45 Market Yard, Pune",
            "pan": "ABCDE1234F"
        })
        self.assertEqual(r_submit.status_code, 200)

        # Onboarding submit alias
        r_submit_alias = self.client.post("/api/seller/onboarding/submit", headers=cust_headers, json={
            "store_name": "New Fabric Store",
            "business_address": "45 Market Yard, Pune",
            "pan": "ABCDE1234F"
        })
        self.assertEqual(r_submit_alias.status_code, 200)

        # Seller Dashboard
        r_dash = self.client.get("/api/seller/dashboard", headers=seller_headers)
        self.assertEqual(r_dash.status_code, 200)
        self.assertIn("stats", r_dash.json()["data"])
        self.assertIn("total_revenue", r_dash.json()["data"]["stats"])

        # Orders to fulfill
        r_fulfill = self.client.put("/api/seller/orders/order-123/fulfill", headers=seller_headers, json={
            "status": "shipped",
            "tracking_number": "TRK987654321",
            "carrier": "BlueDart"
        })
        self.assertEqual(r_fulfill.status_code, 200)

        # Orders status alias
        r_status_alias = self.client.put("/api/seller/orders/order-123/status", headers=seller_headers, json={
            "status": "delivered"
        })
        self.assertEqual(r_status_alias.status_code, 200)

        # Inventory velocity
        r_vel = self.client.get("/api/seller/inventory/velocity", headers=seller_headers)
        self.assertEqual(r_vel.status_code, 200)

        # Settings
        r_settings = self.client.get("/api/seller/settings", headers=seller_headers)
        self.assertEqual(r_settings.status_code, 200)

    # ------------------------------------------------------------------------
    # 8. Approvals Endpoints
    # ------------------------------------------------------------------------
    def test_approvals_queue(self):
        seller_headers = {"Authorization": f"Bearer {self.seller_token}"}

        # Queue list
        r_q = self.client.get("/api/approvals", headers=seller_headers)
        self.assertEqual(r_q.status_code, 200)
        self.assertIn("queue", r_q.json()["data"])

    # ------------------------------------------------------------------------
    # 9. AI Proxy Endpoints
    # ------------------------------------------------------------------------
    def test_ai_public_endpoints(self):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.is_error = False
        mock_resp.json.return_value = [{"id": "p-1", "similarity": 0.89}]

        mock_inst = AsyncMock()
        mock_inst.get = AsyncMock(return_value=mock_resp)
        mock_inst.__aenter__.return_value = mock_inst
        mock_inst.__aexit__.return_value = None

        with patch("httpx.AsyncClient", return_value=mock_inst):
            r_sim = self.client.get("/api/ai/similar/11111111-0000-0000-0000-000000000001")
            self.assertEqual(r_sim.status_code, 200)

            r_pop = self.client.get("/api/ai/popular")
            self.assertEqual(r_pop.status_code, 200)

            r_srch = self.client.get("/api/ai/search?q=saree")
            self.assertEqual(r_srch.status_code, 200)

    # ------------------------------------------------------------------------
    # 10. Users & Address Endpoints
    # ------------------------------------------------------------------------
    def test_users_profile_and_addresses(self):
        headers = {"Authorization": f"Bearer {self.customer_token}"}

        # Profile
        r_prof = self.client.get("/api/users/profile", headers=headers)
        self.assertEqual(r_prof.status_code, 200)
        self.assertEqual(r_prof.json()["data"]["user"]["email"], "test@vyapari.in")

        # Update profile
        r_up = self.client.put("/api/users/profile", headers=headers, json={"name": "Ramesh K"})
        self.assertEqual(r_up.status_code, 200)

        # Addresses
        r_addr = self.client.get("/api/users/addresses", headers=headers)
        self.assertEqual(r_addr.status_code, 200)
        self.assertIsInstance(r_addr.json()["data"], list)

    # ------------------------------------------------------------------------
    # 11. Wishlist Endpoints
    # ------------------------------------------------------------------------
    def test_wishlist_endpoints(self):
        headers = {"Authorization": f"Bearer {self.customer_token}"}

        r_get = self.client.get("/api/wishlist", headers=headers)
        self.assertEqual(r_get.status_code, 200)
        self.assertIn("items", r_get.json()["data"])

        r_add = self.client.post("/api/wishlist", headers=headers, json={
            "product_id": "11111111-0000-0000-0000-000000000001"
        })
        self.assertEqual(r_add.status_code, 200)

        r_del = self.client.delete("/api/wishlist/11111111-0000-0000-0000-000000000001", headers=headers)
        self.assertEqual(r_del.status_code, 200)

    # ------------------------------------------------------------------------
    # 12. Notifications Endpoints
    # ------------------------------------------------------------------------
    def test_notifications_endpoints(self):
        headers = {"Authorization": f"Bearer {self.customer_token}"}

        r_get = self.client.get("/api/notifications", headers=headers)
        self.assertEqual(r_get.status_code, 200)
        self.assertIn("notifications", r_get.json()["data"])

        r_read = self.client.put("/api/notifications/notif-1/read", headers=headers)
        self.assertEqual(r_read.status_code, 200)

        r_read_all = self.client.put("/api/notifications/read-all", headers=headers)
        self.assertEqual(r_read_all.status_code, 200)

    # ------------------------------------------------------------------------
    # 13. Stores Endpoints
    # ------------------------------------------------------------------------
    def test_stores_endpoints(self):
        resp = self.client.get(f"/api/stores/{self.seller_id}")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["data"]["store"]["store_name"], "Royal Silks")

    # ------------------------------------------------------------------------
    # 14. Admin Endpoints
    # ------------------------------------------------------------------------
    def test_admin_endpoints(self):
        admin_headers = {"Authorization": f"Bearer {self.admin_token}"}

        # Metrics
        r_met = self.client.get("/api/admin/metrics", headers=admin_headers)
        self.assertEqual(r_met.status_code, 200)
        self.assertTrue(r_met.json()["success"])
        self.assertIn("total_revenue", r_met.json()["data"])

        # System Health
        r_sys = self.client.get("/api/admin/system/health", headers=admin_headers)
        self.assertEqual(r_sys.status_code, 200)
        self.assertEqual(r_sys.json()["data"]["microservices"]["team_a_pgvector"], "online")

        # Sellers list
        r_sellers = self.client.get("/api/admin/sellers", headers=admin_headers)
        self.assertEqual(r_sellers.status_code, 200)
        self.assertIsInstance(r_sellers.json()["data"], list)

        # Products list
        r_prods = self.client.get("/api/admin/products", headers=admin_headers)
        self.assertEqual(r_prods.status_code, 200)

    # ------------------------------------------------------------------------
    # 15. Reviews Endpoints
    # ------------------------------------------------------------------------
    def test_reviews_endpoints(self):
        p_id = "11111111-0000-0000-0000-000000000001"

        # Product reviews
        r_get = self.client.get(f"/api/reviews/product/{p_id}")
        self.assertEqual(r_get.status_code, 200)
        data = r_get.json()["data"]
        self.assertEqual(data["average_rating"], 5.0)
        self.assertEqual(data["total"], 1)

        # Helpful upvote
        r_help = self.client.post("/api/reviews/11111111-2222-3333-4444-555555555555/helpful")
        self.assertEqual(r_help.status_code, 200)
        self.assertEqual(r_help.json()["data"]["helpful_count"], 13)

        # Seller reviews inbox
        seller_headers = {"Authorization": f"Bearer {self.seller_token}"}
        r_seller_rev = self.client.get("/api/reviews/seller", headers=seller_headers)
        self.assertEqual(r_seller_rev.status_code, 200)

    # ------------------------------------------------------------------------
    # 16. Security & Error Handling Edge Cases
    # ------------------------------------------------------------------------
    def test_auth_guard_missing_token(self):
        resp = self.client.get("/api/orders")
        self.assertEqual(resp.status_code, 401)
        self.assertEqual(resp.json()["error"]["code"], "UNAUTHORIZED")

    def test_role_guard_forbidden(self):
        # Customer trying to access Admin metrics
        resp = self.client.get(
            "/api/admin/metrics",
            headers={"Authorization": f"Bearer {self.customer_token}"}
        )
        self.assertEqual(resp.status_code, 403)
        self.assertEqual(resp.json()["error"]["code"], "FORBIDDEN")

    def test_route_not_found(self):
        resp = self.client.get("/api/unknown-route-12345")
        self.assertEqual(resp.status_code, 404)
        self.assertEqual(resp.json()["error"]["code"], "ROUTE_NOT_FOUND")

    def test_validation_error_handling(self):
        resp = self.client.post("/api/auth/register", json={"invalid": "payload"})
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["error"]["code"], "VALIDATION_ERROR")


if __name__ == "__main__":
    unittest.main()
