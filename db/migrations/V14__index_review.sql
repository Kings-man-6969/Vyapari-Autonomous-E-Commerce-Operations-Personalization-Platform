-- =============================================================================
-- V14 — the index review from real query plans (section J3)
--
-- Every claim below comes from `EXPLAIN (ANALYZE, BUFFERS)` against a database
-- holding 10,000 products, 60,000 interactions, 6,000 orders and a full month of
-- `product_stats_daily`, not from reading the queries and guessing. The plans
-- before and after are in the commit message.
--
-- Three of these are additions the plans asked for; four are deletions where the
-- plan showed one index doing another's job. A redundant index is not free: every
-- one of them is maintained on every insert, and `user_interactions` and
-- `order_items` are the two append-heaviest tables in the schema.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. The catalogue's default ordering. This is the single hottest query in the
--    storefront and it had no usable index.
--
--    `WHERE status = 'active' ORDER BY created_at DESC LIMIT 24` planned as a
--    sequential scan of all 10,000 rows followed by a top-N heapsort: 12.9 ms,
--    431 buffers, and every row of the table touched to return 24.
--
--    `idx_products_status` did not help, and that is the interesting part: 97% of
--    the table is `active`, so on selectivity alone the index loses to a scan and
--    the planner correctly ignores it. What makes the difference is not filtering
--    but *ordering* -- a composite `(status, created_at DESC)` lets the index
--    supply the sort, so it walks backwards from the newest row and stops after
--    24. The query stops being O(catalogue) and becomes O(page).
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_status_created
    ON products (status, created_at DESC);

-- ----------------------------------------------------------------------------
-- 2. Autocomplete.
--
-- This one is subtler than "a btree cannot serve a leading wildcard", and the
-- plans are worth recording because the first measurement was misleading.
--
-- `title ILIKE '%kettle%'` was 12.8 ms on a sequential scan before #1. After #1
-- it is 0.13 ms -- but *not* because of this index. `status = 'active' ORDER BY
-- created_at DESC LIMIT 6` now has an ordered index to walk, so for a term that
-- matches plenty of rows the planner walks newest-first and stops after six
-- candidates with 42 rejected. This index is not used for that at all, and adding
-- it purely on the strength of the common case would have been wrong.
--
-- The case that justifies it is the *uncommon* one. A term that matches nothing
-- cannot stop early, so the ordered scan walks every active row: measured at
-- 7.2 ms and 431 buffers, and it degrades linearly with the catalogue. The same
-- query through the trigram index is 0.39 ms and 24 buffers, and does not grow
-- with the catalogue.
--
-- So: the ordering index makes autocomplete fast for terms that hit, and this one
-- keeps it from being slow for terms that miss. Both are load-bearing.
--
-- Same conditional treatment as V12's lead search, for the same reason: a role
-- that cannot CREATE EXTENSION gets a working, slower autocomplete rather than a
-- migration that fails and blocks the deploy.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_trgm') THEN
        CREATE EXTENSION IF NOT EXISTS pg_trgm;
        CREATE INDEX IF NOT EXISTS idx_products_title_trgm
            ON products USING gin (title gin_trgm_ops);
    END IF;
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'pg_trgm not available; autocomplete falls back to a sequential scan';
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Redundant indexes the plan review found.
--
-- Each is covered by another index whose leading column is the same, so the
-- planner keeps using the surviving one and the dropped one only costs writes.
--
--   idx_products_status (status)
--     covered by idx_products_status_created (status, created_at DESC) from #1.
--
--   idx_orders_status (status)
--     covered by idx_orders_status_created (status, created_at DESC) from V10.
--
--   idx_orders_rzp_order (razorpay_order_id)
--     covered by idx_orders_razorpay_order, the partial index from V10. Every
--     query that filters on this column is an equality lookup -- the webhook
--     match, and a status read -- and an equality predicate lets the planner use
--     a `WHERE razorpay_order_id IS NOT NULL` partial index. The one query with
--     `IS NULL` in it filters by `id` first and never touches this index.
--
--   idx_interactions_product_time (product_id, created_at)
--     covered by idx_user_interactions_product (product_id, created_at DESC) from
--     V4. A btree reads in either direction, so the two are the same index with
--     the same leading column, and `user_interactions` is append-only.
--
-- `DROP INDEX IF EXISTS` rather than a conditional: the legacy `db/init.sql`
-- baseline creates three of these by the same names, so an environment that was
-- baselined rather than migrated needs the removal too, and IF EXISTS covers both.
-- ----------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_products_status;
DROP INDEX IF EXISTS idx_orders_status;
DROP INDEX IF EXISTS idx_orders_rzp_order;
DROP INDEX IF EXISTS idx_interactions_product_time;

-- The plan review reads these tables immediately after a migration in production,
-- too. Without stats the planner works from a default estimate that assumes a
-- much smaller table and can pick a plan it would not choose a second later.
ANALYZE products;
ANALYZE orders;
ANALYZE user_interactions;
ANALYZE product_stats_daily;
