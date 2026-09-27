"""
Index review — J3's schema decisions, as assertions.

The point of this file is that both halves of V14 can silently regress:

  * A future migration that drops or renames `idx_products_status_created` would
    put the storefront's hottest query back on a sequential scan and a top-N
    heapsort. Nothing else in the suite would notice -- the answers stay correct,
    only the cost changes, and a test suite does not measure cost.
  * A future migration that *re-adds* `idx_orders_status` (it is a natural thing
    to reach for) would restore an index that the composite from V10 already
    covers, on the schema's append-heaviest table. Also invisible.

So the assertions run in both directions.

Skipped unless TEST_DATABASE_URL is set.

    TEST_DATABASE_URL=postgresql://... python -m pytest tests/test_index_review.py -v
"""
import os
import unittest

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "").strip()

#: Indexes V14 creates, and why each one has to exist.
REQUIRED = {
    # The catalogue's default ordering: `WHERE status='active' ORDER BY
    # created_at DESC LIMIT 24`. Measured 12.9 ms -> 0.35 ms at 10,000 products.
    "idx_products_status_created",
    # Keeps autocomplete from walking the whole active set when the term matches
    # little or nothing. Measured 7.2 ms -> 0.39 ms for a term that matches none.
    "idx_products_title_trgm",
}

#: Indexes V14 removes, because another index has the same leading column and the
#: planner keeps using that one. Each is maintained on every write.
REDUNDANT = {
    "idx_products_status",             # covered by idx_products_status_created
    "idx_orders_status",               # covered by idx_orders_status_created
    "idx_orders_rzp_order",            # covered by idx_orders_razorpay_order (partial)
    "idx_interactions_product_time",   # covered by idx_user_interactions_product
}


@unittest.skipUnless(TEST_DATABASE_URL, "TEST_DATABASE_URL not set; skipping index tests")
class IndexReviewTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        import asyncpg

        self.pool = await asyncpg.create_pool(dsn=TEST_DATABASE_URL, min_size=1, max_size=2)

    async def asyncTearDown(self):
        await self.pool.close()

    async def _indexes(self) -> set:
        rows = await self.pool.fetch("SELECT indexname FROM pg_indexes")
        return {r["indexname"] for r in rows}

    async def test_the_indexes_the_plan_review_added_are_present(self):
        present = await self._indexes()
        for name in sorted(REQUIRED):
            self.assertIn(
                name,
                present,
                f"{name} is missing. Without it the query it exists for is back on a "
                f"sequential scan -- see V14's comments for the measured plan.",
            )

    async def test_the_redundant_indexes_are_gone(self):
        present = await self._indexes()
        for name in sorted(REDUNDANT):
            self.assertNotIn(
                name,
                present,
                f"{name} was dropped by V14 as redundant and has been re-added. "
                f"Another index already covers its leading column, so it only costs writes.",
            )

    async def test_the_catalogue_ordering_index_leds_with_status_then_created_at(self):
        """
        The column order is the whole point. `(created_at DESC, status)` would not
        serve `WHERE status = 'active' ORDER BY created_at DESC`: the ordering
        index only supplies the sort when the equality column comes first.
        """
        definition = await self.pool.fetchval(
            "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_products_status_created'"
        )
        self.assertIsNotNone(definition)
        self.assertIn("(status", definition)
        self.assertIn("created_at DESC", definition)
        self.assertLess(
            definition.index("(status"),
            definition.index("created_at DESC"),
            "status must lead: the index cannot supply the ORDER BY otherwise",
        )

    async def test_the_trigram_index_is_a_gin_index_on_title(self):
        definition = await self.pool.fetchval(
            "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_products_title_trgm'"
        )
        self.assertIsNotNone(definition)
        self.assertIn("USING gin", definition)
        self.assertIn("title", definition)


if __name__ == "__main__":
    unittest.main()
