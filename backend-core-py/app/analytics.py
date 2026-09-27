"""
Analytics rollups — section I1.

`product_stats_daily` has existed since V1 and had never had a row written by any
code. This is the writer.

The shape of the design, and why:

  * **A recomputation, not a counter.** The obvious alternative is to `+1` a row
    on every view. That couples the hot read path to analytics, and it makes the
    number unrecoverable: a double-fire from a React effect, a retried request, a
    replay from a queue, and the view count is wrong forever with nothing to
    recompute it from. Recomputing a day from source is idempotent, so re-running
    it is free and a gap can be backfilled by running it again.

  * **A day at a time.** The unit of work is one calendar date, because that is
    the unit of the destination table. A window is a loop over days, so the
    backfill route, the startup catch-up and the periodic sweep are all the same
    function.

  * **Failures are recorded, not swallowed.** A rollup that has silently not run
    for nine days looks exactly like a rollup whose window has no activity. The
    run log is the only thing that tells them apart, so a failed day is written
    with its error and the exception is re-raised.

  * **`purchases` is units, not orders.** Summing `order_items.quantity` is what a
    "best selling" list means to a merchant. Counting rows counts a five-unit
    order as one sale, and the two rankings then disagree with the revenue figure
    sitting beside them.

Timezone: everything is bucketed on `::date` in the database's timezone, and the
platform is India-only, so that is Asia/Kolkata in practice. The column is a
`DATE` and V1 gave it no timezone, so a per-row timezone is not something this
table could express -- worth knowing if the platform ever spans one.
"""
import logging
from datetime import date, timedelta

logger = logging.getLogger("vyapari-analytics")

#: Order states that represent money actually taken. Mirrors the `orders.status`
#: CHECK constraint in V1: there is no `created` or `pending_payment` here -- an
#: unpaid order is `pending` -- and no `refunded`, because a refund is a row in
#: `refunds` against a payment that stays `paid`.
#:
#: Getting this list wrong is not a crash: an unknown value in an `= ANY()`
#: filter simply matches nothing, so a typo would make the revenue figure *low*
#: rather than obviously broken. Which is why it is mirrored from the migration
#: and not written from memory.
PAID_ORDER_STATUSES = (
    "paid",
    "processing",
    "shipped",
    "out_for_delivery",
    "delivered",
)

#: Default window for the rankings. Long enough that a weekend does not empty the
#: list, short enough that a product trending today is not buried under one that
#: sold well a quarter ago.
DEFAULT_WINDOW_DAYS = 30

#: How far back the periodic sweep will reach. Bounded because a fresh database
#: has no history to recompute, and an unbounded catch-up on first boot would
#: walk the table for every day since V1.
MAX_BACKFILL_DAYS = 90


# One day, recomputed from source and upserted.
#
# Reads interactions for views and clicks and order lines for purchases and
# revenue, merges the two by product, and upserts. The merge is a UNION ALL then
# a SUM, not two separate upserts, because a product with both a view and a sale
# must end up with one row carrying both: two statements would see the second
# upsert's `DO UPDATE` clobber the first statement's columns unless each one
# carefully named only its own, which is a rule that is easy to break later.
DAY_ROLLUP_SQL = """
WITH interaction_rollup AS (
    SELECT product_id,
           $1::date AS stat_date,
           COUNT(*) FILTER (WHERE event_type = 'view')  AS views,
           COUNT(*) FILTER (WHERE event_type = 'click') AS clicks,
           0            AS purchases,
           0::numeric   AS revenue
      FROM user_interactions
     WHERE created_at >= $1::date
       AND created_at <  $1::date + INTERVAL '1 day'
       AND event_type IN ('view', 'click')
     GROUP BY product_id
),
sales_rollup AS (
    SELECT oi.product_id,
           $1::date AS stat_date,
           0                        AS views,
           0                        AS clicks,
           SUM(oi.quantity)         AS purchases,
           SUM(oi.quantity * oi.price_at_purchase) AS revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
     WHERE o.created_at >= $1::date
       AND o.created_at <  $1::date + INTERVAL '1 day'
       AND o.status = ANY($2::text[])
       AND oi.product_id IS NOT NULL
     GROUP BY oi.product_id
),
merged AS (
    SELECT * FROM interaction_rollup
    UNION ALL
    SELECT * FROM sales_rollup
),
summed AS (
    SELECT product_id, stat_date,
           SUM(views) AS views, SUM(clicks) AS clicks,
           SUM(purchases) AS purchases, SUM(revenue) AS revenue
      FROM merged
     GROUP BY product_id, stat_date
)
INSERT INTO product_stats_daily
        (product_id, stat_date, region, views, clicks, purchases, revenue)
SELECT product_id, stat_date, 'global', views, clicks, purchases, revenue
  FROM summed
ON CONFLICT (product_id, stat_date, region) DO UPDATE
   SET views     = EXCLUDED.views,
       clicks    = EXCLUDED.clicks,
       purchases = EXCLUDED.purchases,
       revenue   = EXCLUDED.revenue
RETURNING product_id
"""


