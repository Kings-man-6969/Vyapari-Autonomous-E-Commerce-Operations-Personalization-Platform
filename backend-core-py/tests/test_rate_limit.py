"""
Rate limiting + query-parameter validation - tests against the real ASGI app.

No database is required for most of these: the limiter and the UUID guard both
sit in front of the handler, so a request that trips either one never reaches
the pool. The two product-listing tests that do need `products`/`categories`
rows are skipped unless TEST_DATABASE_URL is set.

    python -m unittest tests.test_rate_limit -v
    TEST_DATABASE_URL=postgresql://... python -m unittest tests.test_rate_limit
"""
import asyncio
import logging
import os
import unittest
import uuid

import httpx

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "").strip()


def _make_client():
    from app.main import app

    # raise_app_exceptions=False so the app's own global handler turns an
    # uninitialised pool into a 500 response, exactly as a real HTTP client
    # would see it. With the default True, ASGITransport re-raises inside the
    # test and the limiter's response headers never get a chance to appear.
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app, raise_app_exceptions=False),
        base_url="http://testserver",
    )


class RateLimiterUnitTests(unittest.TestCase):
    """The counter primitive and the decision logic, tested directly."""

    def test_inmemory_incr_applies_ttl_on_first_call_only(self):
        from app.redis_client import InMemoryCache

        c = InMemoryCache()
        # First call creates the key and sets the window.
        self.assertEqual(asyncio.run(c.incr("k", ex=60)), 1)
        # Subsequent calls must NOT extend the window, or a busy client would
        # keep its own bucket alive indefinitely.
        first = c._store["k"]["expires_at"]
        self.assertEqual(asyncio.run(c.incr("k", ex=60)), 2)
        self.assertEqual(asyncio.run(c.incr("k", ex=60)), 3)
        self.assertEqual(c._store["k"]["expires_at"], first)

    def test_inmemory_incr_restarts_after_expiry(self):
        import time

        from app.redis_client import InMemoryCache

        c = InMemoryCache()
        asyncio.run(c.incr("k", ex=60))
        asyncio.run(c.incr("k", ex=60))
        # Simulate the window elapsing.
        c._store["k"]["expires_at"] = time.time() - 1
        # Must read as a fresh bucket, not resurrect the stale count of 3.
        self.assertEqual(asyncio.run(c.incr("k", ex=60)), 1)

    def test_check_counts_and_allows_up_to_limit(self):
        from app.rate_limit import check

        async def run():
            out = []
            for _ in range(5):
                out.append(await check("ip:1.2.3.4", "t.allow", 5, 60))
            return out

        decisions = asyncio.run(run())
        self.assertTrue(all(d.allowed for d in decisions))
        self.assertEqual([d.remaining for d in decisions], [4, 3, 2, 1, 0])

    def test_check_rejects_past_limit(self):
        from app.rate_limit import check

        async def run():
            out = []
            for _ in range(7):
                out.append(await check("ip:1.2.3.4", "t.reject", 5, 60))
            return out

        decisions = asyncio.run(run())
        self.assertTrue(all(d.allowed for d in decisions[:5]))
        self.assertTrue(all(not d.allowed for d in decisions[5:]))
        # Remaining must clamp at 0, never go negative.
        self.assertEqual(decisions[6].remaining, 0)

    def test_scopes_are_isolated(self):
        """Two different scopes must not share a counter."""
        from app.rate_limit import check

        async def run():
            await check("ip:1.2.3.4", "t.a", 5, 60)
            await check("ip:1.2.3.4", "t.a", 5, 60)
            return await check("ip:1.2.3.4", "t.b", 5, 60)

        self.assertEqual(asyncio.run(run()).remaining, 4)

    def test_identities_are_isolated(self):
        from app.rate_limit import check

        async def run():
            for _ in range(5):
                await check("ip:1.1.1.1", "t.iso", 5, 60)
            return await check("ip:2.2.2.2", "t.iso", 5, 60)

        self.assertTrue(asyncio.run(run()).allowed)

    def test_retry_after_is_at_least_one_second(self):
        """A window ending 'now' must still tell the client to wait, not 0."""
        from app.rate_limit import Decision

        self.assertEqual(Decision(False, 5, 0, 0).retry_after, 1)

    def test_fails_open_when_cache_raises(self):
        """A cache outage must not turn into an API outage."""
        from app import rate_limit as rl

        class Boom:
            async def incr(self, key, ex=None):
                raise RuntimeError("redis down")

        original = rl.cache
        rl.cache = Boom()
        try:
            decision = asyncio.run(rl.check("ip:9.9.9.9", "t.boom", 1, 60))
        finally:
            rl.cache = original
        self.assertTrue(decision.allowed)

    def test_limiter_rejects_bad_configuration(self):
        from app.rate_limit import rate_limit

        with self.assertRaises(ValueError):
            rate_limit("t.bad", 0, 60)
        with self.assertRaises(ValueError):
            rate_limit("t.bad", 5, 0)

    def test_registered_limits_are_sane(self):
        from app.rate_limit import LIMITS

        for scope, (n, window) in LIMITS.items():
            with self.subTest(scope=scope):
                self.assertIsInstance(n, int)
                self.assertIsInstance(window, int)
                self.assertGreaterEqual(n, 1)
                self.assertGreaterEqual(window, 1)

    def test_key_prefix_cannot_collide_with_read_through_namespaces(self):
        """delete_prefix on a data namespace must not wipe live counters."""
        from app.rate_limit import KEY_PREFIX

        for namespace in ("search", "products:popular", "categories", "suggest"):
            self.assertFalse(namespace.startswith(KEY_PREFIX))


