"""
Orders — port of backend-core/src/routes/orders.js

GET  /api/orders
GET  /api/orders/:id
POST /api/orders                       (SELECT FOR UPDATE ACID transaction)
POST /api/orders/:id/confirm-payment
PUT  /api/orders/:id/cancel

Variant-aware. Each line may name an option; the price, the stock lock and the
decrement all come from app.variants.resolve_purchase_line, which is the same
code the cart prices with. The purchased attributes and SKU are snapshotted onto
the order line so history survives a later edit to the option.

Stock goes out on placement and comes back on cancellation or expiry --
app.routers.payments.restore_stock is the only thing that puts it back, and
there is no other caller, so there is exactly one place to get it right.
"""
import hashlib
import json
import logging
import re
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from app.auth.dependencies import require_auth
from app.config import settings
from app.db import get_db, get_pool
from app.payments.razorpay import GatewayError, gateway
# _after_paid and restore_stock live in the payments router because the webhook
# needs them too, and two copies of "make this order paid" would be two places to
# get the notification and the stock handling wrong.
from app.routers.payments import _after_paid, restore_stock
from app.variants import (
    assert_sufficient_stock,
    coerce_attributes,
    describe_attributes,
    resolve_purchase_line,
)

from app.rate_limit import limit_for, rate_limit
from app.utils import to_valid_uuid

logger = logging.getLogger("vyapari-orders")

router = APIRouter()


def _limit(scope: str):
    """Build a limiter dependency from the shared table in app.rate_limit."""
    n, window = limit_for(scope)
    return rate_limit(scope, n, window)


@router.get("")
@router.get("/")
async def list_orders(user: dict = Depends(require_auth), db=Depends(get_db)) -> dict:
    rows = await db.fetch(
        """SELECT
            o.id, o.total_amount, o.status, o.created_at,
            p.status AS payment_status, p.payment_gateway,
            COUNT(oi.id) AS item_count
           FROM orders o
           LEFT JOIN payments p ON o.id = p.order_id
           LEFT JOIN order_items oi ON o.id = oi.order_id
           WHERE o.user_id = $1
           GROUP BY o.id, p.status, p.payment_gateway
           ORDER BY o.created_at DESC""",
        user["id"],
    )
    return {"success": True, "data": {"orders": [dict(r) for r in rows]}}


