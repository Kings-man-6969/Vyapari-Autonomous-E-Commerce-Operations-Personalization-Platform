"""
Variant behaviour: the resolver, the routes, and the money.

V8's test file (test_variants.py) proves the stock trigger is correct. This one
covers everything V8 deliberately left out: that a variant's price is actually
the price charged, that the bag and the order agree, that the cart can hold two
sizes of one product, and that a product never ends up with no options at all.

The tests are organised around the claims that would cost money if they broke,
not around the endpoints, because the endpoint list is an implementation detail
and "the customer was charged the wrong amount" is not.

    python -m unittest tests.test_variant_flows -v
"""
import os
import unittest
import uuid
from decimal import Decimal

import asyncpg
import httpx
from jose import jwt

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "").strip()

skip_without_db = unittest.skipUnless(
    TEST_DATABASE_URL, "TEST_DATABASE_URL not set; skipping variant flow tests"
)


def auth_header(user_id: str, role: str = "customer", email: str = "t@example.com") -> dict:
    from app.config import settings

    token = jwt.encode(
        {"id": str(user_id), "email": email, "role": role, "name": "T", "exp": 9999999999},
        settings.JWT_ACCESS_SECRET,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


class _Base(unittest.IsolatedAsyncioTestCase):
    maxDiff = None

    async def asyncSetUp(self):
        self.pool = await asyncpg.create_pool(
            dsn=TEST_DATABASE_URL, min_size=1, max_size=6
        )
        from app.db import set_pool

        set_pool(self.pool)
        await self.pool.execute("TRUNCATE users, categories RESTART IDENTITY CASCADE")

        from app.main import app

        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app, raise_app_exceptions=False),
            base_url="http://testserver",
        )

        self.category_id = await self.pool.fetchval(
            "INSERT INTO categories (name, slug) VALUES ('Apparel','apparel') RETURNING id"
        )
        self.seller_id = await self.pool.fetchval(
            "INSERT INTO users (name, email, password_hash, role) "
            "VALUES ('Seller','seller@example.com','x','seller') RETURNING id"
        )
        await self.pool.execute(
            "INSERT INTO seller_profiles (user_id, store_name) VALUES ($1,'Variant Store')",
            self.seller_id,
        )
        self.customer_id = await self.pool.fetchval(
            "INSERT INTO users (name, email, password_hash, role) "
            "VALUES ('Buyer','buyer@example.com','x','customer') RETURNING id"
        )
        self.seller_headers = auth_header(self.seller_id, "seller", "seller@example.com")
        self.customer_headers = auth_header(self.customer_id)

        # A fresh IP per test, from two bytes of a uuid, so the rate limiter's
        # in-memory buckets do not collide between tests.
        o = uuid.uuid4().bytes
        self.ip = f"198.51.100.{o[0]}.{o[1]}"

    async def asyncTearDown(self):
        from app.db import set_pool

        await self.client.aclose()
        await self.pool.close()
        set_pool(None)

    # -- fixtures --------------------------------------------------------

    async def make_product(self, price=100.0, stock=0, title="Cotton Kurta") -> str:
        n = uuid.uuid4().hex[:8]
        return await self.pool.fetchval(
            """INSERT INTO products
                 (seller_id, category_id, title, slug, description, price, stock_qty, status)
               VALUES ($1,$2,$3,$4,'d',$5,$6,'active') RETURNING id""",
            self.seller_id,
            self.category_id,
            f"{title} {n}",
            f"vf-{n}-{uuid.uuid4().hex[:6]}",
            price,
            stock,
        )

    async def make_variant(self, product_id, attributes, price=None, stock=5, **kw) -> str:
        import json

        return await self.pool.fetchval(
            """INSERT INTO product_variants
                 (product_id, price, stock_qty, attributes, is_default, is_active, sku)
               VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7) RETURNING id""",
            product_id,
            price,
            stock,
            json.dumps(attributes),
            kw.get("is_default", False),
            kw.get("is_active", True),
            kw.get("sku"),
        )

    async def set_has_variants(self, product_id, value: bool):
        await self.pool.execute(
            "UPDATE products SET has_variants = $2 WHERE id = $1", product_id, value
        )

    async def stock(self, product_id) -> int:
        return await self.pool.fetchval("SELECT stock_qty FROM products WHERE id=$1", product_id)

    async def variant_stock(self, variant_id) -> int:
        return await self.pool.fetchval(
            "SELECT stock_qty FROM product_variants WHERE id=$1", variant_id
        )

    async def api(self, method, path, **kw):
        kw.setdefault("headers", self.customer_headers)
        return await self.client.request(method, path, **kw)


# ── the price rule ───────────────────────────────────────────────────────────

