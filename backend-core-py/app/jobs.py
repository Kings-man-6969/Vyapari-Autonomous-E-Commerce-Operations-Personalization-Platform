"""
Background work the app does on a timer.

One job, because there is one job: expiring orders that were never paid.

Why it has to exist
-------------------
POST /api/orders decrements stock immediately, under a row lock, before a rupee
has moved. That is deliberate -- the alternative is a customer who pays for a
size that was sold to someone else while the gateway was deciding -- but it means
the stock is held by an *intent*, not by a purchase. An order abandoned at the
gateway's own 3-D Secure step, or on a closed laptop, or by a customer who simply
changed their mind at the last field, leaves that stock unsellable. And because
nothing anywhere else incremented it back, it stayed that way for the lifetime of
the order row, which is forever.

The sweep is the counterpart to the decrement, and it is the only thing that calls
restore_stock for an unpaid order.

Why not a scheduler library
---------------------------
Because the query is already safe to run concurrently. It takes rows with FOR
UPDATE SKIP LOCKED, so N workers (or N containers during a deploy overlap) each
get a disjoint set of orders and none of them blocks on another. The work is
therefore done exactly once regardless of how many processes are running, which is
the property a scheduler would have been bought for. What is left is a loop, and
a loop with a sleep in it is not worth a dependency.

RUN_ORDER_SWEEP turns it off, which the test suite does -- a background loop
writing to the same rows a test is asserting on is a race nobody wants to debug.

The second job is the analytics rollup (section I1), and it shares that property
for the same reason: it recomputes a day from source rather than counting up, so
two workers racing on the same day produce the same table rather than a
double-count. See app/analytics.py.
"""
import asyncio
import logging

from app.config import settings
from app.db import get_pool

logger = logging.getLogger("vyapari-jobs")


async def sweep_abandoned_orders(limit: int = 200) -> dict:
    """
    Expires unpaid orders past their window and returns their stock.

    Returns a small report rather than None, so the loop can log what it did and
    a test can assert on it. `{"expired": 0}` is a normal, healthy result and the
    log says so at debug level rather than staying silent forever.
    """
    # Imported here rather than at module scope: restore_stock lives in the
    # payments router, which imports this module's dependencies. A function-level
    # import keeps app.jobs importable on its own -- which is what lets main.py's
    # lifespan start the loop without a cycle through main.
    from app.routers.payments import restore_stock

    pool = get_pool()
    expired: list[str] = []
    released = 0

    async with pool.acquire() as conn:
        # One transaction for the whole batch. The row locks are taken here, so
        # nothing between the SELECT and the UPDATE can see a half-swept batch,
        # and the whole batch is one durable fact rather than N.
        async with conn.transaction():
            candidates = await conn.fetch(
                """SELECT id FROM orders
                    WHERE status = 'pending'
                      AND expires_at IS NOT NULL
                      AND expires_at < NOW()
                    ORDER BY expires_at
                    LIMIT $1
                    FOR UPDATE SKIP LOCKED""",
                limit,
            )

            for row in candidates:
                # The guard is the SELECT's WHERE clause repeated on the UPDATE.
                # Between the two, confirm-payment could have paid the order -- and
                # a customer who paid must not have their stock restored out from
                # under them, which would sell the same unit twice.
                moved = await conn.fetchval(
                    """UPDATE orders
                          SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
                        WHERE id = $1::uuid AND status = 'pending'
                      RETURNING id""",
                    row["id"],
                )
                if not moved:
                    continue

                await conn.execute(
                    """INSERT INTO order_status_history (order_id, status, note)
                       VALUES ($1::uuid, 'cancelled', 'Expired: not paid within the payment window')""",
                    row["id"],
                )
                await conn.execute(
                    "UPDATE payments SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP "
                    "WHERE order_id = $1::uuid AND status IN ('created', 'pending_verification')",
                    row["id"],
                )
                await restore_stock(conn, row["id"])
                expired.append(str(row["id"]))
                released += 1

    if expired:
        logger.info("Swept %d abandoned order(s), stock returned", released)
    else:
        logger.debug("Sweep found no abandoned orders")

    return {"expired": released, "order_ids": expired}


async def order_sweep_loop() -> None:
    """
    Runs the sweep forever, with the first run one interval in.

    Delayed rather than immediate: a process that has just started has a database
    connection it has not yet used, and a sweep at t=0 is a cold query against a
    pool that is still warming. The delay also keeps tests that forget to set
    RUN_ORDER_SWEEP from racing a cold connection.
    """
    interval = max(30, int(settings.ORDER_SWEEP_INTERVAL_SECONDS))
    logger.info("Abandoned-order sweep running every %ds", interval)
    while True:
        try:
            await asyncio.sleep(interval)
            await sweep_abandoned_orders()
        except asyncio.CancelledError:
            # Shutdown, not a failure. Re-raised so the task ends cancelled
            # rather than looking like it finished its work.
            logger.info("Abandoned-order sweep stopping")
            raise
        except Exception:
            # One bad sweep must not kill the loop and silently stop the sweep
            # for the rest of the process's life -- which is the failure mode that
            # makes "it was working yesterday" true. Logged at error, retried on
            # the next tick.
            logger.exception("Abandoned-order sweep failed; will retry on the next tick")


async def run_stats_rollup() -> dict:
    """
    One pass of the analytics rollup: every day in the window that has no
    successful run.

    Driven by the run log rather than by "did the last tick succeed", so a process
    that was down for two days comes back and fills both instead of only the day
    it woke up on. A day at a time, because that is the unit of
    `product_stats_daily` and it keeps each transaction small.
    """
    from app.analytics import missing_days, rollup_day

    pool = get_pool()
    if pool is None:
        return {"rolled": 0, "errors": 0, "reason": "no pool"}

    window = max(1, int(settings.STATS_ROLLUP_WINDOW_DAYS))

    async with pool.acquire() as db:
        pending = await missing_days(db, window)
        rolled = 0
        errors = 0
        for day in pending:
            try:
                await rollup_day(db, day)
                rolled += 1
            except Exception:
                # One bad day must not stop the rest -- a single malformed row is
                # not a reason to leave the week unrolled. `rollup_day` has
                # already recorded the failure in `analytics_rollup_runs`, so it
                # is visible from the admin screen, not only in this log.
                errors += 1
                logger.exception("Rollup failed for %s; continuing", day)

    if rolled:
        logger.info("Rolled up %d analytics day(s), %d failed", rolled, errors)
    else:
        logger.debug("Analytics rollup: nothing missing")

    return {"rolled": rolled, "errors": errors}


async def stats_rollup_loop() -> None:
    """
    Runs the analytics rollup forever, with the first run one interval in.

    Delayed for the same reason as the order sweep: a process that has just
    started has a database connection it has not yet used, and the first thing it
    does should not be a cold grouped scan over a month of interactions.
    """
    interval = max(60, int(settings.STATS_ROLLUP_INTERVAL_SECONDS))
    logger.info("Analytics rollup running every %ds", interval)
    while True:
        try:
            await asyncio.sleep(interval)
            await run_stats_rollup()
        except asyncio.CancelledError:
            logger.info("Analytics rollup stopping")
            raise
        except Exception:
            logger.exception("Analytics rollup failed; will retry on the next tick")

