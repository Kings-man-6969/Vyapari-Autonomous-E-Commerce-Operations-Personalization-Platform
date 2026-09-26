"""
Seller Showcase Pages - integration tests against a real PostgreSQL database.

These are deliberately NOT mock-based. The V7 schema is enforced by CHECK
constraints, partial unique indexes and cross-table foreign keys, and a mock
connection cannot exercise any of that. An earlier draft of public_pages.py
queried seller_profiles.business_name and products.rating_avg, neither of which
exists in db/migrations/; only a real database caught it.

Skipped automatically when TEST_DATABASE_URL is unset, so the existing
`unittest discover` run stays green without a database. CI sets it (see
.github/workflows/ci.yml, which now provisions pgvector).

    python -m unittest tests.test_seller_pages -v
    TEST_DATABASE_URL=postgresql://... python -m unittest tests.test_seller_pages
"""
import json
import os
import unittest
import uuid

import asyncpg
import httpx
from jose import jwt

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "").strip()

# An approved media host, so validate_media_url accepts it.
CDN = "https://demo.appwrite.io"


@unittest.skipUnless(
    TEST_DATABASE_URL,
    "TEST_DATABASE_URL not set; skipping real-database seller-page tests",
)
class SellerPageTests(unittest.IsolatedAsyncioTestCase):
    maxDiff = None

    # Python 3.10's IsolatedAsyncioTestCase has no asyncSetUpClass and builds a
    # fresh event loop for every test, so an asyncpg pool cannot be shared across
    # tests - it would be bound to an already-closed loop. Hence per-test setup.
    #
    # The Redis cache is deliberately left uninitialised: with _redis set to None
    # every accessor transparently uses the InMemoryCache fallback, which avoids
    # paying the 2s connection timeout on each of the ~30 tests.
    async def asyncSetUp(self):
        from app.db import set_pool
        from app.main import app

        self.pool = await asyncpg.create_pool(dsn=TEST_DATABASE_URL, min_size=1, max_size=4)
        set_pool(self.pool)

        # The test database persists between runs, so start from empty. Handles
        # are derived from store names, which makes a leftover row from a
        # previous run otherwise cause phantom HANDLE_TAKEN conflicts.
        # categories must be listed explicitly: it is not reachable from users
        # via CASCADE, so TRUNCATE users alone would leave 'Apparel' behind and
        # break the unique constraint on the next test.
        await self.pool.execute("TRUNCATE users, categories RESTART IDENTITY CASCADE")

        # categories.name is UNIQUE and the DB starts empty, so create the one
        # category these tests need once per test.
        self.category_id = await self.pool.fetchval(
            "INSERT INTO categories (name, slug) VALUES ('Apparel','apparel') RETURNING id"
        )

        self.app = app
        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://testserver"
        )

    async def asyncTearDown(self):
        from app.db import set_pool

        await self.client.aclose()
        await self.pool.close()
        set_pool(None)

    def err_code(self, response: httpx.Response) -> str:
        """
        main.py wraps every HTTPException as {success: false, error: {...}} and
        maps RequestValidationError to 400 VALIDATION_ERROR (not 422), so error
        codes live under "error", not "detail".
        """
        return response.json()["error"]["code"]

    # -- fixtures ----------------------------------------------------------

    async def make_seller(self, role: str = "seller", store_name: str = "Aura Living") -> dict:
        # users.role is CHECK-constrained to customer | seller | admin.
        assert role in ("customer", "seller", "admin"), f"bad role {role}"
        uid = uuid.uuid4()
        await self.pool.execute(
            "INSERT INTO users (id, name, email, password_hash, role) VALUES ($1,$2,$3,'x',$4)",
            uid, store_name, f"{uuid.uuid4().hex}@test.local", role,
        )
        if role in ("seller", "admin"):
            await self.pool.execute(
                "INSERT INTO seller_profiles (user_id, store_name) VALUES ($1,$2)",
                uid, store_name,
            )
        return {"id": str(uid), "role": role, "store_name": store_name}

    async def make_product(self, seller_id: str, title: str = "Cotton Kurta", price: float = 899.0):
        # products.category_id / description / slug are NOT NULL.
        pid = uuid.uuid4()
        await self.pool.execute(
            """INSERT INTO products
                 (id, seller_id, category_id, title, slug, description, price, stock_qty, status, images)
               VALUES ($1,$2,$3,$4,$5,$6,$7,10,'active','[]'::jsonb)""",
            pid, seller_id, self.category_id, title, f"p-{uuid.uuid4().hex[:8]}",
            f"{title} description", price,
        )
        return str(pid)

    def auth(self, user: dict) -> dict:
        from app.config import settings

        token = jwt.encode(
            {"id": user["id"], "role": user["role"], "sub": user["id"]},
            settings.JWT_ACCESS_SECRET, algorithm="HS256",
        )
        return {"Authorization": f"Bearer {token}"}

    async def grant(self, admin: dict, seller_id: str, plan: str = "pro"):
        r = await self.client.post(
            "/api/seller-pages/mine/plan",
            json={"seller_id": seller_id, "plan": plan, "days": 30},
            headers=self.auth(admin),
        )
        self.assertEqual(r.status_code, 201, r.text)
        return r.json()["data"]

    async def add_image(self, seller: dict, url: str = None) -> dict:
        r = await self.client.post(
            "/api/seller-pages/mine/media",
            json={
                "media_type": "image",
                "storage_id": f"s-{uuid.uuid4().hex[:10]}",
                "url": url or f"{CDN}/storage/v1/files/img-{uuid.uuid4().hex[:8]}",
                "width": 1080, "height": 1350,
            },
            headers=self.auth(seller),
        )
        self.assertEqual(r.status_code, 201, r.text)
        return r.json()["data"]

    async def publish(self, seller: dict, handle: str):
        """Bring a page to a publicly visible state: avatar + one media item."""
        page = await self.client.get("/api/seller-pages/mine", headers=self.auth(seller))
        self.assertEqual(page.status_code, 200, page.text)
        data = page.json()["data"]
        media = await self.add_image(seller)
        put = await self.client.put(
            "/api/seller-pages/mine",
            json={"handle": handle, "avatar_media_id": media["id"]},
            headers=self.auth(seller),
        )
        self.assertEqual(put.status_code, 200, f"avatar/handle update failed: {put.text}")
        r = await self.client.post(
            "/api/seller-pages/mine/publish", json={"publish": True}, headers=self.auth(seller)
        )
        self.assertEqual(r.status_code, 200, r.text)
        return data

    # -- page lifecycle ----------------------------------------------------

    async def test_page_autocreated_with_derived_handle(self):
        seller = await self.make_seller(store_name="Aura Living")
        r = await self.client.get("/api/seller-pages/mine", headers=self.auth(seller))
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()["data"]
        self.assertEqual(data["handle"], "aura-living")
        self.assertFalse(data["is_published"])
        self.assertEqual(data["entitlement"]["plan"], "free")
        self.assertEqual(data["public_url"], "/store/aura-living")
        self.assertEqual(data["usage"]["media"]["limit"], 12)

    async def test_two_sellers_getting_same_slug_get_distinct_handles(self):
        a = await self.make_seller(store_name="Aura Living")
        b = await self.make_seller(store_name="Aura-Living")
        ha = (await self.client.get("/api/seller-pages/mine", headers=self.auth(a))).json()["data"]["handle"]
        hb = (await self.client.get("/api/seller-pages/mine", headers=self.auth(b))).json()["data"]["handle"]
        self.assertEqual(ha, "aura-living")
        self.assertEqual(hb, "aura-living-2")

    async def test_non_seller_role_is_rejected(self):
        buyer = await self.make_seller(role="customer", store_name="Nope")
        r = await self.client.get("/api/seller-pages/mine", headers=self.auth(buyer))
        self.assertEqual(r.status_code, 403, r.text)
        self.assertEqual(self.err_code(r), "FORBIDDEN")

    async def test_unauthenticated_cannot_read_own_page(self):
        r = await self.client.get("/api/seller-pages/mine")
        self.assertEqual(r.status_code, 401)

    # -- handle validation -------------------------------------------------

    async def test_handle_normalisation_and_rejections(self):
        seller = await self.make_seller(store_name="Some Other Name")
        h = self.auth(seller)
        # Derived handle is "some-other-name".

        # "Aura Living  Shop" normalises to "aura-living-shop"
        r = await self.client.put("/api/seller-pages/mine", json={"handle": "Aura Living  Shop"}, headers=h)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["data"]["handle"], "aura-living-shop")

        # Re-submitting the same handle is a no-op, not a conflict.
        r = await self.client.put("/api/seller-pages/mine", json={"handle": "Aura Living Shop"}, headers=h)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["data"]["handle"], "aura-living-shop")

        # Leading/trailing decoration is stripped rather than rejected, so a
        # seller pasting "@aura-living-" gets the handle they meant.
        r = await self.client.put("/api/seller-pages/mine", json={"handle": "@Aura_Living--"}, headers=h)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["data"]["handle"], "aura-living")

        for bad, why in [
            ("ab", "too short"),
            ("x" * 31, "too long"),
            ("admin", "reserved word"),
            ("store", "reserved word"),
            ("!!!", "no usable characters"),
            ("   ", "blank"),
        ]:
            r = await self.client.put("/api/seller-pages/mine", json={"handle": bad}, headers=h)
            self.assertEqual(r.status_code, 400, f"{bad!r} ({why}) should be rejected: {r.text}")
            self.assertEqual(self.err_code(r), "INVALID_HANDLE", why)

    async def test_taken_handle_conflicts(self):
        a = await self.make_seller(store_name="First Shop")
        b = await self.make_seller(store_name="Second Shop")
        await self.client.get("/api/seller-pages/mine", headers=self.auth(a))
        await self.client.get("/api/seller-pages/mine", headers=self.auth(b))
        r = await self.client.put(
            "/api/seller-pages/mine", json={"handle": "first-shop"}, headers=self.auth(b)
        )
        self.assertEqual(r.status_code, 409, r.text)
        self.assertEqual(self.err_code(r), "HANDLE_TAKEN")

    # -- free tier gating --------------------------------------------------

    async def test_free_tier_blocks_premium_features(self):
        seller = await self.make_seller()
        h = self.auth(seller)

        r = await self.client.post(
            "/api/seller-pages/mine/media",
            json={"media_type": "video", "storage_id": "v1", "url": f"{CDN}/v", "poster_url": f"{CDN}/p"},
            headers=h,
        )
        self.assertEqual(r.status_code, 402, r.text)
        self.assertEqual(self.err_code(r), "PLAN_UPGRADE_REQUIRED")

        r = await self.client.post("/api/seller-pages/mine/highlights", json={"title": "New In"}, headers=h)
        self.assertEqual(r.status_code, 402, r.text)

        r = await self.client.put("/api/seller-pages/mine", json={"theme_accent": "#38bdf8"}, headers=h)
        self.assertEqual(r.status_code, 402, r.text)

        r = await self.client.get("/api/seller-pages/mine/analytics", headers=h)
        self.assertEqual(r.status_code, 402, r.text)

    async def test_free_tier_media_cap_is_enforced(self):
        seller = await self.make_seller()
        for _ in range(12):
            await self.add_image(seller)
        r = await self.client.post(
            "/api/seller-pages/mine/media",
            json={"media_type": "image", "storage_id": "s13", "url": f"{CDN}/x13"},
            headers=self.auth(seller),
        )
        self.assertEqual(r.status_code, 402, r.text)
        detail = r.json()["error"]
        self.assertEqual(detail["code"], "PLAN_LIMIT_REACHED")
        self.assertEqual(detail["details"]["limit"], 12)
        self.assertEqual(detail["details"]["current"], 12)
        self.assertEqual(detail["details"]["current_plan"], "free")

    # -- paid tier ---------------------------------------------------------

    async def test_admin_grant_unlocks_features_and_cache_is_invalidated(self):
        admin = await self.make_seller(role="admin")
        seller = await self.make_seller()
        h = self.auth(seller)

        # Warm the entitlement cache while the seller is still on free.
        before = (await self.client.get("/api/seller-pages/mine", headers=h)).json()["data"]
        self.assertEqual(before["entitlement"]["plan"], "free")

        await self.grant(admin, seller["id"], "pro")

        after = (await self.client.get("/api/seller-pages/mine", headers=h)).json()["data"]
        self.assertEqual(after["entitlement"]["plan"], "pro")
        self.assertEqual(after["usage"]["media"]["limit"], 120)

        # Premium writes now succeed.
        r = await self.client.post(
            "/api/seller-pages/mine/media",
            json={
                "media_type": "video", "storage_id": "v1",
                "url": f"{CDN}/v", "poster_url": f"{CDN}/p",
            },
            headers=h,
        )
        self.assertEqual(r.status_code, 201, r.text)
        r = await self.client.post("/api/seller-pages/mine/highlights", json={"title": "New In"}, headers=h)
        self.assertEqual(r.status_code, 201, r.text)
        r = await self.client.put("/api/seller-pages/mine", json={"theme_accent": "#38bdf8"}, headers=h)
        self.assertEqual(r.status_code, 200, r.text)

    async def test_seller_cannot_self_grant_a_paid_plan(self):
        seller = await self.make_seller()
        r = await self.client.post(
            "/api/seller-pages/mine/plan",
            json={"seller_id": seller["id"], "plan": "elite"},
            headers=self.auth(seller),
        )
        self.assertEqual(r.status_code, 403, r.text)

    async def test_only_one_live_subscription_per_seller(self):
        admin = await self.make_seller(role="admin")
        seller = await self.make_seller()
        await self.grant(admin, seller["id"], "pro")
        await self.grant(admin, seller["id"], "elite")
        row = await self.pool.fetchrow(
            """SELECT plan, status FROM seller_subscriptions
                WHERE seller_id = $1::uuid AND status IN ('trialing','active')""",
            seller["id"],
        )
        self.assertEqual(row["plan"], "elite")
        live = await self.pool.fetchval(
            "SELECT COUNT(*) FROM seller_subscriptions WHERE seller_id=$1::uuid AND status IN ('trialing','active')",
            seller["id"],
        )
        self.assertEqual(live, 1)

    async def test_expired_subscription_falls_back_to_free(self):
        admin = await self.make_seller(role="admin")
        seller = await self.make_seller()
        await self.grant(admin, seller["id"], "pro")
        await self.pool.execute(
            """UPDATE seller_subscriptions
                  SET starts_at = NOW() - INTERVAL '2 days',
                      ends_at   = NOW() - INTERVAL '1 day'
                WHERE seller_id = $1::uuid""",
            seller["id"],
        )
        from app.seller_page_service import invalidate_entitlement_cache
        await invalidate_entitlement_cache(seller["id"])
        ent = (await self.client.get("/api/seller-pages/mine", headers=self.auth(seller))).json()["data"]
        self.assertEqual(ent["entitlement"]["plan"], "free")

    # -- media safety ------------------------------------------------------

    async def test_media_url_must_be_https_on_an_approved_host(self):
        seller = await self.make_seller()
        h = self.auth(seller)
        for bad in [
            "javascript:alert(1)",
            "data:text/html;base64,PHNjcmlwdD4=",
            "http://demo.appwrite.io/x",          # plain http
            "https://evil.example.com/x.jpg",     # unapproved host
            "file:///etc/passwd",
        ]:
            r = await self.client.post(
                "/api/seller-pages/mine/media",
                json={"media_type": "image", "storage_id": "s", "url": bad},
                headers=h,
            )
            self.assertEqual(r.status_code, 400, f"{bad!r} should be rejected: {r.text}")
            self.assertEqual(self.err_code(r), "INVALID_MEDIA_URL", bad)

    async def test_video_without_poster_is_rejected(self):
        admin = await self.make_seller(role="admin")
        seller = await self.make_seller()
        await self.grant(admin, seller["id"], "pro")
        r = await self.client.post(
            "/api/seller-pages/mine/media",
            json={"media_type": "video", "storage_id": "v", "url": f"{CDN}/v"},
            headers=self.auth(seller),
        )
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(self.err_code(r), "POSTER_REQUIRED")

    async def test_cannot_tag_another_sellers_product(self):
        a = await self.make_seller()
        b = await self.make_seller()
        product_id = await self.make_product(a["id"], "A's kurta")
        r = await self.client.post(
            "/api/seller-pages/mine/media",
            json={
                "media_type": "image", "storage_id": "s", "url": f"{CDN}/x",
                "product_id": product_id,
            },
            headers=self.auth(b),
        )
        self.assertEqual(r.status_code, 403, r.text)
        self.assertEqual(self.err_code(r), "NOT_PRODUCT_OWNER")

    async def test_can_tag_own_product(self):
        seller = await self.make_seller()
        product_id = await self.make_product(seller["id"], "My Kurta")
        media = await self.add_image(seller)
        r = await self.client.patch(
            f"/api/seller-pages/mine/media/{media['id']}",
            json={"product_id": product_id},
            headers=self.auth(seller),
        )
        self.assertEqual(r.status_code, 200, r.text)

    # -- publishing and public visibility -----------------------------------

    async def test_publish_requires_avatar_and_media(self):
        seller = await self.make_seller()
        r = await self.client.post(
            "/api/seller-pages/mine/publish", json={"publish": True}, headers=self.auth(seller)
        )
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(self.err_code(r), "PAGE_NOT_READY")

    async def test_unpublished_page_is_404_publicly_but_visible_to_owner(self):
        seller = await self.make_seller(store_name="Hidden Shop")
        await self.client.get("/api/seller-pages/mine", headers=self.auth(seller))

        anon = await self.client.get("/api/public/stores/hidden-shop")
        self.assertEqual(anon.status_code, 404, anon.text)
        self.assertEqual(self.err_code(anon), "STORE_NOT_FOUND")

        # The owner can preview their own draft.
        preview = await self.client.get("/api/public/stores/hidden-shop", headers=self.auth(seller))
        self.assertEqual(preview.status_code, 200, preview.text)
        self.assertTrue(preview.json()["data"]["viewer"]["is_owner"])

    async def test_published_page_is_publicly_readable(self):
        seller = await self.make_seller(store_name="Open Shop")
        await self.publish(seller, "open-shop")
        await self.make_product(seller["id"], "Silk Saree", 2499.0)

        r = await self.client.get("/api/public/stores/open-shop")
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()["data"]
        self.assertEqual(data["page"]["handle"], "open-shop")
        self.assertEqual(data["seller"]["store_name"], "Open Shop")
        self.assertEqual(len(data["media"]), 1)
        self.assertTrue(data["products"])
        self.assertEqual(data["products"][0]["title"], "Silk Saree")
        self.assertEqual(data["page"]["plan"], "free")
        self.assertFalse(data["viewer"]["is_owner"])

    async def test_avatar_and_cover_urls_resolve_on_both_owner_and_public_reads(self):
        """
        seller_pages stores avatar_media_id, never a URL, so the profile picture
        only appears if the query joins seller_media. An earlier revision had that
        join on the public query but not the owner's, which made avatar_url null
        in every response and dropped the seller's photo from the page.
        """
        admin = await self.make_seller(role="admin")
        seller = await self.make_seller(store_name="Portrait Shop")
        await self.grant(admin, seller["id"], "pro")
        await self.publish(seller, "portrait-shop")

        avatar_media = (await self.client.get(
            "/api/seller-pages/mine", headers=self.auth(seller)
        )).json()["data"]["avatar_media_id"]
        self.assertIsNotNone(avatar_media, "publish() should have set an avatar")

        expected = await self.pool.fetchval(
            "SELECT url FROM seller_media WHERE id = $1::uuid", avatar_media
        )

        owner_view = (await self.client.get(
            "/api/seller-pages/mine", headers=self.auth(seller)
        )).json()["data"]
        public_view = (await self.client.get(
            "/api/public/stores/portrait-shop"
        )).json()["data"]["page"]

        self.assertEqual(owner_view["avatar_url"], expected)
        self.assertEqual(public_view["avatar_url"], expected)
        self.assertTrue(public_view["avatar_url"].startswith("https://"))

    async def test_public_products_carry_the_fields_productcard_reads(self):
        """ProductCard reads stock_qty and falls back to 0 when it is absent."""
        seller = await self.make_seller(store_name="Catalogued Shop")
        await self.make_product(seller["id"], "Handwoven Throw", 1450.0)
        await self.publish(seller, "catalogued-shop")

        products = (await self.client.get(
            "/api/public/stores/catalogued-shop"
        )).json()["data"]["products"]
        self.assertEqual(len(products), 1)
        for field in ("id", "title", "price", "compare_at_price", "images", "stock_qty", "in_stock"):
            self.assertIn(field, products[0], f"ProductCard needs {field}")
        self.assertEqual(products[0]["stock_qty"], 10)
        self.assertTrue(products[0]["in_stock"])

    async def test_block_config_is_an_object_not_raw_json_text(self):
        """
        The pool sets no jsonb codec, so asyncpg returns jsonb as text. The block
        API declares config as a dict on write, so a read that handed back the
        raw string made the contract asymmetric and every config-driven block
        (media_grid, reels, testimonials) silently fell back to its defaults.
        """
        seller = await self.make_seller(store_name="Configured Shop")
        await self.publish(seller, "configured-shop")

        block_id = await self.pool.fetchval(
            """INSERT INTO seller_page_blocks
                 (seller_page_id, block_type, title, config, sort_order)
               SELECT sp.id, 'testimonials', 'What people say',
                      jsonb_build_object('quotes', $2::jsonb), 1
                 FROM seller_pages sp WHERE sp.seller_id = $1::uuid
               RETURNING id""",
            seller["id"],
            json.dumps([{"quote": "Took three weeks and it was worth it.", "author": "Ila", "rating": 5}]),
        )
        self.assertIsNotNone(block_id)

        blocks = (await self.client.get(
            "/api/public/stores/configured-shop"
        )).json()["data"]["blocks"]

        testimonials = next(b for b in blocks if b["block_type"] == "testimonials")
        self.assertIsInstance(testimonials["config"], dict)
        self.assertEqual(len(testimonials["config"]["quotes"]), 1)
        self.assertEqual(testimonials["config"]["quotes"][0]["author"], "Ila")

    async def test_block_config_degrades_rather_than_raising(self):
        """A non-object or unparseable config must not 500 the public page."""
        seller = await self.make_seller(store_name="Broken Config Shop")
        await self.publish(seller, "broken-config-shop")
        await self.pool.execute(
            """INSERT INTO seller_page_blocks
                 (seller_page_id, block_type, title, config, sort_order)
               SELECT sp.id, 'testimonials', 'Odd config', '"just a string"'::jsonb, 1
                 FROM seller_pages sp WHERE sp.seller_id = $1::uuid""",
            seller["id"],
        )
        res = await self.client.get("/api/public/stores/broken-config-shop")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(
            res.json()["data"]["blocks"][0]["config"], {},
            "a scalar jsonb config should normalise to an empty object",
        )

    async def test_unknown_handle_is_404(self):
        r = await self.client.get("/api/public/stores/does-not-exist-at-all")
        self.assertEqual(r.status_code, 404, r.text)

    async def test_view_counter_increments(self):
        seller = await self.make_seller(store_name="Counted Shop")
        await self.publish(seller, "counted-shop")
        for _ in range(3):
            r = await self.client.post("/api/public/stores/counted-shop/view", json={})
            self.assertEqual(r.status_code, 200, r.text)
        page = await self.client.get("/api/public/stores/counted-shop")
        self.assertEqual(page.json()["data"]["page"]["view_count"], 3)

    # -- follow ------------------------------------------------------------

    async def test_follow_and_unfollow(self):
        seller = await self.make_seller(store_name="Followed Shop")
        await self.publish(seller, "followed-shop")
        buyer = await self.make_seller(role="customer", store_name="Buyer")

        r = await self.client.post("/api/public/stores/followed-shop/follow", headers=self.auth(buyer))
        self.assertEqual(r.status_code, 201, r.text)
        self.assertTrue(r.json()["data"]["is_following"])
        self.assertEqual(r.json()["data"]["follower_count"], 1)

        # Idempotent.
        await self.client.post("/api/public/stores/followed-shop/follow", headers=self.auth(buyer))
        page = await self.client.get("/api/public/stores/followed-shop", headers=self.auth(buyer))
        self.assertTrue(page.json()["data"]["viewer"]["is_following"])
        self.assertEqual(page.json()["data"]["page"]["follower_count"], 1)

        r = await self.client.delete("/api/public/stores/followed-shop/follow", headers=self.auth(buyer))
        self.assertEqual(r.status_code, 200, r.text)
        self.assertFalse(r.json()["data"]["is_following"])

    async def test_follow_requires_auth_and_blocks_self_follow(self):
        seller = await self.make_seller(store_name="Solo Shop")
        await self.publish(seller, "solo-shop")

        r = await self.client.post("/api/public/stores/solo-shop/follow")
        self.assertEqual(r.status_code, 401, r.text)

        r = await self.client.post("/api/public/stores/solo-shop/follow", headers=self.auth(seller))
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(self.err_code(r), "SELF_FOLLOW")

    # -- blocks ------------------------------------------------------------

    async def test_block_cta_url_is_restricted(self):
        admin = await self.make_seller(role="admin")
        seller = await self.make_seller()
        await self.grant(admin, seller["id"], "pro")
        h = self.auth(seller)

        r = await self.client.post(
            "/api/seller-pages/mine/blocks",
            json={"block_type": "hero_banner", "cta_href": "javascript:alert(1)"},
            headers=h,
        )
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(self.err_code(r), "UNSAFE_CTA_URL")

        r = await self.client.post(
            "/api/seller-pages/mine/blocks",
            json={"block_type": "hero_banner", "cta_label": "Shop", "cta_href": "/products"},
            headers=h,
        )
        self.assertEqual(r.status_code, 201, r.text)

    async def test_invalid_block_type_and_schedule_rejected(self):
        admin = await self.make_seller(role="admin")
        seller = await self.make_seller()
        await self.grant(admin, seller["id"], "pro")
        h = self.auth(seller)

        r = await self.client.post(
            "/api/seller-pages/mine/blocks", json={"block_type": "teleporter"}, headers=h
        )
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(self.err_code(r), "INVALID_BLOCK_TYPE")

        r = await self.client.post(
            "/api/seller-pages/mine/blocks",
            json={
                "block_type": "announcement",
                "starts_at": "2026-12-01T00:00:00Z",
                "ends_at": "2026-01-01T00:00:00Z",
            },
            headers=h,
        )
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(self.err_code(r), "INVALID_SCHEDULE")

    async def test_scheduled_blocks_render_only_inside_their_window(self):
        admin = await self.make_seller(role="admin")
        seller = await self.make_seller(store_name="Promo Shop")
        await self.grant(admin, seller["id"], "pro")
        await self.publish(seller, "promo-shop")

        live = await self.client.post(
            "/api/seller-pages/mine/blocks",
            json={"block_type": "announcement", "title": "Live sale"},
            headers=self.auth(seller),
        )
        self.assertEqual(live.status_code, 201, live.text)

        # A pro seller is entitled to a reels block.
        reels = await self.client.post(
            "/api/seller-pages/mine/blocks",
            json={"block_type": "reels", "title": "Reels"},
            headers=self.auth(seller),
        )
        self.assertEqual(reels.status_code, 201, reels.text)

        # One that already ended must not appear publicly.
        ended = await self.client.post(
            "/api/seller-pages/mine/blocks",
            json={
                "block_type": "announcement", "title": "Summer sale ended",
                "starts_at": "2026-01-01T00:00:00Z", "ends_at": "2026-02-01T00:00:00Z",
            },
            headers=self.auth(seller),
        )
        self.assertEqual(ended.status_code, 201, ended.text)

        page = await self.client.get("/api/public/stores/promo-shop")
        self.assertEqual(page.status_code, 200, page.text)
        blocks = page.json()["data"]["blocks"]
        titles = [b["title"] for b in blocks]
        self.assertIn("Live sale", titles)
        self.assertIn("Reels", titles)
        self.assertNotIn("Summer sale ended", titles)

    async def test_free_seller_does_not_see_reels_block(self):
        admin = await self.make_seller(role="admin")
        seller = await self.make_seller(store_name="Downgrade Shop")
        await self.grant(admin, seller["id"], "pro")
        await self.publish(seller, "downgrade-shop")
        await self.client.post(
            "/api/seller-pages/mine/blocks",
            json={"block_type": "reels", "title": "Reels"},
            headers=self.auth(seller),
        )

        # Downgrade to free and confirm the reels block disappears from the
        # public render, not just from the editor.
        await self.grant(admin, seller["id"], "free")
        page = await self.client.get("/api/public/stores/downgrade-shop")
        types = [b["block_type"] for b in page.json()["data"]["blocks"]]
        self.assertNotIn("reels", types)
        self.assertEqual(page.json()["data"]["page"]["plan"], "free")

    # -- media grid paging -------------------------------------------------

    async def test_media_grid_paginates(self):
        admin = await self.make_seller(role="admin")
        seller = await self.make_seller(store_name="Big Shop")
        await self.grant(admin, seller["id"], "pro")
        for _ in range(4):
            await self.add_image(seller)
        # publish() adds a 5th item (the avatar).
        await self.publish(seller, "big-shop")

        first = await self.client.get("/api/public/stores/big-shop/media?limit=2&offset=0")
        self.assertEqual(first.status_code, 200, first.text)
        d = first.json()["data"]
        self.assertEqual(len(d["media"]), 2)
        self.assertEqual(d["total"], 5)
        self.assertTrue(d["has_more"])

        last = await self.client.get("/api/public/stores/big-shop/media?limit=2&offset=4")
        self.assertEqual(len(last.json()["data"]["media"]), 1)
        self.assertFalse(last.json()["data"]["has_more"])

        # Out-of-range page returns empty, not an error.
        beyond = await self.client.get("/api/public/stores/big-shop/media?limit=2&offset=99")
        self.assertEqual(beyond.status_code, 200)
        self.assertEqual(beyond.json()["data"]["media"], [])

    async def test_media_pagination_rejects_bad_params(self):
        # main.py maps RequestValidationError to 400 VALIDATION_ERROR, not 422.
        for qs in ["?limit=0", "?limit=999", "?offset=-1"]:
            r = await self.client.get(f"/api/public/stores/whatever/media{qs}")
            self.assertEqual(r.status_code, 400, f"{qs} -> {r.status_code} {r.text}")
            self.assertEqual(self.err_code(r), "VALIDATION_ERROR", qs)

    # -- sorting -----------------------------------------------------------

    async def test_product_sorting_is_whitelisted(self):
        seller = await self.make_seller(store_name="Sort Shop")
        for i, price in enumerate([500.0, 100.0, 900.0]):
            await self.make_product(seller["id"], f"Item {i}", price)
        await self.publish(seller, "sort-shop")

        asc = await self.client.get("/api/public/stores/sort-shop/products?sort=price_asc")
        self.assertEqual(asc.status_code, 200, asc.text)
        prices = [p["price"] for p in asc.json()["data"]["products"]]
        self.assertEqual(prices, sorted(prices))

        desc = await self.client.get("/api/public/stores/sort-shop/products?sort=price_desc")
        prices = [p["price"] for p in desc.json()["data"]["products"]]
        self.assertEqual(prices, sorted(prices, reverse=True))

        r = await self.client.get("/api/public/stores/sort-shop/products?sort=drop_table")
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(self.err_code(r), "VALIDATION_ERROR")

    # -- reorder -----------------------------------------------------------

    async def test_media_reorder_only_touches_own_page(self):
        admin = await self.make_seller(role="admin")
        a = await self.make_seller(store_name="Reorder A")
        b = await self.make_seller(store_name="Reorder B")
        await self.grant(admin, a["id"], "pro")
        await self.grant(admin, b["id"], "pro")

        a_media = [await self.add_image(a) for _ in range(3)]
        b_media = [await self.add_image(b) for _ in range(2)]

        r = await self.client.put(
            "/api/seller-pages/mine/media/order",
            json={"ids": [b_media[0]["id"], a_media[2]["id"], a_media[0]["id"]]},
            headers=self.auth(a),
        )
        self.assertEqual(r.status_code, 200, r.text)
        # Only the two ids that actually belong to A were moved; B's media id is
        # ignored rather than erroring, because the WHERE clause scopes to A.
        self.assertEqual(r.json()["data"]["reordered"], 2)

        a_sort = await self.pool.fetch(
            """SELECT id, sort_order FROM seller_media
                WHERE seller_page_id = (SELECT id FROM seller_pages WHERE seller_id = $1::uuid)""",
            a["id"],
        )
        # Positions are 1-based (generate_subscripts(..., 1)), matching the
        # COALESCE(MAX(sort_order),0)+1 used on insert. Inserts gave a0=1,a1=2,a2=3;
        # ids = [b0, a2, a0] moves a2 -> 2 and a0 -> 3, leaving a1 at 2. A
        # partial reorder therefore leaves duplicate sort_order values, which is
        # why every grid query breaks ties on id -- otherwise paginating an
        # infinite scroll with unstable ordering silently drops and repeats rows.
        self.assertEqual(
            {str(row["id"]): row["sort_order"] for row in a_sort},
            {a_media[0]["id"]: 3, a_media[1]["id"]: 2, a_media[2]["id"]: 2},
        )

        # B's ordering is untouched.
        b_sort = await self.pool.fetch(
            """SELECT id, sort_order FROM seller_media
                WHERE seller_page_id = (SELECT id FROM seller_pages WHERE seller_id = $1::uuid)""",
            b["id"],
        )
        self.assertEqual(
            {str(row["id"]): row["sort_order"] for row in b_sort},
            {b_media[0]["id"]: 1, b_media[1]["id"]: 2},
        )

    async def test_grid_pagination_is_stable_across_pages(self):
        """A repeated drag must not make items vanish between page fetches."""
        admin = await self.make_seller(role="admin")
        seller = await self.make_seller(store_name="Stable Shop")
        await self.grant(admin, seller["id"], "pro")
        # publish() contributes the avatar media item, so 9 more makes 10 total.
        await self.publish(seller, "stable-shop")
        for _ in range(9):
            await self.add_image(seller)

        # Force a duplicate sort_order, the state a partial reorder leaves behind.
        await self.pool.execute(
            """UPDATE seller_media SET sort_order = 1
                WHERE seller_page_id = (SELECT id FROM seller_pages WHERE seller_id = $1::uuid)""",
            seller["id"],
        )

        seen: list[str] = []
        for offset in (0, 4, 8):
            r = await self.client.get(
                f"/api/public/stores/stable-shop/media?limit=4&offset={offset}"
            )
            self.assertEqual(r.status_code, 200, r.text)
            seen.extend(m["id"] for m in r.json()["data"]["media"])

        self.assertEqual(len(seen), 10, f"pagination dropped items: {seen}")
        self.assertEqual(len(set(seen)), 10, f"pagination returned duplicates: {seen}")

    async def test_reorder_rejects_garbage_id(self):
        seller = await self.make_seller()
        r = await self.client.put(
            "/api/seller-pages/mine/media/order", json={"ids": ["not-a-uuid"]}, headers=self.auth(seller)
        )
        # require_valid_uuid raises 404 app-wide for a malformed id.
        self.assertEqual(r.status_code, 404, r.text)
        self.assertEqual(self.err_code(r), "NOT_FOUND")


if __name__ == "__main__":
    unittest.main()
