"""
Tests for Redis Cache Client, Resilient Fallback, and Read-Heavy Endpoint Caching.
"""
import datetime
import json
import unittest
import uuid
from decimal import Decimal

from fastapi.testclient import TestClient

from app.db import get_db, get_pool, set_pool
from app.main import app
from app.redis_client import (
    TTL_AUTOCOMPLETE,
    TTL_CATEGORIES,
    TTL_PRODUCT_DETAIL,
    TTL_SEARCH,
    AsyncRedisClient,
    InMemoryCache,
    cache,
)
from tests.mock_db import MockConnection, MockPool


class TestRedisCacheIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app, raise_server_exceptions=False)

    def setUp(self):
        self.prod_id = "11111111-0000-0000-0000-000000000001"
        self.cat_id = "10000000-0000-0000-0000-000000000001"

        def db_handler(op, query, *args):
            q = query.lower()
            if "select 1 as alive" in q:
                return [{"alive": 1}]
            if "pg_extension" in q:
                return [{"extversion": "0.5.1"}]
            if "attributes->>'brand' as name" in q:
                return [{"name": "AudioPro", "count": 5}]
            if "from categories c" in q:
                return [{"id": self.cat_id, "name": "Electronics", "slug": "electronics", "count": 5}]
            if "from categories" in q:
                return [{
                    "id": self.cat_id,
                    "name": "Electronics",
                    "slug": "electronics",
                    "parent_id": None,
                    "icon_url": None,
                    "created_at": datetime.datetime.now(),
                }]
            if "from products" in q and op == "fetchrow":
                return {
                    "id": self.prod_id,
                    "seller_id": "22222222-2222-2222-2222-222222222222",
                    "category_id": self.cat_id,
                    "title": "Wireless Earbuds",
                    "slug": "wireless-earbuds",
                    "description": "High fidelity earbuds",
                    "price": 1999.0,
                    "compare_at_price": 2999.0,
                    "stock_qty": 50,
                    "images": json.dumps(["https://images.example.com/earbuds.jpg"]),
                    "attributes": json.dumps({"brand": "AudioPro"}),
                    "status": "active",
                    "created_at": datetime.datetime.now(),
                    "category_name": "Electronics",
                    "category_slug": "electronics",
                    "store_name": "AudioStore",
                    "store_rating": 4.9,
                    "is_verified": True,
                }
            if "from products" in q and op == "fetch":
                return [{
                    "id": self.prod_id,
                    "title": "Wireless Earbuds",
                    "slug": "wireless-earbuds",
                    "price": 1999.0,
                    "compare_at_price": 2999.0,
                    "stock_qty": 50,
                    "images": json.dumps(["https://images.example.com/earbuds.jpg"]),
                    "attributes": json.dumps({"brand": "AudioPro"}),
                    "status": "active",
                    "category_name": "Electronics",
                    "brand": "AudioPro",
                    "rating": 4.8,
                }]
            if "from reviews" in q:
                return []
            if "count(*) as total from products" in q:
                return {"total": 1}
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
    # Unit tests for In-Memory & Redis client primitives
    # ------------------------------------------------------------------------
    def test_in_memory_cache_crud(self):
        import asyncio
        async def _test():
            c = InMemoryCache()
            self.assertIsNone(await c.get("nonexistent"))
            await c.set("key1", "val1", ex=60)
            self.assertEqual(await c.get("key1"), "val1")

            # Delete
            await c.delete("key1")
            self.assertIsNone(await c.get("key1"))

            # Delete prefix
            await c.set("search:1", "data1")
            await c.set("search:2", "data2")
            await c.set("other:3", "data3")
            deleted = await c.delete_prefix("search:")
            self.assertEqual(deleted, 2)
            self.assertIsNone(await c.get("search:1"))
            self.assertEqual(await c.get("other:3"), "data3")

        asyncio.run(_test())

    def test_cache_json_serialization(self):
        import asyncio
        async def _test():
            c = InMemoryCache()
            payload = {
                "id": uuid.uuid4(),
                "timestamp": datetime.datetime.now(datetime.timezone.utc),
                "price": Decimal("999.50"),
                "title": "Test Gaming Laptop",
            }
            ok = await c.set_json("item:1", payload, ex=120)
            self.assertTrue(ok)

            fetched = await c.get_json("item:1")
            self.assertIsNotNone(fetched)
            self.assertEqual(fetched["title"], "Test Gaming Laptop")
            self.assertEqual(fetched["price"], 999.50)
            self.assertIsInstance(fetched["id"], str)

        asyncio.run(_test())

    def test_async_redis_client_fallback_mode(self):
        import asyncio
        async def _test():
            client = AsyncRedisClient()
            self.assertTrue(client.is_fallback)
            await client.set("suggest:laptop", '{"suggestions": ["laptop"]}', ex=TTL_AUTOCOMPLETE)
            val = await client.get("suggest:laptop")
            self.assertIsNotNone(val)
            self.assertIn("laptop", val)

            health = await client.health_check()
            self.assertIn("degraded", health["status"])
            self.assertEqual(health["engine"], "InMemoryCache")
            self.assertIn("metrics", health)
            self.assertGreaterEqual(health["metrics"]["hits_total"], 1)

        asyncio.run(_test())

    def test_cache_telemetry_metrics_tracking(self):
        import asyncio
        async def _test():
            client = AsyncRedisClient()
            # 1 miss on autocomplete namespace
            m = await client.get("suggest:phone")
            self.assertIsNone(m)

            # 1 set
            await client.set("suggest:phone", "apple", ex=300)

            # 1 hit on autocomplete namespace
            h = await client.get("suggest:phone")
            self.assertEqual(h, "apple")

            metrics = client.get_metrics()
            self.assertEqual(metrics["hits_total"], 1)
            self.assertEqual(metrics["misses_total"], 1)
            self.assertEqual(metrics["sets_total"], 1)
            self.assertEqual(metrics["hit_ratio_percent"], 50.0)
            self.assertEqual(metrics["by_namespace"]["autocomplete"]["hits"], 1)
            self.assertEqual(metrics["by_namespace"]["autocomplete"]["misses"], 1)

        asyncio.run(_test())

    def test_redis_init_fails_gracefully_with_bad_url(self):
        import asyncio
        async def _test():
            client = AsyncRedisClient()
            from app.config import settings
            orig = settings.REDIS_URL
            try:
                settings.REDIS_URL = "redis://nonexistent-host:9999/0"
                await client.init()
                self.assertTrue(client.is_fallback)
            finally:
                settings.REDIS_URL = orig
                await client.close()

        asyncio.run(_test())

    # ------------------------------------------------------------------------
    # Endpoint caching integration tests
    # ------------------------------------------------------------------------
    def test_categories_caching_and_invalidation(self):
        import asyncio
        # First call loads and caches
        res1 = self.client.get("/api/categories")
        self.assertEqual(res1.status_code, 200)
        data1 = res1.json()

        # Second call returns from cache
        res2 = self.client.get("/api/categories")
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.json(), data1)

        # Invalidation test
        asyncio.run(cache.delete("categories:tree"))
        res3 = self.client.get("/api/categories")
        self.assertEqual(res3.status_code, 200)

    def test_suggest_caching(self):
        sug1 = self.client.get("/api/products/suggest?q=earbuds")
        self.assertEqual(sug1.status_code, 200)
        sug_data1 = sug1.json()

        sug2 = self.client.get("/api/products/suggest?q=earbuds")
        self.assertEqual(sug2.status_code, 200)
        self.assertEqual(sug2.json(), sug_data1)

    def test_product_detail_caching(self):
        det1 = self.client.get(f"/api/products/{self.prod_id}")
        self.assertEqual(det1.status_code, 200)
        det_data1 = det1.json()

        det2 = self.client.get(f"/api/products/{self.prod_id}")
        self.assertEqual(det2.status_code, 200)
        self.assertEqual(det2.json(), det_data1)

    def test_health_check_redis_service(self):
        health_resp = self.client.get("/health")
        self.assertEqual(health_resp.status_code, 200)
        services = health_resp.json().get("services", {})
        self.assertIn("redis", services)
        self.assertIn("status", services["redis"])
