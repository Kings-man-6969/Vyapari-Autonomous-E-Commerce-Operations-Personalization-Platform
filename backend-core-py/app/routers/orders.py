"""
Orders — port of backend-core/src/routes/orders.js

GET  /api/orders
GET  /api/orders/:id
POST /api/orders                       (SELECT FOR UPDATE ACID transaction)
POST /api/orders/:id/confirm-payment

Variant-aware. Each line may name an option; the price, the stock lock and the
decrement all come from app.variants.resolve_purchase_line, which is the same
code the cart prices with. The purchased attributes and SKU are snapshotted onto
the order line so history survives a later edit to the option.
"""
import hashlib
import json
import time
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict

from app.auth.dependencies import require_auth
from app.db import get_db, get_pool
from app.variants import (
    assert_sufficient_stock,
    coerce_attributes,
    describe_attributes,
    resolve_purchase_line,
)

import re
from app.rate_limit import limit_for, rate_limit
from app.utils import to_valid_uuid

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
            order_row = await conn.fetchrow(
                """INSERT INTO orders (user_id, total_amount, status, shipping_address)
                   VALUES ($1, $2, 'pending', $3::jsonb)
                   RETURNING id, total_amount, status, created_at""",
                user["id"],
                float(total_amount),
                json.dumps(body.shipping_address),
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
            payment_row = await conn.fetchrow(
                """INSERT INTO payments (order_id, amount, status, payment_gateway, provider_ref)
                   VALUES ($1, $2, 'created', 'razorpay', $3)
                   RETURNING id, status, amount""",
                order_id,
                float(total_amount),
                f"rzp_order_{int(time.time() * 1000)}",
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


@router.post("/{id}/confirm-payment")
async def confirm_payment(
    id: str, body: ConfirmPaymentBody, user: dict = Depends(require_auth)
) -> dict:
    razorpay_payment_id = body.razorpay_payment_id or f"pay_mock_{int(time.time() * 1000)}"

    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            order_row = await conn.fetchrow(
                "UPDATE orders SET status = 'paid', updated_at = CURRENT_TIMESTAMP "
                "WHERE id = $1::uuid RETURNING *",
                id,
            )
            if not order_row:
                raise HTTPException(
                    status_code=404,
                    detail={"code": "ORDER_NOT_FOUND", "message": "Order not found."},
                )

            order = dict(order_row)

            await conn.execute(
                "UPDATE payments SET status = 'success', provider_ref = $1, updated_at = CURRENT_TIMESTAMP "
                "WHERE order_id = $2::uuid",
                razorpay_payment_id,
                id,
            )

            await conn.execute(
                "INSERT INTO order_status_history (order_id, status, note) "
                "VALUES ($1::uuid, 'paid', 'Payment verified via Razorpay')",
                id,
            )

            # Notification
            short_id = id[:8]
            await conn.execute(
                """INSERT INTO notifications (user_id, type, title, body, link)
                   VALUES ($1, 'order_confirmed', 'Order Confirmed!',
                           'Thank you! Your order #' || $2 || ' has been confirmed and is being prepared.',
                           '/orders/' || $3)""",
                order["user_id"],
                short_id,
                id,
            )

            # Purchase interactions
            item_rows = await conn.fetch(
                "SELECT product_id FROM order_items WHERE order_id = $1::uuid", id
            )
            for row in item_rows:
                await conn.execute(
                    "INSERT INTO user_interactions (user_id, product_id, event_type) VALUES ($1, $2, 'purchase')",
                    order["user_id"],
                    row["product_id"],
                )

    return {
        "success": True,
        "message": "Payment confirmed successfully.",
        "data": {"order_id": id, "status": "paid"},
    }