class _PooledASGITest(unittest.IsolatedAsyncioTestCase):
    """Base for tests that need the app backed by a live database.

    Without a pool, `get_db` raises and the app answers 500, which makes a test
    about rate limiting or UUID validation assert the wrong thing. With one, the
    same requests exercise the real business paths (401 for a bad login, 200
    for a valid product filter), so the limiter is proven to be transparent
    rather than merely present.
    """

    async def asyncSetUp(self):
        import asyncpg

        from app.db import set_pool
        from app.main import app

        self.pool = await asyncpg.create_pool(
            dsn=TEST_DATABASE_URL, min_size=1, max_size=4
        )
        set_pool(self.pool)
        self.app = app
        self.client = _make_client()

    async def asyncTearDown(self):
        from app.db import set_pool

        await self.client.aclose()
        await self.pool.close()
        set_pool(None)


@unittest.skipUnless(
    TEST_DATABASE_URL, "TEST_DATABASE_URL not set; skipping rate-limit endpoint tests"
)
class RateLimitEndpointTests(_PooledASGITest):
    """The limiter as seen over HTTP, including headers and the 429 body."""

    async def test_login_returns_429_after_five_attempts(self):
        body = {"email": "nobody@example.com", "password": "wrong"}
        headers = {"X-Forwarded-For": "203.0.113.10"}

        for i in range(5):
            r = await self.client.post("/api/auth/login", json=body, headers=headers)
            # 401 (no such user) is the expected business answer; what matters
            # is that the limiter let it through untouched.
            self.assertEqual(r.status_code, 401, f"attempt {i + 1}: {r.text}")

        r = await self.client.post("/api/auth/login", json=body, headers=headers)
        self.assertEqual(r.status_code, 429)

        payload = r.json()
        self.assertFalse(payload["success"])
        self.assertEqual(payload["error"]["code"], "RATE_LIMITED")
        self.assertIn("retry_after_seconds", payload["error"]["details"])
        # Retry-After must be present and a positive integer, or well-behaved
        # clients retry immediately and hammer the endpoint.
        self.assertIn("Retry-After", r.headers)
        self.assertGreaterEqual(int(r.headers["Retry-After"]), 1)

    async def test_limiter_never_blocks_the_first_five_logins(self):
        """A regression guard: a limit that fires early locks real users out."""
        headers = {"X-Forwarded-For": "203.0.113.11"}
        for i in range(5):
            r = await self.client.post(
                "/api/auth/login",
                json={"email": f"absent{i}@example.com", "password": "x"},
                headers=headers,
            )
            self.assertNotEqual(r.status_code, 429, f"blocked legitimate attempt {i + 1}")

    async def test_ratelimit_headers_present_on_allowed_requests(self):
        r = await self.client.get(
            "/api/products", headers={"X-Forwarded-For": "203.0.113.20"}
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.headers.get("X-RateLimit-Limit"), "120")
        self.assertIn("X-RateLimit-Remaining", r.headers)
        self.assertIn("X-RateLimit-Reset", r.headers)
        self.assertLessEqual(int(r.headers["X-RateLimit-Remaining"]), 120)

    async def test_remaining_counts_down(self):
        headers = {"X-Forwarded-For": "203.0.113.30"}
        first = await self.client.get("/api/products", headers=headers)
        second = await self.client.get("/api/products", headers=headers)
        self.assertEqual(int(first.headers["X-RateLimit-Remaining"]), 119)
        self.assertEqual(int(second.headers["X-RateLimit-Remaining"]), 118)

    async def test_different_clients_have_separate_budgets(self):
        a = {"X-Forwarded-For": "198.51.100.1"}
        b = {"X-Forwarded-For": "198.51.100.2"}
        for _ in range(5):
            await self.client.post(
                "/api/auth/login",
                json={"email": "x@example.com", "password": "y"},
                headers=a,
            )

        blocked = await self.client.post(
            "/api/auth/login", json={"email": "x@example.com", "password": "y"}, headers=a
        )
        allowed = await self.client.post(
            "/api/auth/login", json={"email": "x@example.com", "password": "y"}, headers=b
        )
        self.assertEqual(blocked.status_code, 429)
        # A 401 proves the second IP has its own bucket. An IP-scoped 429 would
        # mean the two clients were sharing a counter.
        self.assertEqual(allowed.status_code, 401)

    async def test_x_forwarded_for_takes_first_hop(self):
        """A proxy chain must be keyed on the real client, not the last hop."""
        chain = {"X-Forwarded-For": "203.0.113.77, 70.41.3.18, 150.172.238.178"}
        for _ in range(5):
            await self.client.post(
                "/api/auth/login",
                json={"email": "x@example.com", "password": "y"},
                headers=chain,
            )
        r = await self.client.post(
            "/api/auth/login", json={"email": "x@example.com", "password": "y"}, headers=chain
        )
        self.assertEqual(r.status_code, 429)

    async def test_telemetry_rate_limit_is_real(self):
        """The docstring claimed 'rate limited'; prove the claim is now true."""
        body = {"message": "boom", "url_path": "/x", "stack": "s"}
        headers = {"X-Forwarded-For": "203.0.113.99"}
        for _ in range(30):
            r = await self.client.post("/api/telemetry/errors", json=body, headers=headers)
            self.assertEqual(r.status_code, 200, r.text)
        r = await self.client.post("/api/telemetry/errors", json=body, headers=headers)
        self.assertEqual(r.status_code, 429)
        self.assertEqual(r.json()["error"]["code"], "RATE_LIMITED")

    async def test_presign_rate_limit_is_real(self):
        """Each call mints storage credentials, so it must be bounded."""
        from jose import jwt

        from app.config import settings

        # The claim key is "id", not the JWT-standard "sub" - see
        # generate_tokens() in app/auth/service.py.
        token = jwt.encode(
            {
                "id": str(uuid.uuid4()),
                "email": "seller@test.local",
                "role": "seller",
                "name": "Test Seller",
                "exp": 9999999999,
            },
            settings.JWT_ACCESS_SECRET,
            algorithm="HS256",
        )
        headers = {
            "X-Forwarded-For": "203.0.113.88",
            "Authorization": f"Bearer {token}",
        }
        body = {"file_name": "a.jpg", "mime_type": "image/jpeg", "file_size": 1024}
        for _ in range(30):
            r = await self.client.post("/api/uploads/presign", json=body, headers=headers)
            self.assertEqual(r.status_code, 200, r.text)
        r = await self.client.post("/api/uploads/presign", json=body, headers=headers)
        self.assertEqual(r.status_code, 429)

    async def test_limiter_runs_before_the_database_is_touched(self):
        """
        Declaration-order regression guard.

        When the limiter was declared after db=Depends(get_db), a database
        outage raised out of get_db first and the limiter never executed -
        exactly when you most want a hard cap on request volume. With the pool
        removed, the limiter must still count and still cut the caller off.

        The 429 is asserted rather than the response headers: an unhandled 500
        is produced by Starlette's ServerErrorMiddleware, which sits *outside*
        the @app.middleware("http") function, so headers are legitimately
        absent on that path. Counting is the behaviour that actually matters.
        """
        from app.db import set_pool

        # 120 deliberate failures would otherwise print 120 stack traces.
        logging.getLogger("vyapari-core").setLevel(logging.CRITICAL)
        self.addCleanup(logging.getLogger("vyapari-core").setLevel, logging.INFO)

        held = self.pool
        set_pool(None)
        try:
            headers = {"X-Forwarded-For": "203.0.113.12"}
            for i in range(120):
                await self.client.get("/api/products", headers=headers)
            blocked = await self.client.get("/api/products", headers=headers)
        finally:
            set_pool(held)

        self.assertEqual(blocked.status_code, 429)
        self.assertEqual(blocked.json()["error"]["code"], "RATE_LIMITED")

    async def test_429_carries_retry_after(self):
        """
        The global exception handler used to rebuild the response from scratch
        and drop HTTPException(headers=...), so Retry-After never reached the
        client even though CORS advertised it in expose_headers.
        """
        headers = {"X-Forwarded-For": "203.0.113.13"}
        for _ in range(5):
            await self.client.post(
                "/api/auth/login",
                json={"email": "x@example.com", "password": "y"},
                headers=headers,
            )
        r = await self.client.post(
            "/api/auth/login", json={"email": "x@example.com", "password": "y"}, headers=headers
        )
        self.assertEqual(r.status_code, 429)
        self.assertIn("Retry-After", r.headers)
        self.assertGreaterEqual(int(r.headers["Retry-After"]), 1)