@skip_without_db
class PriceAuthorityTests(_Base):
    """
    The one rule: a line's price comes from its option when it has one, and from
    its product when it does not.
    """

    async def test_a_plain_product_charges_its_own_price(self):
        from app.variants import resolve_purchase_line

        product = await self.make_product(price=250.0, stock=4)
        async with self.pool.acquire() as conn:
            line = await resolve_purchase_line(conn, product)
        self.assertEqual(line.price, Decimal("250.00"))
        self.assertEqual(line.stock, 4)
        self.assertIsNone(line.variant_id)

    async def test_a_variant_product_charges_the_variant_price(self):
        from app.variants import resolve_purchase_line

        product = await self.make_product(price=100.0)
        big = await self.make_variant(product, {"size": "XL"}, price=180.0, stock=2, is_default=True)
        await self.set_has_variants(product, True)
        async with self.pool.acquire() as conn:
            line = await resolve_purchase_line(conn, product, big)
        self.assertEqual(line.price, Decimal("180.00"))
        self.assertEqual(line.stock, 2, "stock must come from the option, not the product total")

    async def test_a_null_price_option_inherits_the_product_price(self):
        """
        price is nullable precisely so adding a size run does not require
        re-pricing every option. The inherited number must be the product's, at
        read time, so a later price change propagates without touching options.
        """
        from app.variants import resolve_purchase_line

        product = await self.make_product(price=100.0)
        free = await self.make_variant(product, {"size": "One Size"}, price=None, stock=9, is_default=True)
        await self.set_has_variants(product, True)
        async with self.pool.acquire() as conn:
            line = await resolve_purchase_line(conn, product, free)
        self.assertEqual(line.price, Decimal("100.00"))
        self.assertTrue(line.inherits_price)

        await self.pool.execute("UPDATE products SET price = 130.00 WHERE id=$1", product)
        async with self.pool.acquire() as conn:
            line = await resolve_purchase_line(conn, product, free)
        self.assertEqual(line.price, Decimal("130.00"), "inheritance must not be frozen at read time")

    async def test_a_legacy_cart_line_with_no_option_still_resolves(self):
        """
        The 10,057 existing products all have a backfilled default option, and
        every cart line written before this feature has variant_id NULL. Those
        lines must keep working, and they resolve to the default.
        """
        from app.variants import resolve_purchase_line

        product = await self.make_product(price=100.0)
        default = await self.pool.fetchval(
            """INSERT INTO product_variants (product_id, price, stock_qty, attributes, is_default)
               VALUES ($1, 100, 7, '{}'::jsonb, TRUE) RETURNING id""",
            product,
        )
        await self.set_has_variants(product, True)
        async with self.pool.acquire() as conn:
            line = await resolve_purchase_line(conn, product, None)
        self.assertEqual(str(line.variant_id), str(default))
        self.assertEqual(line.stock, 7)
        self.assertEqual(line.price, Decimal("100.00"))

    async def test_a_variant_product_with_no_usable_default_asks_for_a_choice(self):
        """
        The one case where the fallback cannot save a client. It is a 400, not a
        500 and not a silent purchase of the wrong thing, and it says what to do.
        """
        from app.variants import resolve_purchase_line
        from fastapi import HTTPException

        product = await self.make_product(price=100.0)
        await self.make_variant(product, {"size": "S"}, price=100.0, stock=3, is_default=True)
        # Retire the only default.
        await self.pool.execute(
            "UPDATE product_variants SET is_active = FALSE WHERE product_id = $1", product
        )
        await self.set_has_variants(product, True)
        async with self.pool.acquire() as conn:
            with self.assertRaises(HTTPException) as ctx:
                await resolve_purchase_line(conn, product, None)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(ctx.exception.detail["code"], "VARIANT_REQUIRED")

    async def test_a_retired_option_is_refused_by_name(self):
        from app.variants import resolve_purchase_line
        from fastapi import HTTPException

        product = await self.make_product(price=100.0)
        gone = await self.make_variant(product, {"size": "S"}, price=100.0, stock=3, is_default=True, is_active=False)
        await self.set_has_variants(product, True)
        async with self.pool.acquire() as conn:
            with self.assertRaises(HTTPException) as ctx:
                await resolve_purchase_line(conn, product, gone)
        self.assertEqual(ctx.exception.detail["code"], "VARIANT_UNAVAILABLE")

    async def test_another_products_option_is_refused(self):
        from app.variants import resolve_purchase_line
        from fastapi import HTTPException

        shirt = await self.make_product(price=100.0)
        mug = await self.make_product(price=50.0)
        shirt_size = await self.make_variant(shirt, {"size": "M"}, price=100.0, stock=3, is_default=True)
        await self.set_has_variants(shirt, True)
        async with self.pool.acquire() as conn:
            with self.assertRaises(HTTPException) as ctx:
                await resolve_purchase_line(conn, mug, shirt_size)
        self.assertEqual(ctx.exception.detail["code"], "VARIANT_MISMATCH")


# ── the bag ──────────────────────────────────────────────────────────────────

@skip_without_db
class CartVariantTests(_Base):
    async def test_two_sizes_of_one_product_are_two_lines(self):
        """
        The reason V9 exists. Under the old UNIQUE (cart_id, product_id) the
        second add silently incremented the first line and the customer ended up
        with six Mediums and no way to say otherwise.
        """
        product = await self.make_product(price=100.0)
        small = await self.make_variant(product, {"size": "S"}, price=100.0, stock=10, is_default=True)
        large = await self.make_variant(product, {"size": "L"}, price=100.0, stock=10)
        await self.set_has_variants(product, True)

        for variant in (small, large):
            r = await self.api(
                "POST", "/api/cart/items",
                json={"product_id": str(product), "variant_id": str(variant), "quantity": 1},
            )
            self.assertEqual(r.status_code, 200, r.text)

        r = await self.api("GET", "/api/cart")
        lines = r.json()["data"]["items"]
        self.assertEqual(len(lines), 2, "the two sizes collapsed into one line")
        self.assertEqual({line["variant_id"] for line in lines}, {str(small), str(large)})

    async def test_adding_the_same_size_twice_merges_and_caps_at_stock(self):
        product = await self.make_product(price=100.0)
        small = await self.make_variant(product, {"size": "S"}, price=100.0, stock=4, is_default=True)
        await self.set_has_variants(product, True)

        for _ in range(3):
            await self.api(
                "POST", "/api/cart/items",
                json={"product_id": str(product), "variant_id": str(small), "quantity": 3},
            )
        lines = (await self.api("GET", "/api/cart")).json()["data"]["items"]
        self.assertEqual(len(lines), 1)
        self.assertEqual(lines[0]["quantity"], 4, "merged, and capped at the 4 in stock")

    async def test_the_bag_prices_the_line_from_the_option(self):
        """A bag showing one number and an order charging another is the bug."""
        product = await self.make_product(price=100.0)
        big = await self.make_variant(product, {"size": "XL"}, price=275.0, stock=3, is_default=True)
        await self.set_has_variants(product, True)
        await self.api(
            "POST", "/api/cart/items",
            json={"product_id": str(product), "variant_id": str(big), "quantity": 2},
        )
        data = (await self.api("GET", "/api/cart")).json()["data"]
        line = data["items"][0]
        self.assertEqual(line["price"], 275.0)
        self.assertEqual(line["subtotal"], 550.0)
        self.assertEqual(data["total_amount"], 550.0)
        self.assertEqual(line["variant_label"], "XL")

    async def test_quantity_update_caps_against_the_option_not_the_product(self):
        product = await self.make_product(price=100.0, stock=500)
        small = await self.make_variant(product, {"size": "S"}, price=100.0, stock=3, is_default=True)
        large = await self.make_variant(product, {"size": "L"}, price=100.0, stock=200)
        await self.set_has_variants(product, True)
        await self.api(
            "POST", "/api/cart/items",
            json={"product_id": str(product), "variant_id": str(small), "quantity": 1},
        )
        item = (await self.api("GET", "/api/cart")).json()["data"]["items"][0]

        r = await self.api("PUT", f"/api/cart/items/{item['cart_item_id']}", json={"quantity": 99})
        self.assertEqual(r.json()["data"]["quantity"], 3, "capped at 500 product / 3 option")

    async def test_a_retired_option_says_so_instead_of_disappearing(self):
        """Silently dropping the line would hide the problem from the customer."""
        product = await self.make_product(price=100.0)
        size = await self.make_variant(product, {"size": "S"}, price=100.0, stock=3, is_default=True)
        await self.set_has_variants(product, True)
        await self.api(
            "POST", "/api/cart/items",
            json={"product_id": str(product), "variant_id": str(size), "quantity": 1},
        )
        await self.pool.execute(
            "UPDATE product_variants SET is_active = FALSE WHERE id = $1", size
        )
        line = (await self.api("GET", "/api/cart")).json()["data"]["items"][0]
        self.assertTrue(line["option_retired"])
        self.assertFalse(line["is_available"])
        self.assertEqual(line["quantity"], 1, "still in the bag, just flagged")


