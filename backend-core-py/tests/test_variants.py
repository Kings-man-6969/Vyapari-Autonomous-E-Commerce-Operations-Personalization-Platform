"""
Product variants - schema and stock-invariant tests against a real database.

The load-bearing claim of V8 is that products.stock_qty stays truthful whether
or not a product has variants:

    has_variants = false  ->  the seller authors stock_qty directly
    has_variants = true   ->  a trigger maintains stock_qty as the SUM of the
                              product's active variants

If that invariant breaks, the catalogue keeps selling stock that does not
exist. These tests exercise the trigger directly rather than trusting the
migration to have written it correctly.

Skipped unless TEST_DATABASE_URL is set, so a plain `unittest discover` run
stays green without a database.

    python -m unittest tests.test_variants -v
"""
import json
import os
import unittest
import uuid

import asyncpg

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "").strip()


@unittest.skipUnless(
    TEST_DATABASE_URL, "TEST_DATABASE_URL not set; skipping variant schema tests"
)
class VariantSchemaTests(unittest.IsolatedAsyncioTestCase):
    maxDiff = None

    async def asyncSetUp(self):
        self.pool = await asyncpg.create_pool(
            dsn=TEST_DATABASE_URL, min_size=1, max_size=4
        )
        await self.pool.execute("TRUNCATE users, categories RESTART IDENTITY CASCADE")
        self.category_id = await self.pool.fetchval(
            "INSERT INTO categories (name, slug) VALUES ('Apparel','apparel') RETURNING id"
        )
        self.seller_id = await self.pool.fetchval(
            "INSERT INTO users (name, email, password_hash, role) "
            "VALUES ($1,$2,'x','seller') RETURNING id",
            "Variant Seller",
            f"{uuid.uuid4().hex}@test.local",
        )
        await self.pool.execute(
            "INSERT INTO seller_profiles (user_id, store_name) VALUES ($1,$2)",
            self.seller_id,
            "Variant Store",
        )

    async def asyncTearDown(self):
        await self.pool.close()

    async def make_product(self, stock: int = 10, price: float = 99.0) -> str:
        n = uuid.uuid4().hex[:8]
        return await self.pool.fetchval(
            """INSERT INTO products
                 (seller_id, category_id, title, slug, description, price, stock_qty, status)
               VALUES ($1,$2,$3,$4,'d',$5,$6,'active') RETURNING id""",
            self.seller_id,
            self.category_id,
            f"Product {n}",
            f"variant-product-{n}-{uuid.uuid4().hex[:6]}",
            price,
            stock,
        )

    async def make_variant(self, product_id: str, **kw) -> str:
        defaults = {
            "price": 99.0,
            "stock_qty": 5,
            # A fresh attribute set per call. V9's uq_product_variants_attributes
            # rejects two variants of one product with the same attributes --
            # correctly, since they would be indistinguishable in a picker -- and
            # these tests insert two at a time to watch the sum. Defaulting both
            # to '{}' made them fail on an index that has nothing to do with the
            # trigger they exist to check. The duplicate rejection has its own
            # test at the end of this file.
            "attributes": json.dumps({"option": uuid.uuid4().hex[:8]}),
        }
        defaults.update(kw)
        return await self.pool.fetchval(
            """INSERT INTO product_variants
                 (product_id, price, stock_qty, attributes, sku, is_default, is_active, sort_order)
               VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8) RETURNING id""",
            product_id,
            defaults.get("price"),
            defaults.get("stock_qty"),
            defaults.get("attributes"),
            defaults.get("sku"),
            defaults.get("is_default", False),
            defaults.get("is_active", True),
            defaults.get("sort_order", 0),
        )

    async def stock_of(self, product_id: str) -> int:
        return await self.pool.fetchval(
            "SELECT stock_qty FROM products WHERE id=$1", product_id
        )

    # -- the invariant ---------------------------------------------------

    async def test_non_variant_product_stock_is_authored_directly(self):
        p = await self.make_product(stock=7)
        await self.pool.execute(
            "UPDATE products SET stock_qty=3 WHERE id=$1", p
        )
        # No trigger should have overwritten a hand-written value.
        self.assertEqual(await self.stock_of(p), 3)

    async def test_variant_insert_sums_into_parent(self):
        p = await self.make_product()
        await self.pool.execute("UPDATE products SET has_variants=TRUE WHERE id=$1", p)
        await self.make_variant(p, stock_qty=4)
        await self.make_variant(p, stock_qty=6)
        self.assertEqual(await self.stock_of(p), 10)

    async def test_variant_decrement_propagates(self):
        p = await self.make_product()
        await self.pool.execute("UPDATE products SET has_variants=TRUE WHERE id=$1", p)
        await self.make_variant(p, stock_qty=4)
        v = await self.make_variant(p, stock_qty=6)
        await self.pool.execute(
            "UPDATE product_variants SET stock_qty=1 WHERE id=$1", v
        )
        self.assertEqual(await self.stock_of(p), 5)

    async def test_deactivated_variant_leaves_the_sum(self):
        """A paused variant must stop counting, or a paused SKU blocks sales."""
        p = await self.make_product()
        await self.pool.execute("UPDATE products SET has_variants=TRUE WHERE id=$1", p)
        await self.make_variant(p, stock_qty=4)
        v = await self.make_variant(p, stock_qty=6)
        await self.pool.execute(
            "UPDATE product_variants SET is_active=FALSE WHERE id=$1", v
        )
        self.assertEqual(await self.stock_of(p), 4)

    async def test_reactivating_a_variant_restores_the_sum(self):
        p = await self.make_product()
        await self.pool.execute("UPDATE products SET has_variants=TRUE WHERE id=$1", p)
        v = await self.make_variant(p, stock_qty=6)
        await self.pool.execute("UPDATE products SET has_variants=TRUE WHERE id=$1", p)
        await self.pool.execute(
            "UPDATE product_variants SET is_active=FALSE WHERE id=$1", v
        )
        self.assertEqual(await self.stock_of(p), 0)
        await self.pool.execute(
            "UPDATE product_variants SET is_active=TRUE WHERE id=$1", v
        )
        self.assertEqual(await self.stock_of(p), 6)

    async def test_deleting_all_variants_zeroes_the_parent(self):
        """Otherwise a product with no variants left keeps selling its last sum."""
        p = await self.make_product()
        await self.pool.execute("UPDATE products SET has_variants=TRUE WHERE id=$1", p)
        await self.make_variant(p, stock_qty=9)
        await self.pool.execute("DELETE FROM product_variants WHERE product_id=$1", p)
        self.assertEqual(await self.stock_of(p), 0)

    # -- attribute uniqueness (V9) -----------------------------------------

    async def test_two_variants_with_the_same_attributes_are_rejected(self):
        """
        Enforced in the index, not in a router, so an import script and a future
        service cannot create one either.

        jsonb equality is semantic, so the collision holds regardless of key
        order -- which is what makes an index on jsonb worth having at all.
        """
        p = await self.make_product()
        await self.make_variant(p, attributes=json.dumps({"size": "M", "colour": "Red"}))
        with self.assertRaises(asyncpg.UniqueViolationError):
            await self.make_variant(
                p, attributes=json.dumps({"colour": "Red", "size": "M"})
            )

    async def test_the_same_attributes_on_different_products_are_fine(self):
        """The index is scoped to the product; 'Medium' is not globally unique."""
        a = await self.make_product()
        b = await self.make_product()
        await self.make_variant(a, attributes=json.dumps({"size": "M"}))
        await self.make_variant(b, attributes=json.dumps({"size": "M"}))
        self.assertEqual(
            await self.pool.fetchval(
                "SELECT count(*) FROM product_variants WHERE attributes='{\"size\":\"M\"}'::jsonb"
            ),
            2,
        )

    async def test_two_attribute_less_variants_are_rejected(self):
        """
        '{}' is an attribute set like any other, so it collides.

        Worth stating explicitly because the seeded catalogue is full of
        attribute-less default rows -- one per pre-variant product, each on its
        own product, so none of them collide. It is only a second one on the
        *same* product that does, and that is precisely the ambiguity a picker
        cannot render.
        """
        p = await self.make_product()
        await self.make_variant(p, attributes="{}")
        with self.assertRaises(asyncpg.UniqueViolationError):
            await self.make_variant(p, attributes="{}")

    async def test_one_variant_product_deletion_cascades(self):
        p = await self.make_product()
        await self.pool.execute("UPDATE products SET has_variants=TRUE WHERE id=$1", p)
        await self.make_variant(p, stock_qty=9)
        await self.pool.execute("DELETE FROM products WHERE id=$1", p)
        self.assertEqual(
            await self.pool.fetchval(
                "SELECT count(*) FROM product_variants WHERE product_id=$1", p
            ),
            0,
        )

    async def test_variant_churn_does_not_touch_other_products(self):
        """The trigger must be scoped to the parent product, not the table."""
        a = await self.make_product(stock=2)
        b = await self.make_product(stock=13)
        await self.pool.execute("UPDATE products SET has_variants=TRUE WHERE id=$1", a)
        await self.make_variant(a, stock_qty=50)
        self.assertEqual(await self.stock_of(a), 50)
        self.assertEqual(await self.stock_of(b), 13)

    async def test_trigger_inactive_until_has_variants_is_set(self):
        """A product that has variant rows but has_variants=false is not yet
        in variant mode, so its stock stays author-controlled."""
        p = await self.make_product(stock=42)
        await self.make_variant(p, stock_qty=99)
        self.assertEqual(await self.stock_of(p), 42)

    # -- constraints ----------------------------------------------------

    async def test_only_one_default_variant_per_product(self):
        p = await self.make_product()
        await self.make_variant(p, is_default=True)
        with self.assertRaises(asyncpg.UniqueViolationError):
            await self.make_variant(p, is_default=True)

    async def test_sku_unique_within_product(self):
        p = await self.make_product()
        await self.make_variant(p, sku="SKU-1")
        with self.assertRaises(asyncpg.UniqueViolationError):
            await self.make_variant(p, sku="SKU-1")

    async def test_sku_may_repeat_across_products(self):
        a = await self.make_product()
        b = await self.make_product()
        await self.make_variant(a, sku="SHARED")
        await self.make_variant(b, sku="SHARED")  # must not raise

    async def test_multiple_null_skus_allowed(self):
        """A plain UNIQUE(sku) would reject this - SQL treats NULLs as equal
        for unique purposes only when the index is NOT NULL partial."""
        a = await self.make_product()
        b = await self.make_product()
        await self.make_variant(a, sku=None)
        await self.make_variant(b, sku=None)  # must not raise

    async def test_negative_stock_rejected(self):
        p = await self.make_product()
        with self.assertRaises(asyncpg.CheckViolationError):
            await self.make_variant(p, stock_qty=-1)

    async def test_compare_at_below_price_rejected(self):
        p = await self.make_product()
        with self.assertRaises(asyncpg.CheckViolationError):
            await self.pool.execute(
                """INSERT INTO product_variants (product_id, price, compare_at_price)
                   VALUES ($1, 100.00, 50.00)""",
                p,
            )

    async def test_null_price_is_allowed(self):
        """NULL means 'inherit the product price', so a size run can be added
        without re-pricing every row."""
        p = await self.make_product()
        v = await self.pool.fetchval(
            "INSERT INTO product_variants (product_id, price, stock_qty) "
            "VALUES ($1, NULL, 3) RETURNING id",
            p,
        )
        self.assertIsNotNone(v)


