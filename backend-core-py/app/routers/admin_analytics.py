"""
Analytics — I4 (product performance) and I5 (sales over time), plus the rollup
trigger and its freshness.

Every query here is bounded by an explicit day window with a default, because the
alternative is a dashboard that gets slower every day the platform runs and
eventually times out on the one day someone needs it.

Two things this router is careful about:

  * **A day with no activity is a row of zeroes, not a missing row.** A trend
    chart with holes in it draws a straight line across the gap, which is exactly
    the wrong story for a day the shop was closed. `generate_series` supplies
    every date; the aggregate LEFT JOINs onto it.

  * **Conversion is `purchases / views`, and it is `null` when there are no
    views.** Not `0`, and not `1`. A product nobody looked at has no conversion
    rate, and reporting one as 0% puts it at the bottom of a list it should not
    be on at all.
"""
import math
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.analytics import (
    DEFAULT_WINDOW_DAYS,
    MAX_BACKFILL_DAYS,
    PAID_ORDER_STATUSES,
    missing_days,
    rollup_status,
    rollup_window,
)
from app.auth.dependencies import require_role
from app.db import get_db
from app.utils import require_valid_uuid_param

router = APIRouter(tags=["admin-analytics"])
_admin_guard = Depends(require_role("admin"))

#: What the product table can be ranked by. Anything else is a 400 rather than
#: an ignored parameter -- a silently ignored `sort` gives the caller the default
#: ordering and no indication that they asked for something else.
PRODUCT_SORTS = {
    "views": "views DESC",
    "clicks": "clicks DESC",
    "purchases": "purchases DESC",
    "revenue": "revenue DESC",
    "conversion": "conversion_pct DESC NULLS LAST",
}


class RollupBody(BaseModel):
    days: int = Field(default=30, ge=1, le=MAX_BACKFILL_DAYS)


def _window(days: int) -> tuple[date, date, date]:
    """(window start, previous-window start, today). Both windows are `days` long."""
    today = date.today()
    start = today - timedelta(days=days - 1)
    prev_start = start - timedelta(days=days)
    return start, prev_start, today


