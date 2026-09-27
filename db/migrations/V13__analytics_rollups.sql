-- =============================================================================
-- V13 — analytics: the indexes the rollups and the rankings need, and a record
--       of which days have been rolled up
--
-- Section I. `product_stats_daily` has existed since V1, is read by this
-- section's routes, and until now had never had a row written by any code.
-- `user_interactions` likewise had four writers and no reader.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. The rollup source
--
-- The daily rollup reads `user_interactions` by date. That had no index, so it
-- was a sequential scan of an append-only table that only grows.
--
-- The by-product index is not repeated here: V4 already created
-- `idx_user_interactions_product ON (product_id, created_at DESC)`, which is
-- exactly the shape a per-product range needs. Adding a second copy would be a
-- duplicate index on the hottest write path in the analytics pipeline.
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_user_interactions_created
    ON user_interactions (created_at DESC);

-- The rollup reads `order_items` by the *order's* date, and `order_items` has no
-- date of its own that means "when the sale happened" -- a line item's
-- `created_at` is when the cart line was written, which for a re-ordered cart can
-- predate the order by days. So the join is on `orders.created_at` and this is
-- the index that makes it a range scan rather than a full sort.
CREATE INDEX IF NOT EXISTS idx_order_items_product
    ON order_items (product_id);

-- ----------------------------------------------------------------------------
-- 2. The rankings
--
-- `product_stats_daily`'s primary key is (product_id, stat_date, region), which
-- is the upsert target the rollup needs and which serves the per-product
-- performance query. It is useless for the two storefront rankings, because both
-- start from a *date range* and group by product -- and the primary key leads
-- with product_id, so there is nothing to range-scan on.
--
-- One index, not two: both rankings are the same range over the same grouping and
-- differ only in which column they order by, so a second index with the ordering
-- swapped would duplicate the whole structure to save a sort of a few thousand
-- rows. The INCLUDE columns make it covering, so the aggregate is answered from
-- the index and never touches the heap.
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_product_stats_window
    ON product_stats_daily (stat_date DESC, product_id)
    INCLUDE (views, clicks, purchases, revenue);

-- ----------------------------------------------------------------------------
-- 3. Rollup bookkeeping
--
-- The rollup is idempotent by construction -- it recomputes a day from source
-- and upserts -- so this table is not what makes it safe to re-run. It is what
-- makes it *observable*: without it, "the best-sellers list is empty" and "the
-- rollup has not run for nine days" look identical from the outside, and the
-- second one is a silent failure that no metric catches.
--
-- One row per day, written on completion, `rows_written` included. A day that
-- was attempted and failed is recorded too, with the error, because a gap in
-- this table is the only evidence that the job stopped.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics_rollup_runs (
    stat_date     DATE PRIMARY KEY,
    rows_written  INTEGER NOT NULL DEFAULT 0,
    started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at   TIMESTAMPTZ,
    error         TEXT
);

-- ----------------------------------------------------------------------------
-- 4. Seed the rollup window from what already exists
--
-- `user_interactions` and `orders` have real rows in an environment that has
-- been running, and the storefront's best-sellers list is empty until a rollup
-- covers them. Rather than make an operator remember to call the backfill, the
-- migration does one pass over the last 30 days. It is the same statement the
-- route runs, expressed once: recompute a day from source and upsert.
--
-- `region` is 'global' throughout. The column exists from V1 and nothing in the
-- platform produces a per-region figure -- inventing one from the buyer's city
-- would be a number with no definition behind it.
-- ----------------------------------------------------------------------------
-- The paid states, copied from the `orders.status` CHECK constraint in V1.
-- There is no `created` or `pending_payment` here -- an unpaid order is
-- `pending` -- and no `refunded`, because a refund is a row in `refunds` against
-- a payment that stays `paid`. An unknown value in this list would not fail: it
-- would simply match nothing and make the revenue figure quietly low.
WITH interaction_rollup AS (
    SELECT product_id,
           created_at::date AS stat_date,
           COUNT(*) FILTER (WHERE event_type = 'view')                             AS views,
           COUNT(*) FILTER (WHERE event_type = 'click')                            AS clicks,
           0                                                                       AS purchases,
           0::numeric                                                              AS revenue
      FROM user_interactions
     WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
       AND event_type IN ('view', 'click')
     GROUP BY product_id, created_at::date
),
sales_rollup AS (
    SELECT oi.product_id,
           o.created_at::date AS stat_date,
           0                                               AS views,
           0                                               AS clicks,
           SUM(oi.quantity)                                AS purchases,
           SUM(oi.quantity * oi.price_at_purchase)         AS revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
     WHERE o.created_at >= CURRENT_DATE - INTERVAL '30 days'
       AND o.status IN ('paid', 'processing', 'shipped', 'out_for_delivery', 'delivered')
       AND oi.product_id IS NOT NULL
     GROUP BY oi.product_id, o.created_at::date
),
merged AS (
    SELECT * FROM interaction_rollup
    UNION ALL
    SELECT * FROM sales_rollup
),
summed AS (
    SELECT product_id, stat_date, SUM(views) AS views, SUM(clicks) AS clicks,
           SUM(purchases) AS purchases, SUM(revenue) AS revenue
      FROM merged
     GROUP BY product_id, stat_date
)
INSERT INTO product_stats_daily (product_id, stat_date, region, views, clicks, purchases, revenue)
SELECT product_id, stat_date, 'global', views, clicks, purchases, revenue FROM summed
ON CONFLICT (product_id, stat_date, region) DO UPDATE
    SET views = EXCLUDED.views,
        clicks = EXCLUDED.clicks,
        purchases = EXCLUDED.purchases,
        revenue = EXCLUDED.revenue;

-- Record the seed, with the real row count per day. A blanket `rows_written = 0`
-- for the whole window would be a lie about the days that did have activity, and
-- the first thing anyone reads this table for is whether a day is missing.
INSERT INTO analytics_rollup_runs (stat_date, rows_written, started_at, finished_at)
SELECT stat_date, COUNT(*), NOW(), NOW()
  FROM product_stats_daily
 WHERE stat_date >= CURRENT_DATE - INTERVAL '30 days'
 GROUP BY stat_date
ON CONFLICT (stat_date) DO NOTHING;

-- Then the days that genuinely had nothing, so the window has no gaps and the
-- staleness check does not report a quiet day as a missing run.
INSERT INTO analytics_rollup_runs (stat_date, rows_written, started_at, finished_at)
SELECT d::date, 0, NOW(), NOW()
  FROM generate_series(CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE, INTERVAL '1 day') AS d
ON CONFLICT (stat_date) DO NOTHING;
