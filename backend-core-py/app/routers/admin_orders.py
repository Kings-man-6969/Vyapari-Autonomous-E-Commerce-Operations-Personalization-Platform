"""
Admin order management: the list and the detail.

There was no `/api/admin/orders` at all, which is the oddest gap in the admin
panel. Everything an operator needs when a customer writes in -- what was
ordered, what was charged, what was refunded, where it was going -- lived only
in the customer's own order view, behind their session.

Two decisions worth stating:

1. **The address comes from `orders.shipping_address`, not the `addresses`
   table.** That column is a JSONB snapshot taken at purchase time, and it is
   the address the parcel actually went to. Reading the customer's current
   default address instead would show a different address than the one on the
   label, which is precisely the thing an operator is checking.

2. **Product titles are read live, but the option and the price are not.**
   `order_items` snapshots `sku_at_purchase` and `variant_snapshot` because
   options get renamed and prices move, and a refund has to reconcile against
   what was charged. It does not snapshot the title, so a deleted-then-recreated
   product is the one case where the title is unavailable -- and
   `order_items.product_id` is `ON DELETE RESTRICT`, so a product that was ever
   ordered can never actually be deleted. The join cannot come back empty for
   an order that has line items.
"""

import json
import math
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.auth.dependencies import require_role
from app.db import get_db

router = APIRouter(tags=["admin"])
_admin_guard = Depends(require_role("admin"))

#: Mirrors the `orders.status` CHECK constraint in V1. An unrecognised status
#: returns an empty list rather than everything, so a typo in a filter is
#: visible instead of silently ignored.
ORDER_STATUSES = (
    "pending",
    "paid",
    "processing",
    "shipped",
    "out_for_delivery",
    "delivered",
    "cancelled",
)

#: States from which an operator may still move an order forward. Past
#: `out_for_delivery` the parcel is with the customer, and the only honest
#: moves are a cancellation (which is `PUT /api/orders/{id}/cancel`, a customer
#: route with its own stock rules) or a refund.
ADVANCEABLE_FROM = ("paid", "processing", "shipped")

#: The forward path. Deliberately a whitelist and not `order by rank`: a
#: generated progression would let an operator put a delivered parcel back into
#: "shipped" by accident, and the stock and notification side effects would
#: follow it.
STATUS_FLOW = {
    "paid": "processing",
    "processing": "shipped",
    "shipped": "out_for_delivery",
}


class OrderStatusBody(BaseModel):
    status: str
    note: str | None = None


def _iso(value):
    return value.isoformat() if value else None


def _jsonb(value, default=None):
    """
    Decode a jsonb column off an asyncpg row.

    asyncpg returns jsonb as text on this pool, so `shipping_address` and
    `variant_snapshot` arrive as a JSON *string*. Handing that to the response
    serialises it as an escaped string -- the admin UI gets
    `"{\"city\": \"Pune\"}"` where it expected an object, and every field access
    on it fails at runtime. Decoding is explicit here rather than
    `isinstance(value, dict)` because that check fails *quietly*: it produced
    an empty address block on every order list and no error anywhere.

    A non-dict (a scalar, a list) is passed through as-is rather than coerced
    -- whatever wrote it is the only thing that knows what it meant.
    """
    if value is None or value == "":
        return {} if default is None else default
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except (ValueError, TypeError):
        return {} if default is None else default


async def _status_summary(db) -> dict:
    rows = await db.fetch("SELECT status, COUNT(*) AS n FROM orders GROUP BY status")
    counts = {s: 0 for s in ORDER_STATUSES}
    for r in rows:
        counts[r["status"]] = int(r["n"] or 0)
    counts["all"] = sum(int(r["n"] or 0) for r in rows)
    return counts