# ----------------------------------------------------------------------------
# I5. Sales over time
# ----------------------------------------------------------------------------
@router.get("/analytics/sales")
async def sales_analytics(
    days: int = Query(DEFAULT_WINDOW_DAYS, ge=1, le=365),
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> dict:
    """
    Orders, revenue, AOV and refunds, bucketed by day.

    Revenue counts **paid** orders only. A `created` or `pending_payment` order
    has never been paid, and including it is precisely the bug the old
    `/admin/metrics` had: it summed `total_amount` for every order whose status
    was not `cancelled`, so the dashboard's headline figure included every
    abandoned checkout.
    """
    start, prev_start, today = _window(days)

    rows = await db.fetch(
        """
        WITH span AS (
            SELECT d::date AS day
              FROM generate_series($1::date, $2::date, INTERVAL '1 day') AS d
        ),
        orders_daily AS (
            SELECT created_at::date AS day,
                   COUNT(*)                                                     AS orders_all,
                   COUNT(*)   FILTER (WHERE status = ANY($3::text[]))            AS orders_paid,
                   COALESCE(SUM(total_amount) FILTER (WHERE status = ANY($3::text[])), 0) AS revenue
              FROM orders
             WHERE created_at >= $1::date
               AND created_at <  $2::date + INTERVAL '1 day'
             GROUP BY created_at::date
        ),
        refunds_daily AS (
            -- Processed money is out of the account; requested money is not yet
            -- gone. Reporting them as one number overstates what has been repaid.
            SELECT processed_at::date AS day,
                   COALESCE(SUM(amount) FILTER (WHERE status = 'processed'), 0) AS refunded,
                   COALESCE(SUM(amount) FILTER (WHERE status IN ('requested', 'approved', 'processing')), 0) AS refund_pending
              FROM refunds
             WHERE processed_at >= $1::date
               AND processed_at <  $2::date + INTERVAL '1 day'
             GROUP BY processed_at::date
        )
        SELECT span.day,
               COALESCE(o.orders_all, 0)      AS orders_all,
               COALESCE(o.orders_paid, 0)     AS orders_paid,
               COALESCE(o.revenue, 0)         AS revenue,
               COALESCE(r.refunded, 0)        AS refunded,
               COALESCE(r.refund_pending, 0)  AS refund_pending
          FROM span
          LEFT JOIN orders_daily  o ON o.day = span.day
          LEFT JOIN refunds_daily r ON r.day = span.day
         ORDER BY span.day
        """,
        start,
        today,
        list(PAID_ORDER_STATUSES),
    )

    series = []
    for r in rows:
        revenue = float(r["revenue"] or 0)
        refunded = float(r["refunded"] or 0)
        paid = int(r["orders_paid"] or 0)
        series.append(
            {
                "date": r["day"].isoformat(),
                "orders": int(r["orders_all"] or 0),
                "paid_orders": paid,
                "revenue": round(revenue, 2),
                "refunds": round(refunded, 2),
                "refunds_pending": round(float(r["refund_pending"] or 0), 2),
                "net_revenue": round(revenue - refunded, 2),
                # AOV is per *paid* order. Dividing by every order would make the
                # figure drop whenever someone abandons a checkout, which is the
                # opposite of what an average order value is for.
                "aov": round(revenue / paid, 2) if paid else None,
            }
        )

    totals = {
        "orders": sum(d["orders"] for d in series),
        "paid_orders": sum(d["paid_orders"] for d in series),
        "revenue": round(sum(d["revenue"] for d in series), 2),
        "refunds": round(sum(d["refunds"] for d in series), 2),
        "refunds_pending": round(sum(d["refunds_pending"] for d in series), 2),
    }
    totals["net_revenue"] = round(totals["revenue"] - totals["refunds"], 2)
    totals["aov"] = (
        round(totals["revenue"] / totals["paid_orders"], 2) if totals["paid_orders"] else None
    )
    totals["conversion_rate"] = (
        round(totals["paid_orders"] / totals["orders"], 4) if totals["orders"] else None
    )

    # The previous window, so the screen can say "up 12% on the last 30 days"
    # rather than showing a number with nothing to compare it to.
    previous = await db.fetchrow(
        """
        SELECT COUNT(*) FILTER (WHERE status = ANY($3::text[])) AS paid_orders,
               COALESCE(SUM(total_amount) FILTER (WHERE status = ANY($3::text[])), 0) AS revenue
          FROM orders
         WHERE created_at >= $1::date AND created_at < $2::date
        """,
        prev_start,
        start,
        list(PAID_ORDER_STATUSES),
    )
    prev_revenue = float(previous["revenue"] or 0)

    return {
        "success": True,
        "data": {
            "from": start.isoformat(),
            "to": today.isoformat(),
            "days": days,
            "series": series,
            "totals": totals,
            "previous": {
                "from": prev_start.isoformat(),
                "to": (start - timedelta(days=1)).isoformat(),
                "paid_orders": int(previous["paid_orders"] or 0),
                "revenue": round(prev_revenue, 2),
            },
            "revenue_change_pct": _pct_change(prev_revenue, totals["revenue"]),
        },
    }


# ----------------------------------------------------------------------------
# I4. Product performance
# ----------------------------------------------------------------------------
@router.get("/analytics/products")
async def product_performance(
    days: int = Query(DEFAULT_WINDOW_DAYS, ge=1, le=365),
    sort: str = Query("views"),
    seller_id: Optional[str] = Query(None),
    include_zero: bool = Query(False),
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> dict:
    """
    Per-product views, clicks, units sold, revenue, conversion, and the change
    against the previous window.

    `sort=conversion` puts products with no views last, not first: a product with
    one view and one purchase is a 100% conversion rate, and ranking it above a
    product with ten thousand views would be the wrong answer to the question
    anyone asking about conversion actually has.
    """
    if sort not in PRODUCT_SORTS:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "UNKNOWN_SORT",
                "message": f"Unknown sort '{sort}'.",
                "data": {"allowed": sorted(PRODUCT_SORTS)},
            },
        )

    start, prev_start, today = _window(days)

    params: list = [prev_start, start, today]
    filters = ["p.status <> 'archived'"]
    if seller_id:
        params.append(require_valid_uuid_param(seller_id, "seller_id"))
        filters.append(f"p.seller_id = ${len(params)}::uuid")

    having = ""
    if not include_zero:
        # Products with nothing at all in either window are noise on a
        # performance screen. `include_zero=true` is there for the opposite
        # question: "which listing has had no engagement".
        having = "HAVING COALESCE(SUM(s.views), 0) > 0 OR COALESCE(SUM(s.purchases), 0) > 0"

    params.extend([limit, offset])

    rows = await db.fetch(
        f"""
        SELECT p.id, p.title, p.slug, p.price, p.stock_qty, p.status,
               COALESCE(SUM(s.views)     FILTER (WHERE s.stat_date >= $2::date), 0) AS views,
               COALESCE(SUM(s.clicks)    FILTER (WHERE s.stat_date >= $2::date), 0) AS clicks,
               COALESCE(SUM(s.purchases) FILTER (WHERE s.stat_date >= $2::date), 0) AS purchases,
               COALESCE(SUM(s.revenue)   FILTER (WHERE s.stat_date >= $2::date), 0) AS revenue,
               COALESCE(SUM(s.views)     FILTER (WHERE s.stat_date <  $2::date), 0) AS prev_views,
               COALESCE(SUM(s.purchases) FILTER (WHERE s.stat_date <  $2::date), 0) AS prev_purchases,
               COALESCE(SUM(s.revenue)   FILTER (WHERE s.stat_date <  $2::date), 0) AS prev_revenue
          FROM products p
          LEFT JOIN product_stats_daily s
                 ON s.product_id = p.id
                AND s.stat_date >= $1::date
                AND s.stat_date <= $3::date
         WHERE {' AND '.join(filters)}
         GROUP BY p.id
         {having}
         ORDER BY {PRODUCT_SORTS[sort]}, p.title
         LIMIT ${len(params) - 1} OFFSET ${len(params)}
        """,
        *params,
    )

    products = []
    for r in rows:
        views = int(r["views"] or 0)
        purchases = int(r["purchases"] or 0)
        revenue = float(r["revenue"] or 0)
        prev_revenue = float(r["prev_revenue"] or 0)
        products.append(
            {
                "id": str(r["id"]),
                "title": r["title"],
                "slug": r["slug"],
                "price": float(r["price"] or 0),
                "stock_qty": int(r["stock_qty"] or 0),
                "status": r["status"],
                "views": views,
                "clicks": int(r["clicks"] or 0),
                "purchases": purchases,
                "revenue": round(revenue, 2),
                # null, not 0: no views means no rate, and a 0% would rank a
                # product nobody has seen alongside one that genuinely converts
                # badly.
                "conversion_pct": round(purchases / views * 100, 2) if views else None,
                "previous": {
                    "views": int(r["prev_views"] or 0),
                    "purchases": int(r["prev_purchases"] or 0),
                    "revenue": round(prev_revenue, 2),
                },
                "revenue_change_pct": _pct_change(prev_revenue, revenue),
            }
        )

    return {
        "success": True,
        "data": products,
        "window": {"from": start.isoformat(), "to": today.isoformat(), "days": days},
        "sort": sort,
    }