# ── the order ────────────────────────────────────────────────────────────────

@skip_without_db
class OrderVariantTests(_Base):
    ADDRESS = {"line1": "12 Gopalbari", "city": "Jaipur", "pincode": "302001", "country": "India"}

    async def place_order(self, items):
        return await self.api(
            "POST", "/api/orders",
            json={"shipping_address": self.ADDRESS, "items": items},
        )

    async def test_the_order_charges_the_option_price(self):
        product = await self.make_product(price=100.0)
        big = await self.make_variant(product, {"size": "XL"}, price=275.0, stock=5, is_default=True)
        await self.set_has_variants(product, True)

        r = await self.place_order([{"product_id": str(product), "variant_id": str(big), "quantity": 2}])
        self.assertEqual(r.status_code, 201, r.text)
        self.assertEqual(r.json()["data"]["total_amount"], 550.0)

    async def test_the_order_decrements_the_option_and_the_product_tracks_it(self):
        product = await self.make_product(price=100.0)
        small = await self.make_variant(product, {"size": "S"}, price=100.0, stock=4, is_default=True)
        large = await self.make_variant(product, {"size": "L"}, price=100.0, stock=6)
        await self.set_has_variants(product, True)

        await self.place_order([{"product_id": str(product), "variant_id": str(small), "quantity": 1}])
        self.assertEqual(await self.variant_stock(small), 3)
        self.assertEqual(await self.variant_stock(large), 6, "the other option is untouched")
        self.assertEqual(await self.stock(product), 9, "product total follows the trigger: 3 + 6")

    async def test_the_order_snapshots_the_attributes_and_sku(self):
        product = await self.make_product(price=100.0)
        v = await self.make_variant(
            product, {"size": "M", "colour": "Indigo"}, price=100.0, stock=4,
            is_default=True, sku="KUR-IND-M",
        )
        await self.set_has_variants(product, True)
        r = await self.place_order([{"product_id": str(product), "variant_id": str(v), "quantity": 1}])
        order_id = r.json()["data"]["order_id"]

        # Read the snapshot back through the API rather than with a raw SELECT.
        # This pool has no jsonb codec, so a direct read hands back a JSON *string*
        # and the assertion would be about asyncpg's codec config rather than
        # about the snapshot. The order page is the consumer that matters.
        line = (await self.api("GET", f"/api/orders/{order_id}")).json()["data"]["items"][0]
        self.assertEqual(line["variant_snapshot"], {"size": "M", "colour": "Indigo"})
        self.assertEqual(line["sku_at_purchase"], "KUR-IND-M")

        row = await self.pool.fetchrow(
            "SELECT variant_snapshot::text, sku_at_purchase FROM order_items WHERE order_id=$1", order_id
        )
        self.assertIn('"Indigo"', row["variant_snapshot"])
        self.assertEqual(row["sku_at_purchase"], "KUR-IND-M")

    async def test_renaming_the_option_does_not_rewrite_history(self):
        product = await self.make_product(price=100.0)
        v = await self.make_variant(product, {"colour": "Indigo"}, price=100.0, stock=4, is_default=True)
        await self.set_has_variants(product, True)
        r = await self.place_order([{"product_id": str(product), "variant_id": str(v), "quantity": 1}])
        order_id = r.json()["data"]["order_id"]

        await self.pool.execute(
            "UPDATE product_variants SET attributes = '{\"colour\":\"Midnight Blue\"}'::jsonb WHERE id=$1",
            v,
        )
        detail = (await self.api("GET", f"/api/orders/{order_id}")).json()["data"]
        line = detail["items"][0]
        self.assertEqual(line["variant_snapshot"], {"colour": "Indigo"}, "history is the snapshot")
        self.assertEqual(line["live_variant_attributes"], {"colour": "Midnight Blue"})
        self.assertTrue(line["variant_renamed"], "and the difference is surfaced, not hidden")

    async def test_overselling_one_option_is_refused(self):
        product = await self.make_product(price=100.0)
        small = await self.make_variant(product, {"size": "S"}, price=100.0, stock=2, is_default=True)
        large = await self.make_variant(product, {"size": "L"}, price=100.0, stock=50)
        await self.set_has_variants(product, True)

        r = await self.place_order([{"product_id": str(product), "variant_id": str(small), "quantity": 3}])
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json()["error"]["code"], "INSUFFICIENT_STOCK")
        self.assertIn("only 2", r.json()["error"]["message"], "the message must name the real figure")
        self.assertEqual(await self.variant_stock(small), 2, "a refused order takes nothing")

    async def test_concurrent_orders_cannot_oversell_one_option(self):
        """
        Two customers race for the last unit. Exactly one wins. This is the
        reason the option row is locked, not just read.
        """
        product = await self.make_product(price=100.0)
        only = await self.make_variant(product, {"size": "OS"}, price=100.0, stock=1, is_default=True)
        await self.set_has_variants(product, True)

        results = await __import__("asyncio").gather(
            *[
                self.place_order([{"product_id": str(product), "variant_id": str(only), "quantity": 1}])
                for _ in range(6)
            ]
        )
        created = [r for r in results if r.status_code == 201]
        self.assertEqual(len(created), 1, f"expected one winner, got {[r.status_code for r in results]}")
        self.assertEqual(await self.variant_stock(only), 0)

    async def test_the_database_refuses_a_cross_product_option(self):
        """
        The application checks this, but only the database can make it true for
        every writer including a future one.
        """
        shirt = await self.make_product(price=100.0)
        mug = await self.make_product(price=50.0)
        shirt_size = await self.make_variant(shirt, {"size": "M"}, price=100.0, stock=3, is_default=True)
        order_id = await self.pool.fetchval(
            "INSERT INTO orders (user_id,total_amount,shipping_address) VALUES ($1,50,'{}') RETURNING id",
            self.customer_id,
        )
        with self.assertRaises(asyncpg.exceptions.CheckViolationError):
            await self.pool.execute(
                """INSERT INTO order_items
                     (order_id, product_id, seller_id, quantity, price_at_purchase, variant_id)
                   VALUES ($1,$2,$3,1,50,$4)""",
                order_id, mug, self.seller_id, shirt_size,
            )

    async def test_an_order_line_with_no_option_still_works(self):
        product = await self.make_product(price=100.0, stock=5)
        r = await self.place_order([{"product_id": str(product), "quantity": 1}])
        self.assertEqual(r.status_code, 201, r.text)
        self.assertEqual(await self.stock(product), 4)

    async def test_the_idempotency_hash_covers_the_option(self):
        """
        The same key with a different option is a different order. If the hash
        ignored variant_id, a retry that picked a different size would silently
        return the first order.
        """
        product = await self.make_product(price=100.0)
        small = await self.make_variant(product, {"size": "S"}, price=100.0, stock=9, is_default=True)
        large = await self.make_variant(product, {"size": "L"}, price=100.0, stock=9)
        await self.set_has_variants(product, True)

        headers = {**self.customer_headers, "Idempotency-Key": "key-abc-123"}
        first = await self.client.post(
            "/api/orders",
            json={"shipping_address": self.ADDRESS,
                  "items": [{"product_id": str(product), "variant_id": str(small), "quantity": 1}]},
            headers=headers,
        )
        self.assertEqual(first.status_code, 201, first.text)

        clash = await self.client.post(
            "/api/orders",
            json={"shipping_address": self.ADDRESS,
                  "items": [{"product_id": str(product), "variant_id": str(large), "quantity": 1}]},
            headers=headers,
        )
        self.assertEqual(clash.status_code, 422)
        self.assertEqual(clash.json()["error"]["code"], "IDEMPOTENCY_PAYLOAD_MISMATCH")