async def rollup_day(db, day: date) -> int:
    """
    Recompute one day. Returns the number of product rows written.

    Idempotent: running it twice for the same day produces the same table. A
    failed run is recorded in `analytics_rollup_runs` and re-raised -- the
    failure record is written *outside* the transaction it is reporting on, since
    a record written inside would be rolled back along with the thing that
    failed, which is the one case where the log matters most.
    """
    try:
        async with db.transaction():
            rows = await db.fetch(DAY_ROLLUP_SQL, day, list(PAID_ORDER_STATUSES))
            written = len(rows)
    except Exception as exc:
        await _record_run(db, day, None, _short(exc))
        raise

    await _record_run(db, day, written, None)
    return written


async def _record_run(db, day: date, written, error):
    await db.execute(
        """
        INSERT INTO analytics_rollup_runs (stat_date, rows_written, started_at, finished_at, error)
        VALUES ($1::date, COALESCE($2, 0), NOW(), NOW(), $3)
        ON CONFLICT (stat_date) DO UPDATE
           SET rows_written = COALESCE($2, analytics_rollup_runs.rows_written),
               finished_at  = NOW(),
               error        = $3
        """,
        day,
        written,
        error,
    )


def _short(exc) -> str:
    text = str(exc) or exc.__class__.__name__
    return text[:500]


async def rollup_window(db, days: int = DEFAULT_WINDOW_DAYS, end: date | None = None) -> dict:
    """
    Recompute a window of days, most recent first.

    Most recent first because that is the order the results matter in: if the
    process is interrupted, the days a visitor can actually see are the ones that
    finished. A failure on one day does not abandon the rest -- a single bad day
    is not a reason to leave the week unrolled -- so the loop collects errors and
    keeps going.
    """
    if days < 1:
        raise ValueError("days must be >= 1")
    if days > MAX_BACKFILL_DAYS:
        raise ValueError(f"days must be <= {MAX_BACKFILL_DAYS}")

    end = end or date.today()
    days_written: list[dict] = []
    errors: list[dict] = []

    for offset in range(days):
        day = end - timedelta(days=offset)
        try:
            written = await rollup_day(db, day)
            days_written.append({"date": day.isoformat(), "rows": written})
        except Exception as exc:  # noqa: BLE001 - one bad day must not stop the rest
            logger.warning(f"Rollup failed for {day}: {exc}")
            errors.append({"date": day.isoformat(), "error": _short(exc)})

    return {
        "days": days_written,
        "errors": errors,
        "from": (end - timedelta(days=days - 1)).isoformat(),
        "to": end.isoformat(),
    }


async def missing_days(db, days: int = DEFAULT_WINDOW_DAYS, end: date | None = None) -> list[date]:
    """
    Days in the window with no successful run.

    This is what the periodic sweep acts on, and it is deliberately driven by the
    run log rather than by "did the last tick succeed" -- a process that was down
    for two days comes back and fills both, instead of only the day it woke up on.
    """
    end = end or date.today()
    start = end - timedelta(days=days - 1)

    rows = await db.fetch(
        """
        SELECT d::date AS day
          FROM generate_series($1::date, $2::date, INTERVAL '1 day') AS d
         WHERE NOT EXISTS (
                 SELECT 1 FROM analytics_rollup_runs r
                  WHERE r.stat_date = d::date AND r.error IS NULL
               )
         ORDER BY d DESC
        """,
        start,
        end,
    )
    return [r["day"] for r in rows]


async def rollup_status(db) -> dict:
    """
    The freshness of the rollup, for the admin screen.

    Without this, "the best-sellers list is empty" and "the job has not run for
    nine days" are indistinguishable from outside, and the second one is a silent
    failure no metric catches.
    """
    row = await db.fetchrow(
        """
        SELECT
          (SELECT MAX(stat_date) FROM analytics_rollup_runs WHERE error IS NULL) AS last_day,
          (SELECT MAX(finished_at) FROM analytics_rollup_runs WHERE error IS NULL) AS last_finished_at,
          (SELECT COUNT(*) FROM analytics_rollup_runs WHERE error IS NOT NULL) AS failed_runs,
          (SELECT COUNT(*) FROM product_stats_daily) AS stat_rows
        """
    )
    last_day = row["last_day"]
    today = date.today()
    return {
        "last_rolled_up_day": last_day.isoformat() if last_day else None,
        "last_finished_at": row["last_finished_at"].isoformat() if row["last_finished_at"] else None,
        # A rollup for today is only meaningful after today ends, so "current"
        # means yesterday is present. A same-day rollup is a partial figure.
        "stale_days": (today - last_day).days if last_day else None,
        "failed_runs": int(row["failed_runs"] or 0),
        "stat_rows": int(row["stat_rows"] or 0),
    }