# ----------------------------------------------------------------------------
# I1. The rollup, driven by hand
# ----------------------------------------------------------------------------
@router.get("/analytics/rollup")
async def get_rollup_status(user: dict = _admin_guard, db=Depends(get_db)) -> dict:
    """
    Freshness of `product_stats_daily`, plus the days still missing from the
    window. Without this, an empty best-sellers list and a job that stopped nine
    days ago look identical.
    """
    status = await rollup_status(db)
    status["missing_days"] = [
        d.isoformat() for d in await missing_days(db, DEFAULT_WINDOW_DAYS)
    ]
    return {"success": True, "data": status}


@router.post("/analytics/rollup")
async def run_rollup(
    body: RollupBody,
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> dict:
    """
    Recompute a window by hand.

    Safe to call repeatedly -- a day is recomputed from source and upserted, so
    the result is the same whether this is the first run or the fiftieth. That is
    what makes a backfill after a quiet period a button rather than an incident.
    """
    result = await rollup_window(db, body.days)
    return {
        "success": True,
        "message": (
            f"Rolled up {len(result['days'])} day(s)"
            + (f", {len(result['errors'])} failed." if result["errors"] else ".")
        ),
        "data": result,
    }


def _pct_change(previous: float, current: float):
    """Percent change, or None when there is no baseline to compare against.

    Returning 0 for "was zero, is now something" makes a product's first sale look
    like no change at all, which is the one case where the number is most
    interesting.
    """
    if not previous:
        return None
    change = (current - previous) / previous * 100
    if math.isnan(change) or math.isinf(change):
        return None
    return round(change, 2)