# ── the management routes ────────────────────────────────────────────────────

@skip_without_db
class VariantManagementTests(_Base):
    async def make_size_run(self, count=3):
        """
        A product with `count` active options, already flagged the way the
        application would have flagged it. One option is not a variant product,
        so a count of 1 leaves the flag down -- which is the state
        test_creating_a_second_option_flips... needs to start from.
        """
        product = await self.make_product(price=100.0)
        made = []
        for i, size in enumerate(["S", "M", "L"][:count]):
            made.append(
                await self.make_variant(
                    product, {"size": size}, price=100.0 + i * 10, stock=5,
                    is_default=(i == 0), sort_order=i,
                )
            )
        if count >= 2:
            await self.set_has_variants(product, True)
        return product, made

    async def sell(self, method, path, body=None):
        return await self.client.request(
            method, path, json=body, headers={**self.seller_headers, "X-Forwarded-For": self.ip}
        )

    async def test_creating_a_second_option_flips_the_product_to_a_variant_product(self):
        product, _ = await self.make_size_run(1)
        self.assertFalse(await self.pool.fetchval("SELECT has_variants FROM products WHERE id=$1", product))

        r = await self.sell("POST", f"/api/products/{product}/variants",
                            {"attributes": {"size": "M"}, "price": 110, "stock_qty": 4})
        self.assertEqual(r.status_code, 201, r.text)
        self.assertTrue(
            await self.pool.fetchval("SELECT has_variants FROM products WHERE id=$1", product)
        )

    async def test_a_single_option_is_not_a_variant_product(self):
        """
        One option is not a choice. Leaving has_variants false keeps the
        product's own price and stock authoritative, which is what every
        pre-variant product does.
        """
        product = await self.make_product(price=100.0, stock=8)
        await self.sell("POST", f"/api/products/{product}/variants",
                        {"attributes": {"size": "OS"}, "price": 120, "stock_qty": 3})
        self.assertFalse(
            await self.pool.fetchval("SELECT has_variants FROM products WHERE id=$1", product)
        )

    async def test_an_option_needs_at_least_one_attribute(self):
        product, _ = await self.make_size_run(1)
        r = await self.sell("POST", f"/api/products/{product}/variants", {"attributes": {}, "stock_qty": 1})
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json()["error"]["code"], "VARIANT_ATTRIBUTES_REQUIRED")

    async def test_two_options_with_the_same_attributes_are_refused(self):
        """Two identical swatches in a picker, and the customer cannot tell them apart."""
        product, _ = await self.make_size_run(1)
        r = await self.sell("POST", f"/api/products/{product}/variants",
                            {"attributes": {"size": "S"}, "price": 120, "stock_qty": 1})
        self.assertEqual(r.status_code, 409)
        self.assertEqual(r.json()["error"]["code"], "DUPLICATE_VARIANT")

    async def test_key_order_does_not_defeat_the_duplicate_check(self):
        """jsonb equality is semantic, so this must be the same duplicate."""
        product, _ = await self.make_size_run(1)
        await self.make_variant(product, {"size": "S", "colour": "Red"}, price=1, stock=1)
        r = await self.sell("POST", f"/api/products/{product}/variants",
                            {"attributes": {"colour": "Red", "size": "S"}, "stock_qty": 1})
        self.assertEqual(r.json()["error"]["code"], "DUPLICATE_VARIANT")

    async def test_a_duplicate_sku_is_refused_with_its_own_code(self):
        product, made = await self.make_size_run(1)
        await self.pool.execute("UPDATE product_variants SET sku='KUR-S' WHERE id=$1", made[0])
        r = await self.sell("POST", f"/api/products/{product}/variants",
                            {"attributes": {"size": "M"}, "sku": "KUR-S", "stock_qty": 1})
        self.assertEqual(r.status_code, 409)
        self.assertEqual(r.json()["error"]["code"], "DUPLICATE_SKU")

    async def test_a_compare_at_below_the_price_is_refused(self):
        product, _ = await self.make_size_run(1)
        r = await self.sell("POST", f"/api/products/{product}/variants",
                            {"attributes": {"size": "M"}, "price": 200, "compare_at_price": 150, "stock_qty": 1})
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json()["error"]["code"], "INVALID_COMPARE_AT_PRICE")

    async def test_promoting_a_second_option_to_default_swaps_rather_than_fails(self):
        """
        The partial unique index permits one default per product, so the
        incumbent has to step down *before* the insert. Doing it after is the
        obvious way to write this and it fails every time.
        """
        product, made = await self.make_size_run(2)
        r = await self.sell(
            "PUT", f"/api/products/{product}/variants/{made[1]}", {"is_default": True}
        )
        self.assertEqual(r.status_code, 200, r.text)
        defaults = await self.pool.fetch(
            "SELECT id FROM product_variants WHERE product_id=$1 AND is_default", product
        )
        self.assertEqual(len(defaults), 1)
        self.assertEqual(str(defaults[0]["id"]), str(made[1]))

    async def test_the_first_option_added_becomes_the_default(self):
        """
        Without this, adding an option to a product leaves it with no default
        and every picker-less checkout fails with VARIANT_REQUIRED.
        """
        product = await self.make_product(price=100.0)
        r = await self.sell("POST", f"/api/products/{product}/variants",
                            {"attributes": {"size": "M"}, "stock_qty": 4})
        self.assertTrue(r.json()["data"]["variant"]["is_default"])

    async def test_deleting_back_below_one_option_promotes_the_last_price(self):
        """
        A seller who priced Large at 120 on a 100 product, retired the rest of
        the size run and kept the last option, must not find that 120 silently
        ignored. The product adopts it.
        """
        product, made = await self.make_size_run(3)
        # The last option (L) is priced 120.
        await self.pool.execute(
            "UPDATE product_variants SET is_active = FALSE WHERE id = ANY($1::uuid[])",
            [made[0], made[1]],
        )
        from app.variants import sync_variant_flag

        async with self.pool.acquire() as conn:
            await sync_variant_flag(conn, product)

        row = await self.pool.fetchrow(
            "SELECT has_variants, price, stock_qty FROM products WHERE id=$1", product
        )
        self.assertFalse(row["has_variants"])
        self.assertEqual(Decimal(str(row["price"])), Decimal("120.00"))
        self.assertEqual(row["stock_qty"], 5)

    async def test_deleting_an_ordered_option_retires_it_instead(self):
        """A hard delete would set order_items.variant_id to NULL and lose the SKU."""
        product, made = await self.make_size_run(2)
        order_id = await self.pool.fetchval(
            "INSERT INTO orders (user_id,total_amount,shipping_address) VALUES ($1,100,'{}') RETURNING id",
            self.customer_id,
        )
        await self.pool.execute(
            """INSERT INTO order_items
                 (order_id, product_id, seller_id, quantity, price_at_purchase, variant_id, sku_at_purchase)
               VALUES ($1,$2,$3,1,100,$4,'SAVED-SKU')""",
            order_id, product, self.seller_id, made[1],
        )
        r = await self.sell("DELETE", f"/api/products/{product}/variants/{made[1]}")
        self.assertEqual(r.json()["data"]["outcome"], "retired")
        self.assertFalse(
            await self.pool.fetchval("SELECT is_active FROM product_variants WHERE id=$1", made[1])
        )
        sku = await self.pool.fetchval("SELECT sku_at_purchase FROM order_items WHERE order_id=$1", order_id)
        self.assertEqual(sku, "SAVED-SKU", "order history keeps the SKU")

    async def test_deleting_an_unordered_option_removes_it(self):
        product, made = await self.make_size_run(2)
        r = await self.sell("DELETE", f"/api/products/{product}/variants/{made[1]}")
        self.assertEqual(r.json()["data"]["outcome"], "deleted")
        self.assertIsNone(
            await self.pool.fetchval("SELECT id FROM product_variants WHERE id=$1", made[1])
        )

    async def test_reorder_is_not_shadowed_by_the_variant_id_route(self):
        """
        "/variants/order" and "/variants/{id}" are both three segments. If the
        literal route is registered second, a reorder 404s as a missing option.
        """
        product, made = await self.make_size_run(3)
        r = await self.sell(
            "PUT", f"/api/products/{product}/variants/order",
            {"variant_ids": [str(made[2]), str(made[0]), str(made[1])]},
        )
        self.assertEqual(r.status_code, 200, r.text)
        order = await self.pool.fetch(
            "SELECT id FROM product_variants WHERE product_id=$1 ORDER BY sort_order", product
        )
        self.assertEqual([str(x["id"]) for x in order], [str(made[2]), str(made[0]), str(made[1])])

    async def test_reorder_refuses_an_option_from_another_product(self):
        product, made = await self.make_size_run(2)
        other, other_variants = await self.make_size_run(2)
        r = await self.sell(
            "PUT", f"/api/products/{product}/variants/order",
            {"variant_ids": [str(made[0]), str(other_variants[0])]},
        )
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json()["error"]["code"], "VARIANT_NOT_FOUND")

    async def test_a_seller_cannot_touch_another_sellers_options(self):
        product, _ = await self.make_size_run(2)
        other = await self.pool.fetchval(
            "INSERT INTO users (name,email,password_hash,role) VALUES ('Rival','rival@example.com','x','seller') RETURNING id"
        )
        headers = {**auth_header(other, "seller", "rival@example.com"), "X-Forwarded-For": self.ip}
        r = await self.client.get(f"/api/products/{product}/variants", headers=headers)
        self.assertEqual(r.status_code, 404, "404, not 403: 403 confirms the product exists")

    async def test_an_admin_can_touch_any_product(self):
        product, made = await self.make_size_run(2)
        admin = await self.pool.fetchval(
            "INSERT INTO users (name,email,password_hash,role) VALUES ('A','admin@example.com','x','admin') RETURNING id"
        )
        headers = {**auth_header(admin, "admin", "admin@example.com"), "X-Forwarded-For": self.ip}
        r = await self.client.put(
            f"/api/products/{product}/variants/{made[0]}",
            json={"stock_qty": 42},
            headers=headers,
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(await self.variant_stock(made[0]), 42)

    async def test_adding_an_option_to_a_plain_product_also_corrects_its_stock(self):
        """
        The V8 trigger is gated on has_variants being true:

            UPDATE products ... WHERE p.id = target AND p.has_variants = TRUE

        So the option that makes a product a variant product is the one whose
        insert the trigger ignores. Without an explicit re-sum the product
        keeps whatever stock_qty it had -- for a product created by a form
        that supplies quantities per option, that is 0 while the options hold
        6. The catalogue then shows a product with six items in stock as
        having none.
        """
        product = await self.make_product(price=100.0, stock=0)
        for size, qty in (("S", 4), ("L", 2)):
            r = await self.sell("POST", f"/api/products/{product}/variants",
                                {"attributes": {"size": size}, "price": 100, "stock_qty": qty})
            self.assertEqual(r.status_code, 201, r.text)
        self.assertEqual(await self.stock(product), 6)

    async def test_turning_the_last_option_off_reports_no_stock(self):
        """The other direction: zero active options means nothing is sellable."""
        product, made = await self.make_size_run(2)
        for v in made:
            r = await self.sell("PUT", f"/api/products/{product}/variants/{v}", {"is_active": False})
            self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(await self.stock(product), 0)
        self.assertEqual(
            await self.pool.fetchval("SELECT status FROM products WHERE id=$1", product),
            "out_of_stock",
        )

    async def test_switching_off_the_only_option_leaves_nothing_to_sell(self):
        """
        Sequential, not batch. The first switch-off drops has_variants to false
        on its own (one option is not a choice), so when the second arrives the
        flag has nothing left to change. A "did the flag just move?" test is
        true before and after and does nothing, and the product keeps quoting
        the stock of the option that is no longer there.
        """
        product = await self.make_product(price=100.0, stock=7)
        v = await self.sell(
            "POST", f"/api/products/{product}/variants",
            {"attributes": {"size": "OS"}, "price": 100, "stock_qty": 3},
        )
        self.assertEqual(v.status_code, 201, v.text)
        variant_id = v.json()["data"]["variant"]["id"]

        # Still 7, not 3. One option is not a choice, so has_variants stays down
        # and the product's own authored number is the one that governs -- the
        # option mirrors the product, it does not replace it.
        self.assertEqual(await self.stock(product), 7)

        r = await self.sell("PUT", f"/api/products/{product}/variants/{variant_id}", {"is_active": False})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(
            await self.stock(product), 0,
            "the only option is off, so the product is not selling 7 of something "
            "nobody can buy",
        )

    async def test_a_product_with_no_option_rows_keeps_its_own_stock(self):
        """
        The guard on the zero-option rule, and the reason it exists.

        Imports and pre-V8 rows arrive as a product with no option rows at all.
        That is a plain product whose stock is its own authored number, not a
        product whose options are all switched off -- and the difference is 7
        units of sellable stock rather than none.
        """
        from app.variants import sync_variant_flag

        product = await self.make_product(price=100.0, stock=7)
        await sync_variant_flag(self.pool, str(product))
        self.assertEqual(await self.stock(product), 7)


@skip_without_db
class RouteSurfaceTests(_Base):
    """
    Two bugs that are invisible from the call site and cost a support ticket
    each. Both were found by tests written for something else.
    """

    async def test_posting_to_the_collection_without_a_trailing_slash_works(self):
        """
        POST /api/products returned 405, not 201.

        The router declared only the trailing-slash form while GET declared
        both. Starlette does not fall back to its slash-adding redirect once a
        *partial* match exists, and a GET on the same path is exactly that --
        so the un-slashed POST was answered 405 by a route that could have
        redirected it. A client that omits the slash sees "Method Not Allowed"
        on a method the endpoint does support, which sends people looking for a
        CORS or CSRF problem that does not exist.

        Every collection route has to serve both spellings, because which one a
        client sends is not ours to decide.
        """
        r = await self.client.post(
            "/api/products",
            json={"title": "No Slash Throw", "description": "d", "price": 400,
                  "stock_qty": 2, "category_id": str(self.category_id)},
            headers={**self.seller_headers, "X-Forwarded-For": self.ip},
        )
        self.assertEqual(r.status_code, 201, r.text)

    async def test_the_posted_slash_form_still_works(self):
        r = await self.client.post(
            "/api/products/",
            json={"title": "Slash Throw", "description": "d", "price": 400,
                  "stock_qty": 2, "category_id": str(self.category_id)},
            headers={**self.seller_headers, "X-Forwarded-For": self.ip},
        )
        self.assertEqual(r.status_code, 201, r.text)

    async def test_authenticated_rate_limits_are_keyed_by_user_not_ip(self):
        """
        Every authenticated limit was silently keyed by IP.

        rate_limit._identity() reads request.state.user, and nothing ever wrote
        it -- require_auth returned the payload and discarded it. So the
        "user id when authenticated" branch was dead code and all fifteen
        limited routes bucketed by client IP.

        Two things go wrong, and both are invisible without a test:

          * Every unrelated customer behind one carrier-grade NAT shares a
            bucket, so one busy caller 429s everyone else. These are the
            checkout and order routes, which is the worst place for it.

          * X-Forwarded-For is client-controlled. Bucketed by IP, rotating that
            one header buys an unlimited allowance -- which is the entire
            reason the user branch existed.

        This asserts the bucket is per-user: the same user exhausts their own
        limit, and a *different* user is unaffected by the first one's traffic.
        """
        # orders.create is 10/minute. Burn it with one user.
        product = await self.make_product(price=10.0, stock=1000)
        burned = 0
        for _ in range(12):
            r = await self.api(
                "POST", "/api/orders",
                json={"shipping_address": {"line1": "a", "city": "b", "pincode": "302001"},
                      "items": [{"product_id": str(product), "quantity": 1}]},
            )
            if r.status_code == 429:
                break
            burned += 1
        self.assertEqual(burned, 10, f"expected the 10/minute limit, got {burned}")

        # A different user, same nominal IP, must be unaffected.
        other = await self.pool.fetchval(
            "INSERT INTO users (name,email,password_hash,role) "
            "VALUES ('B','other@example.com','x','customer') RETURNING id"
        )
        r = await self.client.post(
            "/api/orders",
            json={"shipping_address": {"line1": "a", "city": "b", "pincode": "302001"},
                  "items": [{"product_id": str(product), "quantity": 1}]},
            headers=auth_header(other),
        )
        self.assertEqual(
            r.status_code, 201,
            "a second account was rate-limited by the first account's traffic; "
            "the bucket is keyed by IP rather than by user",
        )


# ── product create and update ────────────────────────────────────────────────

@skip_without_db
class ProductCreateVariantTests(_Base):
    async def sell(self, method, path, body=None):
        return await self.client.request(
            method, path, json=body, headers={**self.seller_headers, "X-Forwarded-For": self.ip}
        )

    async def test_a_new_product_always_gets_at_least_one_option(self):
        """
        The invariant V8's backfill gave the existing catalogue. Creating a
        product without one would leave the newest listing as the only product
        a variant loop has to special-case.
        """
        r = await self.sell("POST", "/api/products", {
            "title": "Handwoven Throw", "description": "d", "price": 500,
            "stock_qty": 6, "category_id": str(self.category_id),
        })
        self.assertEqual(r.status_code, 201, r.text)
        product_id = r.json()["data"]["product"]["id"]
        count = await self.pool.fetchval(
            "SELECT count(*) FROM product_variants WHERE product_id=$1", product_id
        )
        self.assertEqual(count, 1)

    async def test_a_new_product_with_options_is_a_variant_product(self):
        r = await self.sell("POST", "/api/products", {
            "title": "Cotton Kurta", "description": "d", "price": 100, "stock_qty": 0,
            "category_id": str(self.category_id),
            "variants": [
                {"attributes": {"size": "S"}, "price": 100, "stock_qty": 4},
                {"attributes": {"size": "L"}, "price": 120, "stock_qty": 2},
                {"attributes": {"size": "XL"}, "price": 140, "stock_qty": 0},
            ],
        })
        self.assertEqual(r.status_code, 201, r.text)
        product = r.json()["data"]["product"]
        self.assertTrue(product["has_variants"])
        self.assertEqual(int(product["stock_qty"]), 6, "the trigger summed 4 + 2 + 0")

    async def test_updating_the_product_stock_of_a_variant_product_is_refused(self):
        """
        Accepted-and-overwritten is the worst outcome: the seller types 50,
        presses save, sees the old number, and reports the form is broken.
        Refusing is better, and the code says where to go instead.
        """
        r = await self.sell("POST", "/api/products", {
            "title": "Cotton Kurta", "description": "d", "price": 100, "stock_qty": 0,
            "category_id": str(self.category_id),
            "variants": [
                {"attributes": {"size": "S"}, "price": 100, "stock_qty": 4},
                {"attributes": {"size": "L"}, "price": 120, "stock_qty": 2},
            ],
        })
        product_id = r.json()["data"]["product"]["id"]

        r = await self.sell("PUT", f"/api/products/{product_id}", {"stock_qty": 50})
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json()["error"]["code"], "STOCK_MANAGED_BY_VARIANTS")
        self.assertEqual(
            await self.pool.fetchval("SELECT stock_qty FROM products WHERE id=$1", product_id), 6
        )

    async def test_re_sending_the_current_stock_is_allowed(self):
        """A form that echoes every field back must still save."""
        r = await self.sell("POST", "/api/products", {
            "title": "Cotton Kurta", "description": "d", "price": 100, "stock_qty": 0,
            "category_id": str(self.category_id),
            "variants": [
                {"attributes": {"size": "S"}, "price": 100, "stock_qty": 4},
                {"attributes": {"size": "L"}, "price": 120, "stock_qty": 2},
            ],
        })
        product_id = r.json()["data"]["product"]["id"]
        r = await self.sell(
            "PUT", f"/api/products/{product_id}", {"stock_qty": 6, "title": "Renamed Kurta"}
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["data"]["product"]["title"], "Renamed Kurta")

    async def test_a_plain_product_still_accepts_a_stock_edit(self):
        r = await self.sell("POST", "/api/products", {
            "title": "Brass Bowl", "description": "d", "price": 900, "stock_qty": 3,
            "category_id": str(self.category_id),
        })
        product_id = r.json()["data"]["product"]["id"]
        r = await self.sell("PUT", f"/api/products/{product_id}", {"stock_qty": 50})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(
            await self.pool.fetchval("SELECT stock_qty FROM products WHERE id=$1", product_id), 50
        )

    async def test_an_update_that_omits_options_does_not_delete_them(self):
        """
        A PUT that happens not to include options must not be read as "remove
        them all". Options that are in nobody's cart and nobody's order history
        disappearing because a form did not render the table is unacceptable.
        """
        r = await self.sell("POST", "/api/products", {
            "title": "Cotton Kurta", "description": "d", "price": 100, "stock_qty": 0,
            "category_id": str(self.category_id),
            "variants": [
                {"attributes": {"size": "S"}, "price": 100, "stock_qty": 4},
                {"attributes": {"size": "L"}, "price": 120, "stock_qty": 2},
            ],
        })
        product_id = r.json()["data"]["product"]["id"]
        await self.sell("PUT", f"/api/products/{product_id}", {"title": "Just A Rename"})
        count = await self.pool.fetchval(
            "SELECT count(*) FROM product_variants WHERE product_id=$1", product_id
        )
        self.assertEqual(count, 2)

    async def test_the_detail_endpoint_carries_options_and_axes(self):
        """A PDP that needs a second request to discover it has options shows a
        buy button that fails at checkout."""
        r = await self.sell("POST", "/api/products", {
            "title": "Block Print Kurta", "description": "d", "price": 100, "stock_qty": 0,
            "category_id": str(self.category_id),
            "variants": [
                {"attributes": {"size": "S", "colour": "Indigo"}, "price": 100, "stock_qty": 4},
                {"attributes": {"size": "L", "colour": "Indigo"}, "price": 120, "stock_qty": 0},
                {"attributes": {"size": "M", "colour": "Rust"}, "price": 110, "stock_qty": 2},
            ],
        })
        product_id = r.json()["data"]["product"]["id"]

        detail = (await self.client.get(f"/api/products/{product_id}")).json()["data"]
        self.assertEqual(detail["variant_count"], 3)
        axes = {a["key"]: a for a in detail["axes"]}
        self.assertEqual(set(axes), {"size", "colour"})
        self.assertEqual(axes["size"]["label"], "Size")
        self.assertEqual(axes["colour"]["label"], "Colour")
        # Order follows sort_order, so S then L then M as submitted.
        self.assertEqual([v["value"] for v in axes["size"]["values"]], ["S", "L", "M"])
        # Out-of-stock combinations report zero availability so a picker can grey them.
        by_value = {v["value"]: v["available"] for v in axes["colour"]["values"]}
        self.assertEqual(by_value["Indigo"], 1, "one Indigo is in stock, one is not")

    async def test_a_plain_product_reports_no_options_at_all(self):
        """A one-option picker is noise, so a plain product reports an empty list."""
        r = await self.sell("POST", "/api/products", {
            "title": "Brass Bowl", "description": "d", "price": 900, "stock_qty": 3,
            "category_id": str(self.category_id),
        })
        product_id = r.json()["data"]["product"]["id"]
        detail = (await self.client.get(f"/api/products/{product_id}")).json()["data"]
        self.assertEqual(detail["variants"], [])
        self.assertEqual(detail["axes"], [])
        self.assertEqual(detail["variant_count"], 0)


