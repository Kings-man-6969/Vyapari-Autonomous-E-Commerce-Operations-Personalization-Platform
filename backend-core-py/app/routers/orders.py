"""
Orders — port of backend-core/src/routes/orders.js

GET  /api/orders
GET  /api/orders/:id
POST /api/orders                       (SELECT FOR UPDATE ACID transaction)
POST /api/orders/:id/confirm-payment
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

import re
from app.utils import to_valid_uuid

router = APIRouter()


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
        """SELECT oi.*, p.title, p.images, sp.store_name
           FROM order_items oi
           JOIN products p ON oi.product_id = p.id
           JOIN seller_profiles sp ON oi.seller_id = sp.user_id
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

    return {
        "success": True,
        "data": {
            "order": dict(order_row),
            "items": [dict(r) for r in items_rows],
            "timeline": [dict(r) for r in history_rows],
        },
    }


class OrderItem(BaseModel):
    product_id: str
    quantity: int


class CreateOrderBody(BaseModel):
    shipping_address: dict
    items: list[OrderItem]


@router.post("", status_code=201)
@router.post("/", status_code=201)
async def create_order(
    body: CreateOrderBody,
    user: dict = Depends(require_auth),
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
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
                # SELECT ... FOR UPDATE — critical stock lock
                product = await conn.fetchrow(
                    "SELECT id, title, price, stock_qty, status, seller_id "
                    "FROM products WHERE id = $1::uuid FOR UPDATE",
                    clean_p_id,
                )

                if not product:
                    raise HTTPException(
                        status_code=404,
                        detail={"code": "PRODUCT_NOT_FOUND", "message": f"Product {item.product_id} no longer exists."},
                    )

                if product["status"] != "active" or product["stock_qty"] < item.quantity:
                    raise HTTPException(
                        status_code=400,
                        detail={
                            "code": "INSUFFICIENT_STOCK",
                            "message": f"\"{product['title']}\" has only {product['stock_qty']} units available.",
                        },
                    )

                price = Decimal(str(product["price"]))
                total_amount += price * item.quantity
                validated_items.append({
                    "product_id": str(product["id"]),
                    "seller_id": str(product["seller_id"]),
                    "quantity": item.quantity,
                    "price": float(price),
                    "new_stock": product["stock_qty"] - item.quantity,
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
                await conn.execute(
                    """INSERT INTO order_items (order_id, product_id, seller_id, quantity, price_at_purchase)
                       VALUES ($1, $2, $3, $4, $5)""",
                    order_id,
                    vi["product_id"],
                    vi["seller_id"],
                    vi["quantity"],
                    vi["price"],
                )
                new_status = "out_of_stock" if vi["new_stock"] == 0 else "active"
                await conn.execute(
                    "UPDATE products SET stock_qty = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3",
                    vi["new_stock"],
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

            response_data = {
                "success": True,
                "data": {
                    "order_id": str(order_id),
                    "total_amount": float(total_amount),
                    "status": "pending",
                    "payment": dict(payment_row),
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