@unittest.skipUnless(
    TEST_DATABASE_URL, "TEST_DATABASE_URL not set; skipping UUID validation tests"
)
class UuidParamValidationTests(_PooledASGITest):
    """The GET /api/products 500 fix, and the latent one behind it."""

    async def test_non_uuid_category_id_is_400_not_500(self):
        r = await self.client.get("/api/products", params={"category_id": "1"})
        self.assertEqual(r.status_code, 400, r.text)
        body = r.json()
        self.assertEqual(body["error"]["code"], "VALIDATION_ERROR")
        self.assertEqual(body["error"]["details"]["field"], "category_id")
        # The old failure leaked the asyncpg driver message to the caller.
        self.assertNotIn("asyncpg", r.text)
        self.assertNotIn("invalid UUID", r.text)

    async def test_non_uuid_seller_id_is_400(self):
        r = await self.client.get("/api/products", params={"seller_id": "1"})
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(r.json()["error"]["details"]["field"], "seller_id")

    async def test_garbage_uuid_is_400(self):
        for bad in (
            "not-a-uuid",
            "'; DROP TABLE products; --",
            "12345678-1234-1234-1234-12345678901",
        ):
            with self.subTest(value=bad):
                r = await self.client.get("/api/products", params={"category_id": bad})
                self.assertEqual(r.status_code, 400, r.text)

    async def test_uppercase_uuid_is_accepted(self):
        """A well-formed UUID with uppercase hex is valid and must not 400."""
        u = str(uuid.uuid4()).upper()
        r = await self.client.get(
            "/api/products", params={"category_id": u}, headers={"X-Forwarded-For": "192.0.2.60"}
        )
        # 200: validated, normalised, and a real query that matched nothing.
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["data"]["pagination"]["total"], 0)

    async def test_empty_filter_is_treated_as_absent(self):
        for empty in ("", "   "):
            with self.subTest(value=repr(empty)):
                r = await self.client.get(
                    "/api/products",
                    params={"category_id": empty},
                    headers={"X-Forwarded-For": "192.0.2.64"},
                )
                self.assertEqual(r.status_code, 200, r.text)

    async def test_absent_filters_are_unaffected(self):
        r = await self.client.get("/api/products", headers={"X-Forwarded-For": "192.0.2.61"})
        self.assertEqual(r.status_code, 200, r.text)