# ── the seller's side ────────────────────────────────────────────────────────

@skip_without_db
class SellerFacingLineTests(_Base):
    """
    The seller's order list is the page a seller packs a box from. It is the one
    place the option has to appear for the transaction to work at all: a line
    reading "2x Cotton Kurta" with no size is a return.
    """

    ADDRESS = {"line1": "12 Gopalbari", "city": "Jaipur", "pincode": "302001", "country": "India"}

    async def place_order(self, items):
        return await self.api(
            "POST", "/api/orders",
            json={"shipping_address": self.ADDRESS, "items": items},
        )

    async def seller_orders(self):
        return await self.client.get(
            "/api/seller/orders",
            headers={**self.seller_headers, "X-Forwarded-For": self.ip},
        )

    async def test_the_seller_sees_the_option_on_each_line(self):
        product = await self.make_product(price=100.0)
        big = await self.make_variant(
            product, {"size": "XL", "colour": "Indigo"}, price=275.0, stock=5, is_default=True
        )
        await self.set_has_variants(product, True)
        r = await self.place_order([{"product_id": str(product), "variant_id": str(big), "quantity": 2}])
        self.assertEqual(r.status_code, 201, r.text)

        res = await self.seller_orders()
        self.assertEqual(res.status_code, 200, res.text)
        rows = res.json()["data"]
        self.assertEqual(len(rows), 1)

        # The aggregate arrives parsed. json_agg is a *string* on this pool, and
        # the order table guards on Array.isArray(items) -- so before the router
        # parsed it, every seller's order list showed an empty Items column and
        # nothing anywhere said so.
        items = rows[0]["items"]
        self.assertIsInstance(items, list, f"items came back as {type(items).__name__}")
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["quantity"], 2)

        # Values only, formatted by the same function the bag and the order page
        # use. jsonb does not preserve key order -- it reorders by length, so
        # "size" (4) precedes "colour" (7) however the seller listed them. That
        # could not be assembled in SQL, and it is why the label is built here
        # rather than in the aggregate.
        self.assertEqual(items[0]["variant_label"], "XL / Indigo")

    async def test_a_plain_product_line_has_no_option_label(self):
        product = await self.make_product(price=100.0, stock=4)
        r = await self.place_order([{"product_id": str(product), "quantity": 1}])
        self.assertEqual(r.status_code, 201, r.text)

        items = (await self.seller_orders()).json()["data"][0]["items"]
        self.assertEqual(items[0]["variant_label"], "")
        self.assertIsNone(items[0]["variant_id"])


