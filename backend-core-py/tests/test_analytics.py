"""
Analytics — I1 (the rollup), I2 (best-selling), I3 (popular), I4 (product
performance), I5 (sales over time) and I7 (interaction capture), against a real
database.

Almost everything here is about a number that would be *plausible* if it were
wrong:

- Revenue that includes unpaid orders. `created` and `pending_payment` orders
  have never been paid, and the old `/admin/metrics` summed every order whose
  status was not `cancelled` -- so the dashboard's headline figure counted every
  abandoned checkout. The tests create an unpaid order and assert it is not in the
  total.
- A "best-sellers" list over an empty rollup. It is a newest-first list, and from
  the rows alone the two are indistinguishable. The tests assert the response says
  which one it is.
- Conversion for a product with no views. `0%` ranks it alongside a product that
  genuinely converts badly; `null` is the truthful answer, and the tests assert
  null rather than a number.
- A rollup that has silently not run. An empty table and a job that stopped look
  identical from outside, which is why the run log exists. The tests assert a
  failed day leaves a record.
- Interactions attributed by the client. The route used to take `user_id` from
  the request body, so anyone could post engagement as anyone.

Skipped unless TEST_DATABASE_URL is set.

    TEST_DATABASE_URL=postgresql://... python -m pytest tests/test_analytics.py -v
"""
import json
import os
import unittest
import uuid
from datetime import date, datetime, timedelta, timezone

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "").strip()