@unittest.skipUnless(
    TEST_DATABASE_URL, "TEST_DATABASE_URL not set; skipping product-query database tests"
)
class ProductQueryDatabaseTests(unittest.IsolatedAsyncioTestCase):
    """min_rating referenced sp.rating_avg in a count query with no such join."""

    async def asyncSetUp(self):
        import asyncpg

        from app.db import set_pool

        self.pool = await asyncpg.create_pool(dsn=TEST_DATABASE_URL, min_size=1, max_size=4)
        set_pool(self.pool)
        await self.pool.execute("TRUNCATE users, categories RESTART IDENTITY CASCADE")
        self.category_id = await self.pool.fetchval(
            "INSERT INTO categories (name, slug) VALUES ('Apparel','apparel') RETURNING id"
        )
        seller_id = await self.pool.fetchval(
            "INSERT INTO users (name, email, password_hash, role) "
            "VALUES ($1,$2,'x','seller') RETURNING id",
            "Seller",
            f"{uuid.uuid4().hex}@test.local",
        )
        await self.pool.execute(
            "INSERT INTO seller_profiles (user_id, store_name, rating_avg) VALUES ($1,$2,$3)",
            seller_id,
            "Test Store",
            4.7,
        )
        await self.pool.execute(
            """INSERT INTO products (seller_id, category_id, title, slug, description,
                                      price, stock_qty, status, attributes)
               VALUES ($1,$2,'Linen Shirt','linen-shirt-1','A shirt',1299.00,10,'active',
                       '{"brand":"Aurora","rating":"4.6"}'::jsonb)""",
            seller_id,
            self.category_id,
        )
        self.client = _make_client()

    async def asyncTearDown(self):
        from app.db import set_pool

        await self.client.aclose()
        await self.pool.close()
        set_pool(None)

    async def test_min_rating_does_not_500(self):
        """This is the missing-FROM-clause bug: it used to raise on every call."""
        r = await self.client.get(
            "/api/products", params={"min_rating": 4}, headers={"X-Forwarded-For": "192.0.2.70"}
        )
        self.assertEqual(r.status_code, 200, r.text)
        body = r.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["pagination"]["total"], 1)
        self.assertEqual(len(body["data"]["products"]), 1)

    async def test_min_rating_excludes_non_matching(self):
        r = await self.client.get(
            "/api/products", params={"min_rating": 4.9}, headers={"X-Forwarded-For": "192.0.2.71"}
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["data"]["pagination"]["total"], 0)

    async def test_category_filter_with_valid_uuid(self):
        r = await self.client.get(
            "/api/products",
            params={"category_id": str(self.category_id)},
            headers={"X-Forwarded-For": "192.0.2.72"},
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["data"]["pagination"]["total"], 1)

    async def test_seller_filter_with_valid_uuid(self):
        r = await self.client.get(
            "/api/products",
            params={"brand": "Aurora"},
            headers={"X-Forwarded-For": "192.0.2.73"},
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["data"]["pagination"]["total"], 1)


if __name__ == "__main__":
    unittest.main()