# ── pure helpers ─────────────────────────────────────────────────────────────

class VariantHelperTests(unittest.TestCase):
    """No database needed; these are the pure functions."""

    def test_attributes_arrive_as_a_dict_a_string_or_nothing(self):
        from app.variants import coerce_attributes

        self.assertEqual(coerce_attributes({"size": "M"}), {"size": "M"})
        self.assertEqual(coerce_attributes('{"size":"M","colour":"Red"}'), {"size": "M", "colour": "Red"})
        self.assertEqual(coerce_attributes(None), {})
        self.assertEqual(coerce_attributes(""), {})
        self.assertEqual(coerce_attributes("Red"), {"option": "Red"})

    def test_unusable_attribute_values_are_dropped_not_rendered(self):
        from app.variants import coerce_attributes

        self.assertEqual(
            coerce_attributes({"size": "M", "colour": None, "": "x", "shape": {"a": 1}}),
            {"size": "M"},
        )

    def test_numbers_become_strings_rather_than_errors(self):
        """A seller who types size 10 should not get a validation error."""
        from app.variants import coerce_attributes

        self.assertEqual(coerce_attributes({"pack": 3}), {"pack": "3"})

    def test_axes_are_derived_and_ordered_by_first_appearance(self):
        from app.variants import variant_axes

        axes = variant_axes([
            {"attributes": {"size": "S", "colour": "Indigo"}, "is_active": True, "stock_qty": 4},
            {"attributes": {"size": "M", "colour": "Indigo"}, "is_active": True, "stock_qty": 0},
            {"attributes": {"size": "L", "colour": "Rust"}, "is_active": False, "stock_qty": 9},
        ])
        self.assertEqual([a["key"] for a in axes], ["size", "colour"])
        self.assertEqual([v["value"] for v in axes[0]["values"]], ["S", "M", "L"])
        self.assertEqual(
            {v["value"]: v["available"] for v in axes[0]["values"]}, {"S": 1, "M": 0, "L": 0}
        )

    def test_a_retired_option_does_not_make_its_value_look_available(self):
        from app.variants import variant_axes

        axes = variant_axes([{"attributes": {"size": "L"}, "is_active": False, "stock_qty": 5}])
        self.assertEqual(axes[0]["values"][0]["available"], 0)

    def test_axis_labels_are_readable(self):
        from app.variants import variant_axes

        axes = variant_axes([
            {"attributes": {"pack_size": "3"}, "is_active": True, "stock_qty": 1},
            {"attributes": {"novelty_axis": "x"}, "is_active": True, "stock_qty": 1},
        ])
        labels = {a["key"]: a["label"] for a in axes}
        self.assertEqual(labels["pack_size"], "Pack Size")
        self.assertEqual(labels["novelty_axis"], "Novelty Axis", "unknown axes still get a title")

    def test_option_labels_read_naturally(self):
        from app.variants import describe_attributes

        self.assertEqual(describe_attributes({"size": "XL"}), "XL")
        # Values only. "Colour: Indigo / Size: Large" restates the axis names
        # the customer just used on the picker and the product title beside it;
        # what a line item has to convey is the choice, not the vocabulary.
        self.assertEqual(describe_attributes({"size": "XL", "colour": "Indigo"}), "XL / Indigo")
        self.assertEqual(describe_attributes({}), "", "a plain product shows no option at all")
        self.assertEqual(describe_attributes(None), "")

    def test_serialisation_echoes_the_effective_price_for_an_inheriting_option(self):
        """A picker showing nothing next to "inherits" is a dead end for a buyer."""
        from app.variants import serialise_variant

        out = serialise_variant(
            {"id": "v1", "product_id": "p1", "price": None, "compare_at_price": None,
             "stock_qty": 3, "is_active": True, "attributes": '{"size":"M"}'},
            product_price=250.0,
        )
        self.assertEqual(out["price"], 250.0)
        self.assertIsNone(out["list_price"])
        self.assertTrue(out["inherits_price"])
        self.assertTrue(out["in_stock"])
        self.assertEqual(out["attributes"], {"size": "M"})


if __name__ == "__main__":
    unittest.main()