@router.get("/{id}")
async def get_order(id: str, user: dict = Depends(require_auth), db=Depends(get_db)) -> dict:
    is_uuid = bool(re.match(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", id, re.IGNORECASE))
    where_cond = "o.id = $1::uuid" if is_uuid else "o.id::text = $1"
    order_row = await db.fetchrow(
        f"""SELECT o.*, p.status AS payment_status, p.provider_ref, p.payment_gateway
           FROM orders o
           LEFT JOIN payments p ON o.id = p.order_id
           WHERE {where_cond} AND (o.user_id = $2 OR $3 = 'admin')""",
        id,
        user["id"],
        user["role"],
    )
    if not order_row:
        raise HTTPException(
            status_code=404,
            detail={"code": "ORDER_NOT_FOUND", "message": "Order not found."},
        )

    items_rows = await db.fetch(
        """SELECT oi.*, p.title, p.images, sp.store_name,
                  v.attributes AS live_variant_attributes
           FROM order_items oi
           JOIN products p ON oi.product_id = p.id
           JOIN seller_profiles sp ON oi.seller_id = sp.user_id
           LEFT JOIN product_variants v ON oi.variant_id = v.id
           WHERE oi.order_id = $1""",
        id,
    )
    history_rows = await db.fetch(
        """SELECT id, status, note, changed_at
           FROM order_status_history
           WHERE order_id = $1
           ORDER BY changed_at ASC""",
        id,
    )

    items = []
    for r in items_rows:
        item = dict(r)
        # The snapshot is what was bought; the live row is what the option is
        # called now. Both are returned because they legitimately differ, and a
        # seller who renamed an option should be able to see that they did.
        item["variant_snapshot"] = coerce_attributes(item.get("variant_snapshot"))
        item["live_variant_attributes"] = coerce_attributes(item.get("live_variant_attributes"))
        item["variant_label"] = describe_attributes(
            item["variant_snapshot"] or item["live_variant_attributes"]
        )
        item["variant_renamed"] = bool(
            item["variant_snapshot"]
            and item["live_variant_attributes"]
            and item["variant_snapshot"] != item["live_variant_attributes"]
        )
        items.append(item)

    return {
        "success": True,
        "data": {
            "order": dict(order_row),
            "items": items,
            "timeline": [dict(r) for r in history_rows],
        },
    }


class OrderItem(BaseModel):
    product_id: str
    quantity: int
    #: The chosen option. Optional: a product with no options, or a client with
    #: no picker yet, sends none and the default is used.
    variant_id: str | None = None


class CreateOrderBody(BaseModel):
    shipping_address: dict
    items: list[OrderItem]


@router.post("", status_code=201)
@router.post("/", status_code=201)
async def create_order(
    body: CreateOrderBody,
    user: dict = Depends(require_auth),
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    _rl=Depends(_limit("orders.create")),
) -> Any:
    """
    ACID transaction with SELECT ... FOR UPDATE & Idempotency-Key support.
    """
    if not body.shipping_address or not body.items:
        raise HTTPException(
            status_code=400,
            detail={"code": "VALIDATION_ERROR", "message": "Valid shipping_address and items array required."},
        )

    request_hash = None
    if idempotency_key:
        dumped = body.model_dump() if hasattr(body, "model_dump") else body.dict()
        payload_str = json.dumps(dumped, sort_keys=True)
        request_hash = hashlib.sha256(payload_str.encode("utf-8")).hexdigest()

    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            # 0. Idempotency reservation if key provided
            if idempotency_key:
                claimed = await conn.fetchval(
                    """INSERT INTO idempotency_records (user_id, key, request_hash, status, expires_at)
                       VALUES ($1, $2, $3, 'processing', CURRENT_TIMESTAMP + INTERVAL '72 hours')
                       ON CONFLICT (user_id, key) DO NOTHING
                       RETURNING id;""",
                    user["id"],
                    idempotency_key,
                    request_hash,
                )
                if not claimed:
                    existing = await conn.fetchrow(
                        "SELECT status, response, status_code, request_hash FROM idempotency_records WHERE user_id = $1 AND key = $2",
                        user["id"],
                        idempotency_key,
                    )
                    if existing:
                        if existing["request_hash"] != request_hash:
                            raise HTTPException(
                                status_code=422,
                                detail={"code": "IDEMPOTENCY_PAYLOAD_MISMATCH", "message": "Idempotency key reused with different request payload."},
                            )
                        if existing["status"] == "completed":
                            saved_resp = json.loads(existing["response"]) if isinstance(existing["response"], str) else existing["response"]
                            return JSONResponse(status_code=existing["status_code"], content=saved_resp)
                        return JSONResponse(
                            status_code=409,
                            content={"success": False, "error": {"code": "IN_FLIGHT_REQUEST", "message": "Request currently processing. Please retry."}},
                            headers={"Retry-After": "2"},
                        )

            total_amount = Decimal("0")
            validated_items = []

            for item in body.items:
                clean_p_id = to_valid_uuid(item.product_id)
                if not clean_p_id:
                    raise HTTPException(
                        status_code=404,
                        detail={"code": "PRODUCT_NOT_FOUND", "message": f"Product {item.product_id} no longer exists."},
                    )
                clean_v_id = to_valid_uuid(item.variant_id) if item.variant_id else None
                if item.variant_id and not clean_v_id:
                    raise HTTPException(
                        status_code=404,
                        detail={"code": "VARIANT_NOT_FOUND", "message": "That option is no longer available."},
                    )

                # One resolver decides the price and the stock, under
                # SELECT ... FOR UPDATE on both the product and the option.
                # Locking only the option would race sync_product_stock_from_
                # variants(), which writes the parent row.
                line = await resolve_purchase_line(
                    conn, clean_p_id, clean_v_id, item.quantity, lock=True
                )
                assert_sufficient_stock(line, item.quantity)

                total_amount += line.price * item.quantity
                validated_items.append({
                    "product_id": str(line.product_id),
                    "seller_id": str(line.seller_id),
                    "variant_id": str(line.variant_id) if line.variant_id else None,
                    "quantity": item.quantity,
                    "price": float(line.price),
                    "variant_attributes": line.to_dict()["variant_attributes"],
                    "sku": line.to_dict()["sku"],
                    "new_stock": line.stock - item.quantity,
                })

            # 1. Create order
            #
            # expires_at is when this order stops holding stock. The decrement
            # below is unconditional and immediate, so an order abandoned at the
            # gateway's own 3-D Secure step would otherwise leave the catalogue
            # selling inventory nobody is holding -- for as long as the order row
            # survives, which is forever. The sweep in app/jobs.py acts on it.
            order_row = await conn.fetchrow(
                """INSERT INTO orders (user_id, total_amount, status, shipping_address, expires_at)
                   VALUES ($1, $2, 'pending', $3::jsonb,
                           NOW() + ($4 || ' minutes')::interval)
                   RETURNING id, total_amount, status, created_at, expires_at""",
                user["id"],
                float(total_amount),
                json.dumps(body.shipping_address),
                str(settings.ORDER_PAYMENT_WINDOW_MINUTES),
            )
            order_id = order_row["id"]

            # 2. Order items + stock decrement
            for vi in validated_items:
                # The snapshot is what makes a historical line item legible after
                # the seller renames "Indigo" to "Midnight Blue" or retires the
                # option entirely. Without it, an order placed last year can no
                # longer say what was bought.
                await conn.execute(
                    """INSERT INTO order_items
                         (order_id, product_id, seller_id, quantity, price_at_purchase,
                          variant_id, variant_snapshot, sku_at_purchase)
                       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)""",
                    order_id,
                    vi["product_id"],
                    vi["seller_id"],
                    vi["quantity"],
                    vi["price"],
                    vi["variant_id"],
                    json.dumps(vi["variant_attributes"]) if vi["variant_attributes"] else None,
                    vi["sku"],
                )

                if vi["variant_id"]:
                    # Decrement the option; the trigger keeps the product total
                    # and, below, the product status in step.
                    await conn.execute(
                        """UPDATE product_variants
                              SET stock_qty = stock_qty - $1, updated_at = CURRENT_TIMESTAMP
                            WHERE id = $2::uuid""",
                        vi["quantity"],
                        vi["variant_id"],
                    )
                else:
                    await conn.execute(
                        "UPDATE products SET stock_qty = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
                        vi["new_stock"],
                        vi["product_id"],
                    )

                new_status = "out_of_stock" if vi["new_stock"] == 0 else "active"
                await conn.execute(
                    "UPDATE products SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
                    new_status,
                    vi["product_id"],
                )

            # 3. Initial status history
            await conn.execute(
                """INSERT INTO order_status_history (order_id, status, note, changed_by)
                   VALUES ($1, 'pending', 'Order placed by customer', $2)""",
                order_id,
                user["id"],
            )

            # 4. Payment record (Razorpay)
            #
            # provider_ref is left NULL. It used to be set to a fabricated
            # "rzp_order_<millis>" here, which is worse than nothing: the webhook
            # matched its incoming gateway order id against this column, so it
            # never matched, and the id in the row looked like a real gateway
            # reference to anyone reading the database. The real id arrives from
            # POST /api/payments/create, which is also where the gateway is
            # actually called.
            payment_row = await conn.fetchrow(
                """INSERT INTO payments (order_id, amount, status, payment_gateway)
                   VALUES ($1, $2, 'created', 'razorpay')
                   RETURNING id, status, amount""",
                order_id,
                float(total_amount),
            )

            # 5. Clear cart
            await conn.execute(
                """DELETE FROM cart_items ci
                   USING carts c
                   WHERE ci.cart_id = c.id AND c.user_id = $1""",
                user["id"],
            )

            # Every value here has to survive json.dumps() at step 6, not just
            # FastAPI's response encoder. payment_row is a raw asyncpg record
            # and carries a uuid.UUID id and a Decimal amount; the stdlib encoder
            # handles neither, so storing the idempotent copy of this dict used
            # to raise TypeError and roll the whole order back -- the order was
            # real, the money was taken by the client on retry, and the retry
            # created a second one. Anything added to this dict has to be
            # cast, not just be renderable by FastAPI.
            response_data = {
                "success": True,
                "data": {
                    "order_id": str(order_id),
                    "total_amount": float(total_amount),
                    "status": "pending",
                    "payment": {
                        "id": str(payment_row["id"]),
                        "status": payment_row["status"],
                        "amount": float(payment_row["amount"]),
                    },
                },
            }

            # 6. Store completed idempotency record
            if idempotency_key:
                await conn.execute(
                    """UPDATE idempotency_records
                       SET status = 'completed', response = $1, status_code = 201
                       WHERE user_id = $2 AND key = $3;""",
                    json.dumps(response_data),
                    user["id"],
                    idempotency_key,
                )

    return response_data


class ConfirmPaymentBody(BaseModel):
    razorpay_payment_id: str | None = None
    razorpay_order_id: str | None = None
    razorpay_signature: str | None = None


@router.post("/{id}/confirm-payment")
async def confirm_payment(
    id: str, body: ConfirmPaymentBody, user: dict = Depends(require_auth)
) -> dict:
    """
    Turns a checkout.js success callback into a paid order -- after checking it.

    This used to accept any string, mark the order paid, and do it for any order
    id the caller named. Three separate problems, all fixed here:

      the payment id was optional, defaulting to a made-up one, so a POST with an
        empty body was a valid receipt;
      the UPDATE had no user_id filter, so any logged-in user could mark any
        order on the platform paid and queue a confirmation notification to its
        owner. Marking orders paid is exactly the operation that must not be
        unauthenticated in substance;
      nothing was verified. A signature over "order_id|payment_id" proves the
        callback came from a real checkout of *this* gateway account; and the
        gateway is then asked what happened, because "the customer returned" and
        "the money arrived" are different claims.

    The webhook can and does win this race. Both paths end in the same guarded
    UPDATE ... WHERE status = 'pending', so whichever arrives first applies the
    transition and the other finds nothing to do.
    """
    order_uuid = to_valid_uuid(id)
    if not order_uuid:
        raise HTTPException(
            400, detail={"code": "VALIDATION_ERROR", "message": "Order id must be a UUID."}
        )

    pool = get_pool()
    order = await pool.fetchrow(
        "SELECT id, user_id, status, total_amount, razorpay_order_id FROM orders WHERE id = $1::uuid",
        order_uuid,
    )
    if not order:
        raise HTTPException(404, detail={"code": "ORDER_NOT_FOUND", "message": "Order not found."})
    if str(order["user_id"]) != str(user["id"]) and user["role"] != "admin":
        raise HTTPException(404, detail={"code": "ORDER_NOT_FOUND", "message": "Order not found."})

    if order["status"] != "pending":
        # Already paid, or cancelled. Not an error: the customer refreshing the
        # return page, or the webhook having got there first, both land here, and
        # the right answer is the state the order is actually in.
        return {
            "success": True,
            "message": f"Order is already {order['status']}.",
            "data": {"order_id": str(order["id"]), "status": order["status"]},
        }

    if not (body.razorpay_payment_id and body.razorpay_order_id and body.razorpay_signature):
        raise HTTPException(
            400,
            detail={
                "code": "PAYMENT_DETAILS_INCOMPLETE",
                "message": "Payment details from the gateway are missing.",
            },
        )

    # The order id in the signature has to be the one we opened for *this* order.
    # Checking a valid signature over somebody else's order id would otherwise be
    # enough: a customer who paid for a ₹10 order could present that signature to
    # confirm a ₹10,000 one.
    if order["razorpay_order_id"] != body.razorpay_order_id:
        raise HTTPException(
            400,
            detail={"code": "PAYMENT_ORDER_MISMATCH", "message": "This payment is for a different order."},
        )

    if not gateway.is_configured:
        raise HTTPException(
            503,
            detail={
                "code": "GATEWAY_NOT_CONFIGURED",
                "message": "Payment verification needs the Razorpay keys, which are not set on this deployment.",
            },
        )

    if not gateway.verify_payment_signature(
        body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature
    ):
        raise HTTPException(
            400,
            detail={"code": "INVALID_SIGNATURE", "message": "The payment could not be verified."},
        )

    try:
        remote = await gateway.fetch_payment(body.razorpay_payment_id)
    except GatewayError as exc:
        # A timeout here must not become a failure. The webhook may still arrive,
        # so the order stays pending and the frontend polls -- which is what
        # pending_verification is for.
        logger.error("Could not confirm payment %s with Razorpay: %s", body.razorpay_payment_id, exc)
        return {
            "success": True,
            "message": "Waiting for the payment to be confirmed.",
            "data": {"order_id": str(order["id"]), "status": "pending_verification"},
        }

    if remote.get("status") != "captured":
        await pool.execute(
            "UPDATE payments SET status = 'failed', provider_payload = $1::jsonb, updated_at = CURRENT_TIMESTAMP "
            "WHERE order_id = $2::uuid AND status <> 'success'",
            json.dumps(remote), order_uuid,
        )
        # An exception, not a 200 with a status_code key in it. A declined card
        # that answers 200 is a declined card the frontend's success path treats
        # as a receipt, and 402 is what tells a payment client to stop trying.
        raise HTTPException(
            402,
            detail={
                "code": "PAYMENT_NOT_CAPTURED",
                "message": (
                    "The payment was not completed"
                    + (f" ({remote.get('status')})" if remote.get("status") else "")
                    + ". You have not been charged; please try again."
                ),
                "data": {"gateway_status": remote.get("status")},
            },
        )

    async with pool.acquire() as conn:
        async with conn.transaction():
            applied = await conn.fetchrow(
                "UPDATE orders SET status = 'paid', razorpay_payment_id = $1, updated_at = CURRENT_TIMESTAMP "
                "WHERE id = $2::uuid AND status = 'pending' RETURNING id",
                body.razorpay_payment_id, order_uuid,
            )
            if applied:
                await conn.execute(
                    "UPDATE payments SET status = 'success', provider_ref = $1, "
                    "provider_payload = $2::jsonb, updated_at = CURRENT_TIMESTAMP "
                    "WHERE order_id = $3::uuid AND status <> 'success'",
                    body.razorpay_payment_id, json.dumps(remote), order_uuid,
                )
                await _after_paid(conn, order_uuid, "Payment verified against Razorpay")

    return {
        "success": True,
        "message": "Payment confirmed.",
        "data": {"order_id": str(order["id"]), "status": "paid"},
    }


# ── cancellation ─────────────────────────────────────────────────────────────

class CancelOrderBody(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


@router.put("/{id}/cancel")
async def cancel_order(
    id: str, body: CancelOrderBody, user: dict = Depends(require_auth)
) -> dict:
    """
    Cancels an order and gives the stock back.

    Allowed while the order is unpaid (cancelling a pending order is free) and
    while it is paid but not yet dispatched. Once a seller has handed the parcel
    to a courier, cancelling from the customer's account is a refund, not a
    cancellation -- so that is refused with a 409 and a pointer to the way to
    actually do it, rather than quietly marking a shipped order cancelled.

    A paid order that is cancelled here is not refunded by this route. Refunds go
    through POST /api/payments/refunds, which checks the amount against what is
    actually left and records it, so money cannot leave by two routes at once.
    """
    order_uuid = to_valid_uuid(id)
    if not order_uuid:
        raise HTTPException(
            400, detail={"code": "VALIDATION_ERROR", "message": "Order id must be a UUID."}
        )

    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            order = await conn.fetchrow(
                "SELECT id, user_id, status, razorpay_payment_id FROM orders WHERE id = $1::uuid",
                order_uuid,
            )
            if not order:
                raise HTTPException(404, detail={"code": "ORDER_NOT_FOUND", "message": "Order not found."})
            if str(order["user_id"]) != str(user["id"]) and user["role"] != "admin":
                raise HTTPException(404, detail={"code": "ORDER_NOT_FOUND", "message": "Order not found."})

            if order["status"] == "cancelled":
                # Idempotent, because a customer pressing the button twice is not
                # an error and must not restore the stock twice.
                return {
                    "success": True,
                    "message": "This order is already cancelled.",
                    "data": {"order_id": str(order["id"]), "status": "cancelled"},
                }

            cancellable = ("pending", "paid", "processing")
            if order["status"] not in cancellable:
                raise HTTPException(
                    409,
                    detail={
                        "code": "ORDER_NOT_CANCELLABLE",
                        "message": (
                            f"This order is {order['status']} and has already left the warehouse. "
                            "Ask for a refund instead."
                        ),
                        "data": {"status": order["status"]},
                    },
                )

            was_paid = order["status"] in ("paid", "processing")
            await conn.execute(
                "UPDATE orders SET status = 'cancelled', expires_at = NULL, updated_at = CURRENT_TIMESTAMP "
                "WHERE id = $1::uuid",
                order_uuid,
            )
            # Cancels are status-history rows, not a table of their own, so there
            # is one audit trail rather than two that can disagree. The reason
            # lives in the note, which is where anyone looking for "why is this
            # cancelled" will look.
            await conn.execute(
                "INSERT INTO order_status_history (order_id, status, note, changed_by) "
                "VALUES ($1::uuid, 'cancelled', $2, $3::uuid)",
                order_uuid,
                (body.reason or ("Cancelled by customer" if not was_paid else "Cancelled by customer, payment to be refunded")),
                user["id"],
            )
            if was_paid:
                # Flagged, not refunded. 'pending_verification' is the same
                # state a customer sees while the gateway is deciding, and here it
                # means "this payment is not settled, a person has to look at it" --
                # which is exactly the truth, and is what keeps it out of a
                # reconciliation report that only counts 'success'.
                await conn.execute(
                    "UPDATE payments SET status = 'pending_verification', updated_at = CURRENT_TIMESTAMP "
                    "WHERE order_id = $1::uuid AND status = 'success'",
                    order_uuid,
                )
            else:
                # Nothing was paid, so the payment attempt is simply over. Left as
                # 'created' it would read to an admin as an order with money in
                # flight, and it would sit in the refunds-reconciliation query.
                await conn.execute(
                    "UPDATE payments SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP "
                    "WHERE order_id = $1::uuid AND status IN ('created', 'failed', 'pending_verification')",
                    order_uuid,
                )
            await restore_stock(conn, order_uuid)
            await conn.execute(
                "UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE user_id = $1",
                order["user_id"],
            )

    return {
        "success": True,
        "message": (
            "Order cancelled. The refund has been raised and will reach your account "
            "in 3-5 working days."
            if was_paid
            else "Order cancelled and the items are back in stock."
        ),
        "data": {
            "order_id": str(order_uuid),
            "status": "cancelled",
            "refund_pending": was_paid,
        },
    }