@router.get("/orders")
async def list_admin_orders(
    status: str = Query(None),
    search: str = Query(None),
    payment_status: str = Query(None),
    date_from: str = Query(None, description="ISO date, inclusive"),
    date_to: str = Query(None, description="ISO date, inclusive"),
    seller: str = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> dict:
    where = ["1=1"]
    params: list = []

    if status and status != "all":
        if status not in ORDER_STATUSES:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "INVALID_STATUS",
                    "message": f"Unknown order status. Expected one of: {', '.join(ORDER_STATUSES)}.",
                },
            )
        params.append(status)
        where.append(f"o.status = ${len(params)}")

    if search and search.strip():
        term = search.strip()
        # A uuid search matches the order id, the customer's name or email, or
        # the gateway order id -- the four things someone actually has to hand
        # when they open a support ticket. A short partial uuid is matched with
        # LIKE rather than cast, because `::uuid` on a 6-character id is a 22P02
        # error and a 500.
        params.append(f"%{term}%")
        i = len(params)
        where.append(
            f"(o.id::text ILIKE ${i} OR o.razorpay_order_id ILIKE ${i} "
            f"OR o.razorpay_payment_id ILIKE ${i} "
            f"OR u.name ILIKE ${i} OR u.email ILIKE ${i})"
        )

    if payment_status and payment_status != "all":
        params.append(payment_status)
        where.append(
            f"EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id AND p.status = ${len(params)})"
        )

    # Parsed in Python, not cast in SQL. asyncpg infers the parameter type from
    # the comparison, gets `timestamptz`, and refuses a str outright with
    # "expected a datetime.date or datetime.datetime instance" -- so a plain
    # `created_at >= $1::timestamptz` is a 500 for every well-formed date. Two
    # things are therefore done here: the value is validated (a string the
    # database cannot parse is a 22007, and an unhandled one is also a 500), and
    # it is converted to a real datetime before it is bound.
    def _parse_date(value, field):
        if not value:
            return None
        try:
            return datetime.fromisoformat(value)
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "INVALID_DATE",
                    "message": f"{field} is not a date. Use YYYY-MM-DD.",
                },
            )

    start = _parse_date(date_from, "date_from")
    end = _parse_date(date_to, "date_to")

    if start is not None:
        params.append(start)
        where.append(f"o.created_at >= ${len(params)}")
    if end is not None:
        params.append(end)
        # Inclusive of the whole day: an operator filtering "to 2026-09-26"
        # means through the end of the 26th, not up to midnight on it. The cast
        # is required -- bare `$N + INTERVAL` makes PostgreSQL infer the
        # parameter as `interval` and the comparison then has no operator.
        where.append(
            f"o.created_at < (${len(params)}::timestamptz + INTERVAL '1 day')"
        )

    if seller and seller.strip() and seller != "all":
        params.append(f"%{seller.strip()}%")
        i = len(params)
        where.append(
            f"EXISTS (SELECT 1 FROM order_items oi "
            f"  LEFT JOIN seller_profiles sp ON sp.user_id = oi.seller_id "
            f" WHERE oi.order_id = o.id "
            f"   AND (COALESCE(sp.store_name, oi.seller_id::text) ILIKE ${i}))"
        )

    where_sql = " AND ".join(where)

    total = int(
        await db.fetchval(
            f"""SELECT COUNT(*) FROM orders o JOIN users u ON u.id = o.user_id
                 WHERE {where_sql}""",
            *params,
        )
        or 0
    )

    params.append(limit)
    limit_idx = len(params)
    params.append((page - 1) * limit)
    offset_idx = len(params)

    rows = await db.fetch(
        f"""SELECT o.id, o.status, o.total_amount, o.created_at, o.updated_at,
                   o.razorpay_order_id, o.razorpay_payment_id,
                   o.shipping_address,
                   u.id AS user_id, u.name AS customer_name, u.email AS customer_email,
                   (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
                   (SELECT COUNT(DISTINCT oi.seller_id) FROM order_items oi WHERE oi.order_id = o.id)
                       AS seller_count,
                   (SELECT string_agg(DISTINCT oi.seller_id::text, ',') FROM order_items oi
                     WHERE oi.order_id = o.id) AS seller_ids,
                   (SELECT p.status FROM payments p WHERE p.order_id = o.id
                     ORDER BY p.created_at DESC LIMIT 1) AS payment_status,
                   (SELECT COALESCE(SUM(r.amount) FILTER (WHERE r.status = 'processed'), 0)
                      FROM refunds r WHERE r.order_id = o.id) AS refunded_amount,
                   (SELECT COALESCE(SUM(r.amount) FILTER (WHERE r.status <> 'processed'
                                                            AND r.status <> 'rejected'), 0)
                      FROM refunds r WHERE r.order_id = o.id) AS refund_pending_amount
              FROM orders o
              JOIN users u ON u.id = o.user_id
             WHERE {where_sql}
             ORDER BY o.created_at DESC
             LIMIT ${limit_idx} OFFSET ${offset_idx}""",
        *params,
    )

    results = []
    for r in rows:
        d = dict(r)
        d["id"] = str(d["id"])
        d["user_id"] = str(d["user_id"])
        d["total_amount"] = float(d["total_amount"] or 0)
        d["refunded_amount"] = float(d["refunded_amount"] or 0)
        d["refund_pending_amount"] = float(d["refund_pending_amount"] or 0)
        d["item_count"] = int(d["item_count"] or 0)
        d["seller_count"] = int(d["seller_count"] or 0)
        d["seller_ids"] = [s for s in (d.get("seller_ids") or "").split(",") if s] or None
        d["created_at"] = _iso(d.get("created_at"))
        d["updated_at"] = _iso(d.get("updated_at"))
        # The snapshot is only shown in the list, and only the town, so the
        # response stays small; the full address is on the detail route.
        addr = _jsonb(d.get("shipping_address"))
        d["ship_to"] = {
            k: addr.get(k) for k in ("full_name", "city", "state", "pincode") if addr.get(k)
        }
        d.pop("shipping_address", None)
        results.append(d)

    pages = max(1, math.ceil(total / limit)) if total else 1
    return {
        "success": True,
        "data": results,
        "pagination": {"total": total, "page": page, "limit": limit, "pages": pages},
        "counts": await _status_summary(db),
        # What each order can move to next, so the admin UI does not have to
        # reimplement the flow rules and get them subtly different.
        "allowed_transitions": STATUS_FLOW,
    }