@unittest.skipUnless(
    TEST_DATABASE_URL, "TEST_DATABASE_URL not set; skipping supporting-table tests"
)
class SupportingTableTests(unittest.IsolatedAsyncioTestCase):
    """V8's password reset, banners, leads and refunds tables."""

    async def asyncSetUp(self):
        self.pool = await asyncpg.create_pool(
            dsn=TEST_DATABASE_URL, min_size=1, max_size=4
        )
        await self.pool.execute("TRUNCATE users, categories RESTART IDENTITY CASCADE")
        self.user_id = await self.pool.fetchval(
            "INSERT INTO users (name, email, password_hash, role) "
            "VALUES ($1,$2,'x','customer') RETURNING id",
            "Reset User",
            f"{uuid.uuid4().hex}@test.local",
        )

    async def asyncTearDown(self):
        await self.pool.close()

    # -- password reset -------------------------------------------------

    async def test_password_reset_token_round_trip(self):
        h = uuid.uuid4().hex
        tid = await self.pool.fetchval(
            "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) "
            "VALUES ($1,$2, now() + interval '1 hour') RETURNING id",
            self.user_id,
            h,
        )
        row = await self.pool.fetchrow(
            "SELECT used_at FROM password_reset_tokens WHERE id=$1", tid
        )
        self.assertIsNone(row["used_at"])

    async def test_password_reset_token_hash_is_unique(self):
        h = uuid.uuid4().hex
        await self.pool.execute(
            "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) "
            "VALUES ($1,$2, now() + interval '1 hour')",
            self.user_id,
            h,
        )
        with self.assertRaises(asyncpg.UniqueViolationError):
            await self.pool.execute(
                "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) "
                "VALUES ($1,$2, now() + interval '1 hour')",
                self.user_id,
                h,
            )

    async def test_token_expiring_in_the_past_is_rejected(self):
        """The CHECK is what stops a reset link that is already dead."""
        with self.assertRaises(asyncpg.CheckViolationError):
            await self.pool.execute(
                "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) "
                "VALUES ($1,$2, now() - interval '1 hour')",
                self.user_id,
                uuid.uuid4().hex,
            )

    async def test_token_deleted_with_user(self):
        await self.pool.execute(
            "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) "
            "VALUES ($1,$2, now() + interval '1 hour')",
            self.user_id,
            uuid.uuid4().hex,
        )
        await self.pool.execute("DELETE FROM users WHERE id=$1", self.user_id)
        self.assertEqual(
            await self.pool.fetchval("SELECT count(*) FROM password_reset_tokens"),
            0,
        )

    # -- banners --------------------------------------------------------

    async def test_banner_requires_known_placement(self):
        with self.assertRaises(asyncpg.CheckViolationError):
            await self.pool.execute(
                "INSERT INTO banners (title, url, placement) VALUES ('t','u','nowhere')"
            )

    async def test_banner_accepts_each_known_placement(self):
        for placement in (
            "homepage_hero",
            "homepage_strip",
            "category_top",
            "pdp_promo",
            "seller_page",
        ):
            with self.subTest(placement=placement):
                await self.pool.execute(
                    "INSERT INTO banners (title, url, placement) VALUES ($1,'u',$2)",
                    f"Banner {placement}",
                    placement,
                )

    async def test_banner_window_must_be_forward(self):
        with self.assertRaises(asyncpg.CheckViolationError):
            await self.pool.execute(
                "INSERT INTO banners (title, url, start_at, end_at) "
                "VALUES ('t','u', now(), now() - interval '1 day')"
            )

    async def test_banner_open_ended_window_allowed(self):
        """start_at with no end_at is the common 'runs until switched off' case."""
        await self.pool.execute(
            "INSERT INTO banners (title, url, start_at) VALUES ('t','u', now())"
        )

    async def test_banner_updated_at_trigger_fires(self):
        bid = await self.pool.fetchval(
            "INSERT INTO banners (title, url) VALUES ('t','u') RETURNING id"
        )
        before = await self.pool.fetchval(
            "SELECT updated_at FROM banners WHERE id=$1", bid
        )
        await asyncio_sleep()
        await self.pool.execute("UPDATE banners SET title='t2' WHERE id=$1", bid)
        after = await self.pool.fetchval(
            "SELECT updated_at FROM banners WHERE id=$1", bid
        )
        self.assertGreater(after, before)

    # -- leads ----------------------------------------------------------

    async def test_lead_requires_a_way_to_reply(self):
        with self.assertRaises(asyncpg.CheckViolationError):
            await self.pool.execute("INSERT INTO leads (message) VALUES ('hello')")

    async def test_lead_with_phone_only_is_accepted(self):
        await self.pool.execute("INSERT INTO leads (phone, message) VALUES ('+91...','hi')")

    async def test_lead_source_is_constrained(self):
        with self.assertRaises(asyncpg.CheckViolationError):
            await self.pool.execute(
                "INSERT INTO leads (email, source) VALUES ('a@b.c','carrier_pigeon')"
            )

    async def test_lead_defaults_to_new(self):
        lid = await self.pool.fetchval(
            "INSERT INTO leads (email) VALUES ('a@b.c') RETURNING id"
        )
        self.assertEqual(
            await self.pool.fetchval("SELECT status FROM leads WHERE id=$1", lid), "new"
        )


async def asyncio_sleep():
    """One clock tick, so a BEFORE UPDATE trigger's NOW() differs.

    Postgres NOW() is transaction-start time, and every statement here shares a
    transaction, so an UPDATE in the same transaction would see an identical
    timestamp. Sleeping lets the next statement start a new transaction.
    """
    import asyncio

    await asyncio.sleep(0.05)


if __name__ == "__main__":
    unittest.main()