def auth_header(user_id: str, role: str = "admin", email: str = "admin@example.com") -> dict:
    from jose import jwt

    from app.config import settings

    token = jwt.encode(
        {"id": str(user_id), "email": email, "role": role, "name": "T", "exp": 9999999999},
        settings.JWT_ACCESS_SECRET,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


def err(response) -> dict:
    try:
        body = response.json()
    except ValueError:
        return {}
    error = body.get("error", body)
    if not isinstance(error, dict):
        return {}
    merged = {k: v for k, v in error.items() if k != "data"}
    if isinstance(error.get("data"), dict):
        merged.update(error["data"])
    return merged


def at(day: date, hour: int = 12) -> datetime:
    return datetime(day.year, day.month, day.day, hour, tzinfo=timezone.utc)


@unittest.skipUnless(TEST_DATABASE_URL, "TEST_DATABASE_URL not set; skipping analytics tests")
class AnalyticsTests(unittest.IsolatedAsyncioTestCase):
    maxDiff = None

    async def asyncSetUp(self):
        import asyncpg

        self.pool = await asyncpg.create_pool(dsn=TEST_DATABASE_URL, min_size=1, max_size=4)
        # `product_stats_daily` and `analytics_rollup_runs` are not reached by
        # TRUNCATE users CASCADE -- they reference products, which references
        # sellers, so they are, but the run log has no FK at all and would keep
        # rows describing days this test just deleted.
        await self.pool.execute("TRUNCATE users, categories RESTART IDENTITY CASCADE")
        await self.pool.execute("TRUNCATE analytics_rollup_runs")

        from app.redis_client import cache

        await cache.delete_prefix("ratelimit:")
        await cache.delete_prefix("products:popular:")
        await cache.delete_prefix("search:")

        from app.db import set_pool

        set_pool(self.pool)

        import httpx

        from app.main import app

        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app, raise_app_exceptions=False),
            base_url="http://testserver",
        )

        self.admin_id = str(
            await self.pool.fetchval(
                "INSERT INTO users (name, email, password_hash, role) "
                "VALUES ('Admin','admin@example.com','x','admin') RETURNING id"
            )
        )
        self.seller_id = str(
            await self.pool.fetchval(
                "INSERT INTO users (name, email, password_hash, role) "
                "VALUES ('Seller','seller@example.com','x','seller') RETURNING id"
            )
        )
        self.customer_id = str(
            await self.pool.fetchval(
                "INSERT INTO users (name, email, password_hash, role) "
                "VALUES ('Buyer','buyer@example.com','x','customer') RETURNING id"
            )
        )
        self.category_id = str(
            await self.pool.fetchval(
                "INSERT INTO categories (name, slug) VALUES ('Kitchen','kitchen') RETURNING id"
            )
        )

        self.headers = auth_header(self.admin_id, "admin", "admin@example.com")
        self.customer_headers = auth_header(self.customer_id, "customer", "buyer@example.com")

        # An anonymous session id, for the interaction route's unauthenticated
        # path.
        self.session_id = "sess-" + uuid.uuid4().hex[:16]

    async def asyncTearDown(self):
        from app.db import set_pool

        await self.client.aclose()
        await self.pool.close()
        set_pool(None)

    # -- fixtures ---------------------------------------------------------

    async def make_product(self, title: str = "Kettle", slug: str | None = None, **kw) -> str:
        defaults = {"price": "499.00", "stock_qty": 10, "status": "active"}
        defaults.update(kw)
        slug = slug or f"p-{uuid.uuid4().hex[:8]}"
        return str(
            await self.pool.fetchval(
                """INSERT INTO products
                     (seller_id, category_id, title, slug, description, price, stock_qty, status, images)
                   VALUES ($1::uuid,$2::uuid,$3,$4,'d',$5::numeric,$6,$7,'[]'::jsonb) RETURNING id""",
                self.seller_id,
                self.category_id,
                title,
                slug,
                defaults["price"],
                defaults["stock_qty"],
                defaults["status"],
            )
        )

    async def make_order(
        self,
        product_id: str,
        quantity: int = 1,
        price: str = "100.00",
        status: str = "paid",
        day: date | None = None,
        total: str | None = None,
    ) -> str:
        day = day or date.today()
        total = total if total is not None else f"{float(price) * quantity:.2f}"
        order_id = str(
            await self.pool.fetchval(
                """INSERT INTO orders (user_id, total_amount, status, shipping_address, created_at)
                   VALUES ($1::uuid,$2::numeric,$3,$4::jsonb,$5) RETURNING id""",
                self.customer_id,
                total,
                status,
                json.dumps({"full_name": "Buyer", "city": "Pune", "pincode": "411001"}),
                at(day),
            )
        )
        await self.pool.execute(
            """INSERT INTO order_items
                 (order_id, product_id, seller_id, quantity, price_at_purchase, created_at)
               VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5::numeric,$6)""",
            order_id,
            product_id,
            self.seller_id,
            quantity,
            price,
            at(day),
        )
        return order_id

    async def make_interaction(
        self, product_id: str, event_type: str, day: date | None = None, n: int = 1
    ) -> None:
        day = day or date.today()
        for _ in range(n):
            await self.pool.execute(
                """INSERT INTO user_interactions
                     (user_id, session_id, product_id, event_type, created_at)
                   VALUES ($1::uuid,$2,$3::uuid,$4,$5)""",
                self.customer_id,
                self.session_id,
                product_id,
                event_type,
                at(day),
            )

    async def make_refund(self, order_id: str, amount: str, status: str, day: date) -> None:
        await self.pool.execute(
            """INSERT INTO refunds (order_id, amount, status, processed_at)
               VALUES ($1::uuid,$2::numeric,$3,$4)""",
            order_id,
            amount,
            status,
            at(day),
        )

    async def rollup(self, days: int = 3) -> dict:
        from app.analytics import rollup_window

        async with self.pool.acquire() as conn:
            return await rollup_window(conn, days)

    async def stat_row(self, product_id: str, day: date | None = None) -> dict | None:
        day = day or date.today()
        row = await self.pool.fetchrow(
            "SELECT * FROM product_stats_daily WHERE product_id = $1::uuid AND stat_date = $2",
            product_id,
            day,
        )
        return dict(row) if row else None

    # =====================================================================
    # I1. The rollup
    # =====================================================================

    async def test_views_and_clicks_come_from_the_interaction_log(self):
        product = await self.make_product()
        await self.make_interaction(product, "view", n=7)
        await self.make_interaction(product, "click", n=3)

        await self.rollup(days=1)
        row = await self.stat_row(product)
        self.assertIsNotNone(row, "the rollup wrote no row")
        self.assertEqual(row["views"], 7)
        self.assertEqual(row["clicks"], 3)
        # Nothing was bought, so the sales half contributes nothing -- and must
        # not invent a zero it cannot distinguish from "no sales data".
        self.assertEqual(row["purchases"], 0)

    async def test_purchases_are_units_not_orders(self):
        # A five-unit order is five sales. Counting rows counts it as one, and
        # then the ranking disagrees with the revenue figure beside it.
        product = await self.make_product()
        await self.make_order(product, quantity=5, price="200.00")

        await self.rollup(days=1)
        row = await self.stat_row(product)
        self.assertEqual(row["purchases"], 5)
        self.assertEqual(float(row["revenue"]), 1000.0)

    async def test_a_product_with_both_gets_one_row_carrying_both(self):
        # The merge. Two separate upserts would clobber each other's columns
        # unless each carefully named only its own.
        product = await self.make_product()
        await self.make_interaction(product, "view", n=4)
        await self.make_order(product, quantity=2, price="150.00")

        await self.rollup(days=1)
        row = await self.stat_row(product)
        self.assertEqual(row["views"], 4)
        self.assertEqual(row["purchases"], 2)
        self.assertEqual(float(row["revenue"]), 300.0)
        self.assertEqual(
            int(await self.pool.fetchval(
                "SELECT count(*) FROM product_stats_daily WHERE product_id = $1::uuid", product
            )),
            1,
        )

    async def test_revenue_excludes_orders_that_were_never_paid(self):
        # `pending` has taken no money, and `cancelled` has given back whatever it
        # took. This is the exact shape of the bug the old dashboard GMV had.
        product = await self.make_product()
        await self.make_order(product, quantity=1, price="100.00", status="paid")
        for unpaid in ("pending", "cancelled"):
            await self.make_order(product, quantity=1, price="999.00", status=unpaid)

        await self.rollup(days=1)
        row = await self.stat_row(product)
        self.assertEqual(row["purchases"], 1)
        self.assertEqual(float(row["revenue"]), 100.0)

    async def test_the_rollup_is_idempotent(self):
        # The property the whole design rests on: a day is recomputed, not
        # counted up, so re-running is free and a gap is filled by running again.
        product = await self.make_product()
        await self.make_interaction(product, "view", n=5)
        await self.make_order(product, quantity=3, price="100.00")

        await self.rollup(days=1)
        first = await self.stat_row(product)
        await self.rollup(days=1)
        second = await self.stat_row(product)

        self.assertEqual(first["views"], second["views"])
        self.assertEqual(first["purchases"], second["purchases"])
        self.assertEqual(float(first["revenue"]), float(second["revenue"]))
        # Still one row, not two.
        self.assertEqual(
            int(await self.pool.fetchval("SELECT count(*) FROM product_stats_daily")), 1
        )

    async def test_the_rollup_only_counts_the_day_it_is_given(self):
        product = await self.make_product()
        yesterday = date.today() - timedelta(days=1)
        await self.make_interaction(product, "view", day=yesterday, n=9)
        await self.make_interaction(product, "view", day=date.today(), n=2)

        await self.rollup(days=1)  # today only
        today_row = await self.stat_row(product, date.today())
        self.assertEqual(today_row["views"], 2)
        self.assertIsNone(await self.stat_row(product, yesterday))

    async def test_a_window_rolls_up_every_day_in_it(self):
        product = await self.make_product()
        for offset in range(3):
            await self.make_interaction(
                product, "view", day=date.today() - timedelta(days=offset), n=offset + 1
            )

        await self.rollup(days=3)
        for offset in range(3):
            row = await self.stat_row(product, date.today() - timedelta(days=offset))
            self.assertIsNotNone(row, f"day -{offset} missing")
            self.assertEqual(row["views"], offset + 1)

    async def test_a_run_is_recorded_with_the_row_count(self):
        product = await self.make_product()
        await self.make_interaction(product, "view", n=1)
        await self.rollup(days=1)

        row = await self.pool.fetchrow(
            "SELECT * FROM analytics_rollup_runs WHERE stat_date = $1", date.today()
        )
        self.assertIsNotNone(row)
        self.assertEqual(row["rows_written"], 1)
        self.assertIsNotNone(row["finished_at"])
        self.assertIsNone(row["error"])

    async def test_a_failed_day_is_recorded_rather_than_swallowed(self):
        # Without the record, "the best-sellers list is empty" and "the job has
        # not run for nine days" are indistinguishable from outside.
        from app.analytics import rollup_day

        async with self.pool.acquire() as conn:
            await conn.execute(
                "ALTER TABLE product_stats_daily RENAME COLUMN views TO views_renamed"
            )
            try:
                with self.assertRaises(Exception):
                    await rollup_day(conn, date.today())
            finally:
                await conn.execute(
                    "ALTER TABLE product_stats_daily RENAME COLUMN views_renamed TO views"
                )

        row = await self.pool.fetchrow(
            "SELECT error FROM analytics_rollup_runs WHERE stat_date = $1", date.today()
        )
        self.assertIsNotNone(row, "a failed day left no record")
        self.assertIsNotNone(row["error"], "the failure was recorded without its reason")

    async def test_a_failure_on_one_day_does_not_abandon_the_rest(self):
        from app.analytics import rollup_window

        product = await self.make_product()
        for offset in range(3):
            await self.make_interaction(
                product, "view", day=date.today() - timedelta(days=offset), n=1
            )

        async with self.pool.acquire() as conn:
            result = await rollup_window(conn, 3)
        self.assertEqual(result["errors"], [])
        self.assertEqual(len(result["days"]), 3)

    async def test_missing_days_finds_the_gaps(self):
        from app.analytics import missing_days, rollup_day

        async with self.pool.acquire() as conn:
            pending = await missing_days(conn, 5)
            self.assertEqual(len(pending), 5, "a fresh window should be entirely missing")

            await rollup_day(conn, date.today())
            pending = await missing_days(conn, 5)
            self.assertNotIn(date.today(), pending)
            self.assertEqual(len(pending), 4)

    async def test_the_rollup_status_reports_staleness(self):
        await self.rollup(days=2)
        r = await self.client.get("/api/admin/analytics/rollup", headers=self.headers)
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()["data"]
        self.assertEqual(data["last_rolled_up_day"], date.today().isoformat())
        self.assertEqual(data["failed_runs"], 0)
        self.assertEqual(data["stale_days"], 0)
        # The two days just rolled up are no longer missing; the rest of the
        # default 30-day window is, because the rollup only ran for two.
        missing = data["missing_days"]
        self.assertNotIn(date.today().isoformat(), missing)
        self.assertNotIn((date.today() - timedelta(days=1)).isoformat(), missing)
        self.assertEqual(len(missing), 28)

    async def test_the_rollup_status_lists_the_missing_days(self):
        # This is what the periodic sweep acts on: a process that was down comes
        # back and fills every gap, not only the day it woke up on.
        r = await self.client.get("/api/admin/analytics/rollup", headers=self.headers)
        self.assertEqual(len(r.json()["data"]["missing_days"]), 30)

    async def test_the_rollup_can_be_triggered_by_an_admin(self):
        product = await self.make_product()
        await self.make_interaction(product, "view", n=3)
        r = await self.client.post(
            "/api/admin/analytics/rollup", headers=self.headers, json={"days": 2}
        )
        self.assertEqual(r.status_code, 200, r.text)
        row = await self.stat_row(product)
        self.assertEqual(row["views"], 3)

    async def test_the_rollup_route_rejects_an_absurd_window(self):
        r = await self.client.post(
            "/api/admin/analytics/rollup", headers=self.headers, json={"days": 5000}
        )
        self.assertEqual(r.status_code, 400, r.text)

    async def test_the_rollup_routes_are_admin_only(self):
        for method, path in (("get", "/api/admin/analytics/rollup"),):
            r = await getattr(self.client, method)(path, headers=self.customer_headers)
            self.assertIn(r.status_code, (401, 403), f"{method} {path}")
        r = await self.client.post(
            "/api/admin/analytics/rollup", headers=self.customer_headers, json={"days": 1}
        )
        self.assertIn(r.status_code, (401, 403), r.text)

    # =====================================================================
    # I5. Sales over time
    # =====================================================================

    async def test_sales_series_has_a_row_for_every_day_including_empty_ones(self):
        # A trend chart with holes draws a straight line across a day the shop was
        # closed, which is exactly the wrong story.
        product = await self.make_product()
        await self.make_order(product, quantity=1, price="100.00")

        r = await self.client.get("/api/admin/analytics/sales?days=5", headers=self.headers)
        self.assertEqual(r.status_code, 200, r.text)
        series = r.json()["data"]["series"]
        self.assertEqual(len(series), 5, "a day is missing from the series")
        self.assertEqual(series[-1]["date"], date.today().isoformat())
        # Yesterday had no orders and is present as zeroes, not absent.
        self.assertEqual(series[-2]["orders"], 0)
        self.assertEqual(series[-2]["revenue"], 0)

    async def test_sales_revenue_counts_only_paid_orders(self):
        product = await self.make_product()
        await self.make_order(product, quantity=1, price="100.00", status="paid")
        await self.make_order(product, quantity=1, price="5000.00", status="pending")
        await self.make_order(product, quantity=1, price="5000.00", status="cancelled")

        r = await self.client.get("/api/admin/analytics/sales?days=1", headers=self.headers)
        totals = r.json()["data"]["totals"]
        self.assertEqual(totals["revenue"], 100.0)
        self.assertEqual(totals["paid_orders"], 1)
        # All three orders are visible; only one has been paid for.
        self.assertEqual(totals["orders"], 3)

    async def test_aov_is_per_paid_order(self):
        # Dividing by every order makes AOV drop whenever someone abandons
        # checkout, which is the opposite of what an average order value is for.
        product = await self.make_product()
        await self.make_order(product, price="400.00", status="paid")
        await self.make_order(product, price="100.00", status="paid")
        for _ in range(8):
            await self.make_order(product, price="50.00", status="pending")

        r = await self.client.get("/api/admin/analytics/sales?days=1", headers=self.headers)
        totals = r.json()["data"]["totals"]
        self.assertEqual(totals["revenue"], 500.0)
        self.assertEqual(totals["paid_orders"], 2)
        self.assertEqual(totals["aov"], 250.0)

    async def test_refunds_are_split_between_repaid_and_still_pending(self):
        product = await self.make_product()
        order = await self.make_order(product, price="300.00", status="paid")
        today = date.today()
        await self.make_refund(order, "100.00", "processed", today)
        await self.make_refund(order, "50.00", "requested", today)
        await self.make_refund(order, "25.00", "rejected", today)

        r = await self.client.get("/api/admin/analytics/sales?days=1", headers=self.headers)
        totals = r.json()["data"]["totals"]
        # A rejected refund is neither money out nor money waiting.
        self.assertEqual(totals["refunds"], 100.0)
        self.assertEqual(totals["refunds_pending"], 50.0)
        self.assertEqual(totals["net_revenue"], 200.0)

    async def test_the_sales_screen_compares_against_the_previous_window(self):
        product = await self.make_product()
        today = date.today()
        await self.make_order(product, price="200.00", day=today)
        await self.make_order(product, price="100.00", day=today - timedelta(days=35))

        r = await self.client.get("/api/admin/analytics/sales?days=30", headers=self.headers)
        data = r.json()["data"]
        self.assertEqual(data["totals"]["revenue"], 200.0)
        self.assertEqual(data["previous"]["revenue"], 100.0)
        self.assertEqual(data["revenue_change_pct"], 100.0)

    async def test_no_baseline_is_null_not_zero_percent(self):
        # "Was zero, is now something" is the case where the number is most
        # interesting, and reporting it as 0% change hides it.
        product = await self.make_product()
        await self.make_order(product, price="200.00")

        r = await self.client.get("/api/admin/analytics/sales?days=30", headers=self.headers)
        self.assertIsNone(r.json()["data"]["revenue_change_pct"])

    async def test_sales_routes_are_admin_only(self):
        r = await self.client.get(
            "/api/admin/analytics/sales", headers=self.customer_headers
        )
        self.assertIn(r.status_code, (401, 403), r.text)

    # =====================================================================
    # I4. Product performance
    # =====================================================================

    async def test_product_performance_reports_the_window_figures(self):
        product = await self.make_product(title="Best Kettle")
        await self.make_interaction(product, "view", n=10)
        await self.make_order(product, quantity=2, price="150.00")
        await self.rollup(days=1)

        r = await self.client.get("/api/admin/analytics/products?days=30", headers=self.headers)
        self.assertEqual(r.status_code, 200, r.text)
        rows = {p["title"]: p for p in r.json()["data"]}
        self.assertIn("Best Kettle", rows)
        row = rows["Best Kettle"]
        self.assertEqual(row["views"], 10)
        self.assertEqual(row["purchases"], 2)
        self.assertEqual(row["revenue"], 300.0)
        self.assertEqual(row["conversion_pct"], 20.0)

    async def test_conversion_is_null_when_there_are_no_views(self):
        # 0% would rank a product nobody has seen alongside one that genuinely
        # converts badly. There is no rate to report.
        product = await self.make_product(title="Unseen")
        await self.make_order(product, quantity=1, price="100.00")
        await self.rollup(days=1)

        r = await self.client.get(
            "/api/admin/analytics/products?days=30", headers=self.headers
        )
        rows = {p["title"]: p for p in r.json()["data"]}
        self.assertIsNone(rows["Unseen"]["conversion_pct"])
        self.assertEqual(rows["Unseen"]["purchases"], 1)

    async def test_products_with_no_activity_are_hidden_by_default(self):
        await self.make_product(title="Quiet")
        active = await self.make_product(title="Busy")
        await self.make_interaction(active, "view", n=1)
        await self.rollup(days=1)

        r = await self.client.get("/api/admin/analytics/products", headers=self.headers)
        titles = [p["title"] for p in r.json()["data"]]
        self.assertIn("Busy", titles)
        self.assertNotIn("Quiet", titles)

        r = await self.client.get(
            "/api/admin/analytics/products?include_zero=true", headers=self.headers
        )
        self.assertIn("Quiet", [p["title"] for p in r.json()["data"]])

    async def test_product_performance_can_rank_by_revenue(self):
        a = await self.make_product(title="Cheap and popular")
        b = await self.make_product(title="Expensive and rare")
        await self.make_interaction(a, "view", n=50)
        await self.make_order(a, quantity=1, price="10.00")
        await self.make_order(b, quantity=1, price="9000.00")
        await self.rollup(days=1)

        r = await self.client.get(
            "/api/admin/analytics/products?sort=revenue", headers=self.headers
        )
        titles = [p["title"] for p in r.json()["data"]]
        self.assertEqual(titles[0], "Expensive and rare")

        r = await self.client.get(
            "/api/admin/analytics/products?sort=views", headers=self.headers
        )
        self.assertEqual([p["title"] for p in r.json()["data"]][0], "Cheap and popular")

    async def test_an_unknown_product_sort_is_a_400_naming_the_allowed_ones(self):
        # A silently ignored sort gives the caller the default ordering and no
        # indication they asked for something else.
        r = await self.client.get(
            "/api/admin/analytics/products?sort=vibes", headers=self.headers
        )
        self.assertEqual(r.status_code, 400, r.text)
        self.assertIn("revenue", err(r).get("allowed", []))

    async def test_product_performance_reports_the_change_against_the_previous_window(self):
        product = await self.make_product(title="Grower")
        today = date.today()
        await self.make_order(product, quantity=1, price="200.00", day=today)
        await self.make_order(product, quantity=1, price="100.00", day=today - timedelta(days=40))
        await self.rollup(days=45)

        r = await self.client.get(
            "/api/admin/analytics/products?days=30", headers=self.headers
        )
        row = next(p for p in r.json()["data"] if p["title"] == "Grower")
        self.assertEqual(row["revenue"], 200.0)
        self.assertEqual(row["previous"]["revenue"], 100.0)
        self.assertEqual(row["revenue_change_pct"], 100.0)

    async def test_product_performance_routes_are_admin_only(self):
        r = await self.client.get(
            "/api/admin/analytics/products", headers=self.customer_headers
        )
        self.assertIn(r.status_code, (401, 403), r.text)

    # =====================================================================
    # I3. Popular
    # =====================================================================

    async def test_popular_ranks_by_sales_then_views(self):
        looked_at = await self.make_product(title="Looked at a lot")
        bought = await self.make_product(title="Actually bought")
        await self.make_interaction(looked_at, "view", n=100)
        await self.make_interaction(bought, "view", n=2)
        await self.make_order(bought, quantity=1, price="100.00")
        await self.rollup(days=1)

        r = await self.client.get("/api/ai/popular?limit=8", headers=self.headers)
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()["data"]
        self.assertEqual(data["basis"], "stats")
        # A sale is a stronger signal than a look: a product viewed a hundred
        # times and bought twice should not outrank one bought at all.
        self.assertEqual(data["popular"][0]["title"], "Actually bought")

    async def test_popular_says_so_when_there_is_no_activity_to_rank_on(self):
        # The old version returned `created_at DESC` labelled
        # `popular_db_fallback`, which was a newest-first list wearing the word
        # popular. Now the response says which one it is.
        await self.make_product(title="Newest")
        r = await self.client.get("/api/ai/popular?limit=8")
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()["data"]
        self.assertEqual(data["basis"], "newest")
        self.assertEqual(data["popular"][0]["title"], "Newest")
        self.assertEqual(data["popular"][0]["reason"], "newest")

    async def test_popular_does_not_call_the_recommendation_service(self):
        # I3's whole point: the ranking must not depend on a service that is not
        # deployed. If it did, this request would take the outbound timeout.
        import time

        await self.make_product(title="A")
        started = time.monotonic()
        r = await self.client.get("/api/ai/popular?limit=4")
        elapsed = time.monotonic() - started
        self.assertEqual(r.status_code, 200)
        self.assertLess(elapsed, 2.0, f"popular took {elapsed:.1f}s; it is calling out")

    # =====================================================================
    # I2. Best-selling
    # =====================================================================

    async def test_best_selling_orders_by_units_sold(self):
        slow = await self.make_product(title="Slow mover")
        fast = await self.make_product(title="Fast mover")
        await self.make_order(slow, quantity=1, price="100.00")
        await self.make_order(fast, quantity=9, price="10.00")
        await self.rollup(days=1)

        r = await self.client.get(
            "/api/products?sort=best_selling&limit=10", headers=self.headers
        )
        self.assertEqual(r.status_code, 200, r.text)
        titles = [p["title"] for p in r.json()["data"]["products"]]
        self.assertEqual(titles[0], "Fast mover")
        self.assertIn("Slow mover", titles)

    async def test_best_selling_says_when_the_rollup_has_nothing_in_it(self):
        # From the rows alone, a best-sellers list over an empty rollup and a
        # best-sellers list over a quiet month are identical.
        await self.make_product(title="Whatever")
        r = await self.client.get(
            "/api/products?sort=best_selling&limit=10", headers=self.headers
        )
        ranking = r.json()["data"]["ranking"]
        self.assertEqual(ranking["basis"], "units_sold")
        self.assertFalse(ranking["stats_available"])
        self.assertEqual(ranking["stat_rows"], 0)

    async def test_best_selling_reports_stats_available_once_the_rollup_ran(self):
        product = await self.make_product(title="Sold once")
        await self.make_order(product, quantity=1, price="100.00")
        await self.rollup(days=1)

        r = await self.client.get(
            "/api/products?sort=best_selling&limit=10", headers=self.headers
        )
        ranking = r.json()["data"]["ranking"]
        self.assertTrue(ranking["stats_available"])
        self.assertGreater(ranking["stat_rows"], 0)

    async def test_a_plain_listing_has_no_ranking_block(self):
        await self.make_product(title="Plain")
        r = await self.client.get("/api/products?limit=10", headers=self.headers)
        self.assertIsNone(r.json()["data"]["ranking"])

    # =====================================================================
    # I5. The dashboard's own figures
    # =====================================================================

    async def test_the_dashboard_no_longer_counts_abandoned_checkouts_as_revenue(self):
        # `SUM(total_amount) WHERE status != 'cancelled'` swept in every unpaid
        # order. This is the regression test for that.
        product = await self.make_product()
        await self.make_order(product, price="100.00", status="paid")
        await self.make_order(product, price="9000.00", status="pending")

        r = await self.client.get("/api/admin/metrics", headers=self.headers)
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()["data"]
        self.assertEqual(data["total_revenue"], 100.0)
        self.assertEqual(data["paid_orders"], 1)
        self.assertEqual(data["unpaid_orders"], 1)
        self.assertEqual(data["aov"], 100.0)

    async def test_the_dashboard_reports_net_of_processed_refunds(self):
        product = await self.make_product()
        order = await self.make_order(product, price="300.00", status="paid")
        await self.make_refund(order, "100.00", "processed", date.today())

        r = await self.client.get("/api/admin/metrics", headers=self.headers)
        data = r.json()["data"]
        self.assertEqual(data["total_revenue"], 300.0)
        self.assertEqual(data["refunds_total"], 100.0)
        self.assertEqual(data["net_revenue"], 200.0)

    async def test_the_dashboard_still_returns_the_six_fields_the_page_renders(self):
        r = await self.client.get("/api/admin/metrics", headers=self.headers)
        data = r.json()["data"]
        for field in (
            "total_revenue", "total_customers", "active_sellers",
            "total_orders", "total_products", "pending_kyc",
        ):
            self.assertIn(field, data)

    # =====================================================================
    # I7. Interaction capture
    # =====================================================================

    async def test_a_signed_in_interaction_is_attributed_to_the_token(self):
        product = await self.make_product()
        r = await self.client.post(
            "/api/ai/interactions",
            headers=self.customer_headers,
            json={"product_id": product, "event_type": "view"},
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["data"]["user_id"], self.customer_id)
        row = await self.pool.fetchrow("SELECT * FROM user_interactions")
        self.assertEqual(str(row["user_id"]), self.customer_id)
        self.assertEqual(row["event_type"], "view")

    async def test_a_client_cannot_attribute_an_interaction_to_someone_else(self):
        # The route used to take `user_id` from the request body. A recommender
        # builds a person's taste from exactly this table, so attributing
        # engagement to another account is a lever on what that account is shown.
        product = await self.make_product()
        r = await self.client.post(
            "/api/ai/interactions",
            headers=self.customer_headers,
            json={"product_id": product, "event_type": "view", "user_id": self.admin_id},
        )
        self.assertEqual(r.status_code, 200, r.text)
        row = await self.pool.fetchrow("SELECT user_id FROM user_interactions")
        self.assertEqual(str(row["user_id"]), self.customer_id)
        self.assertNotEqual(str(row["user_id"]), self.admin_id)

    async def test_an_anonymous_interaction_with_a_session_is_recorded(self):
        product = await self.make_product()
        r = await self.client.post(
            "/api/ai/interactions",
            json={"product_id": product, "event_type": "view", "session_id": self.session_id},
        )
        self.assertEqual(r.status_code, 200, r.text)
        row = await self.pool.fetchrow("SELECT * FROM user_interactions")
        self.assertIsNone(row["user_id"])
        self.assertEqual(row["session_id"], self.session_id)

    async def test_an_anonymous_interaction_with_no_session_is_refused(self):
        # An interaction with no subject personalises nothing. Recording it would
        # be a row that can only ever be counted, never attributed.
        product = await self.make_product()
        r = await self.client.post(
            "/api/ai/interactions", json={"product_id": product, "event_type": "view"}
        )
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(err(r).get("code"), "SESSION_REQUIRED")
        self.assertEqual(
            int(await self.pool.fetchval("SELECT count(*) FROM user_interactions")), 0
        )

    async def test_an_unknown_event_type_is_refused_not_swallowed(self):
        # This was a CHECK violation caught by a bare `except Exception: pass`,
        # answered with `{"logged": true}`. The caller saw success.
        product = await self.make_product()
        r = await self.client.post(
            "/api/ai/interactions",
            headers=self.customer_headers,
            json={"product_id": product, "event_type": "teleport"},
        )
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(err(r).get("code"), "UNKNOWN_EVENT_TYPE")
        self.assertEqual(
            int(await self.pool.fetchval("SELECT count(*) FROM user_interactions")), 0
        )

    async def test_a_client_cannot_report_a_purchase(self):
        # A purchase is something the platform knows from `order_items`. A client
        # that can post one can inflate its own product's numbers.
        product = await self.make_product()
        for event in ("purchase",):
            r = await self.client.post(
                "/api/ai/interactions",
                headers=self.customer_headers,
                json={"product_id": product, "event_type": event},
            )
            self.assertEqual(r.status_code, 400, f"{event} -> {r.status_code}")
        self.assertEqual(
            int(await self.pool.fetchval("SELECT count(*) FROM user_interactions")), 0
        )

    async def test_the_four_client_event_types_are_accepted(self):
        product = await self.make_product()
        for event in ("view", "click", "add_to_cart", "wishlist"):
            r = await self.client.post(
                "/api/ai/interactions",
                headers=self.customer_headers,
                json={"product_id": product, "event_type": event},
            )
            self.assertEqual(r.status_code, 200, f"{event} -> {r.status_code} {r.text}")
        self.assertEqual(
            int(await self.pool.fetchval("SELECT count(*) FROM user_interactions")), 4
        )

    async def test_a_malformed_product_id_is_a_400_and_writes_nothing(self):
        # `to_valid_uuid` returns None for a bad value, and the old `if p_uuid:`
        # turned that into a silent no-op answered with success.
        r = await self.client.post(
            "/api/ai/interactions",
            headers=self.customer_headers,
            json={"product_id": "not-a-uuid", "event_type": "view"},
        )
        self.assertEqual(r.status_code, 400, r.text)
        self.assertEqual(err(r).get("code"), "VALIDATION_ERROR")

    async def test_an_interaction_for_a_product_that_does_not_exist_is_a_404(self):
        r = await self.client.post(
            "/api/ai/interactions",
            headers=self.customer_headers,
            json={"product_id": str(uuid.uuid4()), "event_type": "view"},
        )
        self.assertEqual(r.status_code, 404, r.text)

    async def test_the_interaction_is_written_even_when_the_recommender_is_down(self):
        # The old route returned early on a *successful* forward, so the platform's
        # own table was written only when the recommendation service was
        # unreachable -- which is always, since it is not deployed. The one copy
        # of this data we own was the fallback for a service that never answered.
        import httpx

        from app.config import settings

        product = await self.make_product()
        original = settings.RECOMMENDATION_SERVICE_URL
        # Port 1 on loopback refuses immediately, so the test measures the code
        # path rather than a DNS timeout.
        settings.RECOMMENDATION_SERVICE_URL = "http://127.0.0.1:1"
        try:
            r = await self.client.post(
                "/api/ai/interactions",
                headers=self.customer_headers,
                json={"product_id": product, "event_type": "view"},
            )
        finally:
            settings.RECOMMENDATION_SERVICE_URL = original

        self.assertEqual(r.status_code, 200, r.text)
        self.assertTrue(r.json()["data"]["logged"])
        self.assertFalse(r.json()["data"]["forwarded"])
        self.assertEqual(
            int(await self.pool.fetchval("SELECT count(*) FROM user_interactions")),
            1,
            "the local row was skipped because the forward failed",
        )

    async def test_interactions_are_stored_with_their_metadata(self):
        product = await self.make_product()
        r = await self.client.post(
            "/api/ai/interactions",
            headers=self.customer_headers,
            json={
                "product_id": product,
                "event_type": "add_to_cart",
                "metadata": {"quantity": 2, "variant": "L"},
            },
        )
        self.assertEqual(r.status_code, 200, r.text)
        row = await self.pool.fetchrow("SELECT metadata FROM user_interactions")
        raw = row["metadata"]
        meta = json.loads(raw) if isinstance(raw, str) else raw
        self.assertEqual(meta["quantity"], 2)
        self.assertEqual(meta["variant"], "L")

    async def test_captured_interactions_feed_the_rollup(self):
        # The two halves of section I joined up: what the frontend posts is what
        # the ranking reads.
        product = await self.make_product(title="Instrumented")
        for event, n in (("view", 6), ("click", 2)):
            for _ in range(n):
                await self.client.post(
                    "/api/ai/interactions",
                    headers=self.customer_headers,
                    json={"product_id": product, "event_type": event},
                )
        # The rows are written with NOW(), so they are already inside today's
        # window; the two-day range is only so the assertion does not depend on
        # the clock crossing midnight between the POST and the rollup.
        await self.rollup(days=2)
        row = await self.stat_row(product)
        self.assertEqual(row["views"], 6)
        self.assertEqual(row["clicks"], 2)


if __name__ == "__main__":
    unittest.main()