@router.get("/orders/{order_id}")
async def get_admin_order(
    order_id: str,
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> dict:
    try:
        o_uuid = uuid.UUID(order_id)
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(
            status_code=404, detail={"code": "ORDER_NOT_FOUND", "message": "Order not found."}
        )

    order = await db.fetchrow(
        """SELECT o.*, u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone
             FROM orders o JOIN users u ON u.id = o.user_id
            WHERE o.id = $1::uuid""",
        o_uuid,
    )
    if not order:
        raise HTTPException(
            status_code=404, detail={"code": "ORDER_NOT_FOUND", "message": "Order not found."}
        )

    items = await db.fetch(
        """SELECT oi.id, oi.product_id, oi.variant_id, oi.seller_id, oi.quantity,
                  oi.price_at_purchase, oi.variant_snapshot, oi.sku_at_purchase,
                  p.title AS product_title, p.images AS product_images, p.slug AS product_slug,
                  COALESCE(sp.store_name, ou.name) AS seller_name
             FROM order_items oi
             LEFT JOIN products p ON p.id = oi.product_id
             LEFT JOIN users ou ON ou.id = oi.seller_id
             LEFT JOIN seller_profiles sp ON sp.user_id = oi.seller_id
            WHERE oi.order_id = $1::uuid
            ORDER BY oi.created_at, oi.id""",
        o_uuid,
    )

    line_results = []
    for r in items:
        d = dict(r)
        d["id"] = str(d["id"])
        for key in ("product_id", "variant_id", "seller_id"):
            d[key] = str(d[key]) if d.get(key) else None
        d["quantity"] = int(d["quantity"] or 0)
        d["price_at_purchase"] = float(d["price_at_purchase"] or 0)
        d["line_total"] = round(d["price_at_purchase"] * d["quantity"], 2)
        if isinstance(d.get("product_images"), str):
            d["product_images"] = _jsonb(d["product_images"], default=[])
        # What the buyer actually chose, kept because the option may since have
        # been renamed or deleted. Left as text this reached the client as an
        # escaped JSON string, so the line said `variant_snapshot: "{'size': 'S'}"`
        # and any attempt to read a size off it raised.
        d["variant_snapshot"] = _jsonb(d.get("variant_snapshot"))
        line_results.append(d)

    payments = await db.fetch(
        """SELECT id, amount, status, payment_gateway, provider_ref, created_at, updated_at
             FROM payments WHERE order_id = $1::uuid ORDER BY created_at, id""",
        o_uuid,
    )
    payment_results = []
    for r in payments:
        d = dict(r)
        d["id"] = str(d["id"])
        d["amount"] = float(d["amount"] or 0)
        d["created_at"] = _iso(d.get("created_at"))
        d["updated_at"] = _iso(d.get("updated_at"))
        payment_results.append(d)

    refunds = await db.fetch(
        """SELECT r.id, r.payment_id, r.amount, r.reason, r.status, r.gateway,
                  r.gateway_refund_id, r.failure_reason, r.created_at, r.processed_at,
                  ru.name AS requested_by_name, pu.name AS processed_by_name
             FROM refunds r
             LEFT JOIN users ru ON ru.id = r.requested_by
             LEFT JOIN users pu ON pu.id = r.processed_by
            WHERE r.order_id = $1::uuid
            ORDER BY r.created_at, r.id""",
        o_uuid,
    )
    refund_results = []
    for r in refunds:
        d = dict(r)
        d["id"] = str(d["id"])
        d["payment_id"] = str(d["payment_id"]) if d.get("payment_id") else None
        d["amount"] = float(d["amount"] or 0)
        d["created_at"] = _iso(d.get("created_at"))
        d["processed_at"] = _iso(d.get("processed_at"))
        refund_results.append(d)

    history = await db.fetch(
        """SELECT h.id, h.status, h.note, h.changed_at, h.changed_by, u.name AS changed_by_name
             FROM order_status_history h
             LEFT JOIN users u ON u.id = h.changed_by
            WHERE h.order_id = $1::uuid
            ORDER BY h.changed_at, h.id""",
        o_uuid,
    )
    history_results = []
    for r in history:
        d = dict(r)
        d["id"] = str(d["id"])
        d["changed_by"] = str(d["changed_by"]) if d.get("changed_by") else None
        d["changed_at"] = _iso(d.get("changed_at"))
        history_results.append(d)

    refunded = round(
        sum(r["amount"] for r in refund_results if r["status"] == "processed"), 2
    )
    refund_pending = round(
        sum(
            r["amount"]
            for r in refund_results
            if r["status"] not in ("processed", "rejected", "failed")
        ),
        2,
    )

    data = dict(order)
    data["id"] = str(data["id"])
    data["user_id"] = str(data["user_id"])
    data["total_amount"] = float(data["total_amount"] or 0)
    data["created_at"] = _iso(data.get("created_at"))
    data["updated_at"] = _iso(data.get("updated_at"))
    data["expires_at"] = _iso(data.get("expires_at"))
    # The address that went on the label, not the buyer's current default.
    data["shipping_address"] = _jsonb(data.get("shipping_address"))

    return {
        "success": True,
        "data": {
            **data,
            "items": line_results,
            "payments": payment_results,
            "refunds": refund_results,
            "status_history": history_results,
            "totals": {
                "order_total": data["total_amount"],
                "refunded": refunded,
                "refund_pending": refund_pending,
                # What is still refundable, matching the figure
                # `POST /api/payments/refunds` will accept, so the admin screen
                # and the refund route cannot disagree.
                "refundable": round(max(0.0, data["total_amount"] - refunded - refund_pending), 2),
            },
            "next_status": STATUS_FLOW.get(data["status"]),
        },
    }


@router.put("/orders/{order_id}/status")
async def admin_set_order_status(
    order_id: str,
    body: OrderStatusBody,
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> dict:
    """
    Move an order one step forward.

    Cancellation is not here. `PUT /api/orders/{id}/cancel` owns it, because it
    is the path that puts stock back and the one the customer's own session can
    reach; giving the admin panel a second, differently-implemented cancel would
    be two ways to return inventory and one of them would eventually disagree
    with the other.
    """
    if body.status not in ORDER_STATUSES:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_STATUS",
                "message": f"Unknown order status. Expected one of: {', '.join(ORDER_STATUSES)}.",
            },
        )

    try:
        o_uuid = uuid.UUID(order_id)
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(
            status_code=404, detail={"code": "ORDER_NOT_FOUND", "message": "Order not found."}
        )

    # `db` is one connection, not a pool -- see the note in admin_catalogue.py.
    async with db.transaction():
        order = await db.fetchrow(
            "SELECT id, status FROM orders WHERE id = $1::uuid FOR UPDATE", o_uuid
        )
        if not order:
            raise HTTPException(
                status_code=404,
                detail={"code": "ORDER_NOT_FOUND", "message": "Order not found."},
            )

        current = order["status"]
        if current == body.status:
            # Idempotent rather than an error: a double-click on "Mark shipped"
            # is not a mistake worth a red banner.
            return {
                "success": True,
                "message": f"Order is already {body.status}.",
                "data": {"id": str(o_uuid), "status": current, "changed": False},
            }

        expected = STATUS_FLOW.get(current)
        if expected != body.status:
            if body.status == "cancelled":
                raise HTTPException(
                    status_code=409,
                    detail={
                        "code": "USE_CANCEL_ROUTE",
                        "message": (
                            "Cancelling has to go through the cancellation route, which "
                            "returns the stock and updates the payment. Set the status "
                            "to cancelled here and the order would keep inventory it no "
                            "longer has."
                        ),
                        "data": {"cancel_route": f"/api/orders/{o_uuid}/cancel"},
                    },
                )
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "INVALID_TRANSITION",
                    "message": (
                        f"An order that is {current} can only move to {expected}."
                        if expected
                        else f"An order that is {current} cannot be moved forward from here."
                    ),
                    "data": {"current_status": current, "allowed_next": expected},
                },
            )

        # The history row and the status move are one transaction: a history row
        # for a move that did not happen is a fabricated audit trail, which is
        # worse than no audit trail.
        await db.execute(
            """INSERT INTO order_status_history (order_id, status, note, changed_by)
               VALUES ($1::uuid, $2, $3, $4::uuid)""",
            o_uuid,
            body.status,
            (body.note or "").strip() or f"Moved to {body.status} by an administrator",
            user["id"],
        )
        await db.execute(
            "UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2::uuid",
            body.status,
            o_uuid,
        )

    # No cache invalidation here, unlike the catalogue routes. Orders are read
    # live everywhere in this codebase -- there is no `order:detail:` or
    # `orders:user:` key for a status change to be stale in -- so the
    # customer's screen and the admin screen agree the moment this returns.

    return {
        "success": True,
        "message": f"Order moved to {body.status}.",
        "data": {
            "id": str(o_uuid),
            "status": body.status,
            "changed": True,
            "next_status": STATUS_FLOW.get(body.status),
        },
    }
