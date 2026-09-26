"""
Payments.

  POST /api/payments/create            -- open a gateway order for one of ours
  GET  /api/payments/status/{order_id} -- where has this got to
  POST /api/payments/webhook           -- Razorpay's word, which is the final one
  POST /api/payments/refunds           -- admin, and the only way money comes back

The one rule everything else follows: **the gateway decides whether money moved.**

Three things can tell us a payment succeeded, in ascending order of trust:

  the browser says so            -- checkout.js's callback. Untrusted.
  we verify the signature        -- proves the browser's claim came from a real
                                    checkout, but says nothing about capture.
  the webhook says so            -- Razorpay telling us it captured the money.

So confirm-payment verifies the signature and then asks Razorpay what happened,
and the webhook applies the same transition. Both are idempotent, so whichever
lands first wins and the other is a no-op -- which matters because they race
constantly and the customer is watching a spinner for one of them.
"""
import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.auth.dependencies import require_auth, require_role
from app.config import settings
from app.db import get_db, get_pool
from app.payments.razorpay import GatewayError, gateway
from app.rate_limit import limit_for, rate_limit
from app.utils import to_valid_uuid

logger = logging.getLogger("vyapari-payments")
router = APIRouter()


def _limit(scope: str):
    n, window = limit_for(scope)
    return rate_limit(scope, n, window)


# ── opening a gateway order ──────────────────────────────────────────────────

class CreatePaymentBody(BaseModel):
    order_id: str


@router.post("/create")
async def create_payment(
    body: CreatePaymentBody,
    user: dict = Depends(require_auth),
    _rl=Depends(_limit("payments.create")),
) -> dict:
    """
    Creates the Razorpay order for an existing order of ours and stores its id.

    The gateway order is what checkout.js opens, and its id is what the webhook
    comes back carrying. Until that id is on our row the webhook has nothing to
    match against, which is why this is a separate call and not something
    create_order does inline: reaching the gateway is a network round trip, and
    doing it inside the order transaction would hold row locks on the catalogue
    for the length of someone else's uptime.
    """
    order_uuid = to_valid_uuid(body.order_id)
    if not order_uuid:
        raise HTTPException(
            400, detail={"code": "VALIDATION_ERROR", "message": "order_id must be a UUID."}
        )

    if not gateway.is_configured:
        # Said plainly rather than as a 500 from deep inside an HTTP client. The
        # order is real and still pending; the operator needs to know the missing
        # thing is two environment variables.
        raise HTTPException(
            503,
            detail={
                "code": "GATEWAY_NOT_CONFIGURED",
                "message": (
                    "Razorpay keys are not set on this deployment "
                    "(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET). The order is saved and "
                    "unpaid; pay it once the keys are in place."
                ),
            },
        )

    pool = get_pool()
    async with pool.acquire() as conn:
        order = await conn.fetchrow(
            "SELECT id, user_id, total_amount, status, razorpay_order_id, created_at, expires_at, "
            "(expires_at IS NOT NULL AND expires_at < NOW()) AS window_closed, "
            "shipping_address->>'full_name' AS customer_name, "
            "shipping_address->>'email' AS customer_email "
            "FROM orders WHERE id = $1::uuid",
            order_uuid,
        )
        if not order:
            raise HTTPException(404, detail={"code": "ORDER_NOT_FOUND", "message": "Order not found."})
        if str(order["user_id"]) != str(user["id"]) and user["role"] != "admin":
            raise HTTPException(404, detail={"code": "ORDER_NOT_FOUND", "message": "Order not found."})

        # Checked before the status, because an order can be pending and still be
        # unpayable. Once the window closes the sweep returns the stock, so
        # taking payment for it would sell a unit that is back on the shelf -- and
        # the customer would be told it was paid with nothing shipped. The
        # frontend's "try again" button is gated on the same fact.
        if order["window_closed"]:
            raise HTTPException(
                409,
                detail={
                    "code": "ORDER_EXPIRED",
                    "message": (
                        "This order's payment window has closed and the items have been "
                        "released. Please place a new order."
                    ),
                    "data": {"expires_at": order["expires_at"]},
                },
            )
        if order["status"] not in ("pending",):
            raise HTTPException(
                409,
                detail={
                    "code": "ORDER_NOT_PAYABLE",
                    "message": f"This order is {order['status']} and no longer needs payment.",
                },
            )

        # Re-opening checkout on an order that already has a gateway order reuses
        # it. Creating a second one would leave the first payable, so a customer
        # who dismissed the modal and came back could pay either -- and the
        # webhook would then mark the order paid twice over two different
        # payment ids, which is exactly the reconciliation nobody wants.
        if order["razorpay_order_id"]:
            return _checkout_params(order, order["razorpay_order_id"], reused=True)

        try:
            gateway_order = await gateway.create_order(
                amount=order["total_amount"],
                currency=settings.RAZORPAY_CURRENCY,
                receipt=str(order["id"]),
                notes={"order_id": str(order["id"]), "user_id": str(order["user_id"])},
            )
        except GatewayError as exc:
            logger.error("Razorpay order creation failed: %s", exc)
            raise HTTPException(
                502,
                detail={
                    "code": "GATEWAY_ERROR",
                    "message": "Could not start the payment. Your order is saved; please try again.",
                },
            ) from exc

        gateway_order_id = gateway_order.get("id")
        if not gateway_order_id:
            raise HTTPException(
                502,
                detail={"code": "GATEWAY_ERROR", "message": "Razorpay returned no order id."},
            )

        async with conn.transaction():
            # Written to the order, which is what the webhook matches on, and to
            # the payment row, which is what an admin looks at.
            await conn.execute(
                "UPDATE orders SET razorpay_order_id = $1, updated_at = CURRENT_TIMESTAMP "
                "WHERE id = $2::uuid AND razorpay_order_id IS NULL",
                gateway_order_id, order["id"],
            )
            await conn.execute(
                """UPDATE payments
                      SET provider_ref = $1, status = 'created', updated_at = CURRENT_TIMESTAMP
                    WHERE order_id = $2::uuid AND status = 'created'""",
                gateway_order_id, order["id"],
            )

        return _checkout_params(order, gateway_order_id)


def _checkout_params(order, gateway_order_id: str, reused: bool = False) -> dict:
    """
    Exactly what checkout.js needs, and nothing more.

    The key *id* is publishable -- it identifies the account, it does not
    authenticate anything, and checkout.js requires it in the browser. The key
    secret is not in this dict and must never be.

    prefill comes from the address the customer already typed two screens ago.
    Razorpay shows it, and every keystroke it saves is a keystroke that does not
    become a mistyped email on a payment form.
    """
    prefill = {}
    if order.get("customer_name"):
        prefill["name"] = order["customer_name"]
    if order.get("customer_email"):
        prefill["email"] = order["customer_email"]

    return {
        "success": True,
        "data": {
            "order_id": str(order["id"]),
            "amount": float(order["total_amount"]),
            "currency": settings.RAZORPAY_CURRENCY,
            "key_id": gateway.public_key_id(),
            "razorpay_order_id": gateway_order_id,
            "receipt": str(order["id"]),
            "name": "Vyapari",
            "prefill": prefill,
            "reused_gateway_order": reused,
        },
    }


# ── where has this got to ────────────────────────────────────────────────────

@router.get("/status/{order_id}")
async def payment_status(
    order_id: str,
    user: dict = Depends(require_auth),
) -> dict:
    """
    Polled while the customer waits on the gateway or for the webhook.

    Reports the gateway's *intent* between 'created' and 'success' as
    'pending_verification', which is the honest answer: the customer is back from
    checkout.js with a signature but the webhook has not landed. Telling them
    'pending' would suggest nothing is happening; telling them 'success' would be
    a lie that a dropped webhook turns into a delivered order nobody paid for.
    """
    order_uuid = to_valid_uuid(order_id)
    if not order_uuid:
        raise HTTPException(400, detail={"code": "VALIDATION_ERROR", "message": "order_id must be a UUID."})

    pool = get_pool()
    order = await pool.fetchrow(
        """SELECT o.id, o.user_id, o.status, o.total_amount, o.razorpay_order_id,
                  o.razorpay_payment_id, p.status AS payment_status
             FROM orders o
             LEFT JOIN LATERAL (
                SELECT status FROM payments
                 WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1
             ) p ON TRUE
            WHERE o.id = $1::uuid""",
        order_uuid,
    )
    if not order:
        raise HTTPException(404, detail={"code": "ORDER_NOT_FOUND", "message": "Order not found."})
    if str(order["user_id"]) != str(user["id"]) and user["role"] != "admin":
        raise HTTPException(404, detail={"code": "ORDER_NOT_FOUND", "message": "Order not found."})

    payment_status_value = order["payment_status"]
    if order["status"] == "paid" or payment_status_value == "success":
        effective = "success"
    elif order["status"] == "cancelled":
        effective = "cancelled"
    elif payment_status_value == "failed":
        effective = "failed"
    elif payment_status_value == "refunded" or payment_status_value == "partially_refunded":
        effective = payment_status_value
    elif order["razorpay_payment_id"]:
        # A payment id with no captured status means the signature came back but
        # the capture has not been confirmed yet.
        effective = "pending_verification"
    else:
        effective = "created"

    # A pending order whose gateway window has closed cannot be paid any more;
    # the sweep will have released its stock. Saying so stops the frontend from
    # showing a "try again" button that cannot succeed.
    expired = False
    if effective in ("created", "pending_verification"):
        expired = await pool.fetchval(
            "SELECT expires_at IS NOT NULL AND expires_at < NOW() FROM orders WHERE id = $1::uuid",
            order_uuid,
        )

    return {
        "success": True,
        "data": {
            "order_id": str(order["id"]),
            "order_status": order["status"],
            "payment_status": payment_status_value,
            "effective_status": effective,
            "amount": float(order["total_amount"]),
            "razorpay_order_id": order["razorpay_order_id"],
            "razorpay_payment_id": order["razorpay_payment_id"],
            "expired": bool(expired),
            "can_retry": effective in ("created", "failed", "pending_verification") and not expired,
        },
    }


# ── the webhook ──────────────────────────────────────────────────────────────

@router.post("/webhook")
async def razorpay_webhook(request: Request) -> Response:
    """
    Razorpay's account of what happened, which outranks anything the browser says.

    Signature is checked against the raw body before it is parsed, and the parse
    failure is a 400 -- a body that will not parse cannot be signed by Razorpay
    either, so treating it as an error is safe and treating it as a duplicate
    would be a way to make the endpoint quiet.
    """
    raw_body = await request.body()
    received_sig = request.headers.get("X-Razorpay-Signature", "").strip()

    if not gateway.verify_webhook_signature(raw_body, received_sig):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_SIGNATURE", "message": "Invalid webhook signature."},
        )

    try:
        payload = json.loads(raw_body)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_JSON", "message": "Malformed JSON payload."},
        )

    event_id = payload.get("event_id") or payload.get("id")
    event_type = payload.get("event")
    if not event_id or not event_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "MISSING_EVENT_METADATA", "message": "Webhook missing event or event_id."},
        )

    incoming_hash = hashlib.sha256(raw_body).hexdigest()
    pool = get_pool()

    async with pool.acquire() as conn:
        async with conn.transaction():
            inserted_id = await conn.fetchval(
                """INSERT INTO payment_events (event_id, provider, event_type, payload_hash)
                   VALUES ($1, 'razorpay', $2, $3)
                   ON CONFLICT (event_id) DO NOTHING
                   RETURNING event_id;""",
                str(event_id),
                str(event_type),
                incoming_hash,
            )

            if not inserted_id:
                existing_hash = await conn.fetchval(
                    "SELECT payload_hash FROM payment_events WHERE event_id = $1", str(event_id)
                )
                if existing_hash and existing_hash != incoming_hash:
                    logger.warning(
                        "Tampered webhook retry: event_id=%s payload hash differs", event_id
                    )
                    return JSONResponse(
                        status_code=422,
                        content={
                            "success": False,
                            "error": {
                                "code": "PAYLOAD_MISMATCH",
                                "message": "Duplicate event_id with altered payload.",
                            },
                        },
                    )
                # A redelivery. Razorpay retries on a slow response and on a
                # non-2xx, so this is the common case, not the exception.
                return JSONResponse(
                    status_code=200,
                    content={"success": True, "status": "duplicate_ignored"},
                )

            entity = ((payload.get("payload") or {}).get("payment") or {}).get("entity") or {}
            gateway_order_id = entity.get("order_id")
            gateway_payment_id = entity.get("id")

            if not gateway_order_id:
                # Nothing to match on. Acknowledged, because a 400 here would make
                # Razorpay retry an event we will never be able to apply.
                logger.warning("Razorpay %s with no order_id: %s", event_type, gateway_payment_id)
                return JSONResponse(
                    status_code=200,
                    content={"success": True, "status": "unmatched"},
                )

            if event_type == "payment.captured":
                if not await _apply_capture(conn, gateway_order_id, gateway_payment_id, payload):
                    # No order of ours carries that gateway order id. Saying so
                    # back is what makes this diagnosable from Razorpay's
                    # dashboard, where a silent 200 looks exactly like a handled
                    # event.
                    logger.error(
                        "payment.captured for a gateway order we do not have: %s / %s",
                        gateway_order_id, gateway_payment_id,
                    )
                    return JSONResponse(
                        status_code=200,
                        content={"success": True, "status": "unmatched", "gateway_order_id": gateway_order_id},
                    )
            elif event_type == "payment.failed":
                await _apply_failure(conn, gateway_order_id, gateway_payment_id, payload)
            elif event_type.startswith("refund."):
                await _apply_refund_event(conn, event_type, payload)
            else:
                logger.info("Razorpay event %s recorded, no transition defined", event_type)

    return JSONResponse(
        status_code=200,
        content={"success": True, "status": "processed", "event_id": event_id},
    )


async def _apply_capture(conn, gateway_order_id: str, gateway_payment_id: str | None, payload: dict) -> bool:
    """
    Marks an order paid. Idempotent, and safe to race confirm-payment.

    The match is on orders.razorpay_order_id, which is the only column that holds
    a real gateway order id. provider_ref is *also* written with it, but matching
    on it would mean the webhook's correctness depends on a column that other code
    also writes -- and it did, with a fabricated value, which is why this used to
    match nothing at all.

    The `status = 'pending'` guard is what makes it idempotent: a second delivery,
    or confirm-payment arriving first, finds no pending order to move.

    Returns whether this order was moved. False covers both "no such order" and
    "already past pending" -- the caller logs the difference, because the two mean
    very different things when somebody is reconciling a payment.
    """
    order_id = await conn.fetchval(
        "UPDATE orders SET status = 'paid', razorpay_payment_id = $1, updated_at = CURRENT_TIMESTAMP "
        "WHERE razorpay_order_id = $2 AND status = 'pending' RETURNING id",
        gateway_payment_id, gateway_order_id,
    )
    if not order_id:
        # Already paid, or cancelled before the money arrived. Both are states the
        # customer should not be charged for quietly -- a capture on a cancelled
        # order needs a refund, and that is a person's job, not a retry's.
        status_now = await conn.fetchval(
            "SELECT status FROM orders WHERE razorpay_order_id = $1", gateway_order_id
        )
        if status_now is None:
            logger.warning(
                "payment.captured for gateway order %s, which matches no order of ours (payment %s)",
                gateway_order_id, gateway_payment_id,
            )
        else:
            logger.warning(
                "payment.captured for order %s in state %s; not marking paid",
                gateway_order_id, status_now,
            )
        return False

    await conn.execute(
        """UPDATE payments
              SET status = 'success', provider_ref = COALESCE($1, provider_ref),
                  provider_payload = $2::jsonb, updated_at = CURRENT_TIMESTAMP
            WHERE order_id = $3::uuid AND status <> 'success'""",
        gateway_payment_id, json.dumps(payload), order_id,
    )
    await _after_paid(conn, order_id, "Razorpay confirmed the payment")
    return True


async def _apply_failure(conn, gateway_order_id: str, gateway_payment_id: str | None, payload: dict) -> None:
    """
    A failed attempt. The order stays pending and can be paid again.

    Deliberately not cancelling the order: the customer closing a modal or a bank
    declining is not a cancellation, and treating it as one would release stock
    they may be about to buy.
    """
    order_id = await conn.fetchval(
        "SELECT id FROM orders WHERE razorpay_order_id = $1", gateway_order_id
    )
    if not order_id:
        return
    await conn.execute(
        """UPDATE payments
              SET status = 'failed', provider_payload = $1::jsonb, updated_at = CURRENT_TIMESTAMP
            WHERE order_id = $2::uuid AND status NOT IN ('success', 'refunded', 'partially_refunded')""",
        json.dumps(payload), order_id,
    )
    await conn.execute(
        "INSERT INTO order_status_history (order_id, status, note) "
        "VALUES ($1::uuid, 'pending', $2)",
        order_id,
        f"Payment attempt failed ({gateway_payment_id or 'no id'}). The order can be paid again.",
    )


async def _apply_refund_event(conn, event_type: str, payload: dict) -> None:
    """refund.processed / refund.failed, matched on the gateway's refund id."""
    entity = ((payload.get("payload") or {}).get("refund") or {}).get("entity") or {}
    gateway_refund_id = entity.get("id")
    if not gateway_refund_id:
        return
    if event_type == "refund.processed":
        await conn.execute(
            "UPDATE refunds SET status = 'processed', updated_at = NOW(), processed_at = NOW() "
            "WHERE gateway_refund_id = $1",
            gateway_refund_id,
        )
    else:
        await conn.execute(
            "UPDATE refunds SET status = 'failed', failure_reason = $2, updated_at = NOW() "
            "WHERE gateway_refund_id = $1",
            gateway_refund_id, entity.get("error_description") or "refund failed at the gateway",
        )
    # The order's payment summary follows the refund, so an admin is not looking
    # at 'success' next to a refunded order.
    await _sync_payment_refund_status(conn, gateway_refund_id)


async def _sync_payment_refund_status(conn, gateway_refund_id: str) -> None:
    """
    Re-derives the payment's and order's state after a refund the gateway told us
    about. Only acts once the refund itself is 'processed' -- a refund sitting in
    'processing' has not moved money, and reading it as settled would be a lie
    the customer pays for.
    """
    row = await conn.fetchrow(
        "SELECT order_id, payment_id, status FROM refunds WHERE gateway_refund_id = $1",
        gateway_refund_id,
    )
    if not row or not row["payment_id"] or row["status"] != "processed":
        return
    payment = await conn.fetchrow(
        "SELECT amount FROM payments WHERE id = $1::uuid", row["payment_id"]
    )
    if not payment:
        return
    await _settle_refund(conn, row["order_id"], row["payment_id"], payment["amount"])


async def _settle_refund(conn, order_id, payment_id, paid_amount) -> None:
    """
    Once money has gone back, make the payment and the order agree about it.

    Shared by the two places a refund can land -- the synchronous route, and the
    refund.processed webhook for one the gateway took its time over -- because
    the two used to disagree: the route set the payment to 'partially_refunded'
    and never 'refunded', so a fully-refunded order sat in the admin's list with a
    payment still claiming success. One function is the only way two paths cannot
    end up disagreeing.

    A full refund cancels the order and returns its stock. The goods are coming
    back, so leaving it 'paid' would have it sitting in the seller's fulfilment
    queue forever, and the stock it holds would stay sold.
    """
    total = await conn.fetchval(
        "SELECT COALESCE(SUM(amount), 0) FROM refunds "
        "WHERE order_id = $1::uuid AND status = 'processed'",
        order_id,
    )
    # The half-paisa slack is the same tolerance create_refund allows, so a full
    # refund split into two halves that each round a fraction of a rupee is still
    # recognised as full rather than leaving the order permanently a rupee short.
    fully_refunded = float(total or 0) >= float(paid_amount) - 0.005

    await conn.execute(
        "UPDATE payments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2::uuid",
        "refunded" if fully_refunded else "partially_refunded",
        payment_id,
    )
    if not fully_refunded:
        return

    moved = await conn.fetchval(
        "UPDATE orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP "
        "WHERE id = $1::uuid AND status IN ('paid', 'processing') RETURNING id",
        order_id,
    )
    if not moved:
        # Already cancelled, or the customer cancelled before the refund. Either
        # way the stock is back and the history row exists; doing it again would
        # return the stock twice.
        return
    await conn.execute(
        "INSERT INTO order_status_history (order_id, status, note) "
        "VALUES ($1::uuid, 'cancelled', 'Fully refunded')",
        order_id,
    )
    await restore_stock(conn, order_id)
    await conn.execute(
        "UPDATE carts SET updated_at = CURRENT_TIMESTAMP "
        "WHERE user_id = (SELECT user_id FROM orders WHERE id = $1::uuid)",
        order_id,
    )


async def _after_paid(conn, order_id: UUID, note: str) -> None:
    """
    Everything that happens once, when an order becomes paid.

    Called from whichever path got there first, guarded by the same UPDATE that
    moved the order out of 'pending' -- so the notification, the purchase
    interactions and the history row cannot be written twice for one payment.
    """
    await conn.execute(
        "INSERT INTO order_status_history (order_id, status, note) VALUES ($1::uuid, 'paid', $2)",
        order_id, note,
    )
    row = await conn.fetchrow("SELECT user_id FROM orders WHERE id = $1::uuid", order_id)
    if row:
        # $2 is the short form a person reads, $3 the full id the order page is
        # addressed by. They are different strings, so they are different
        # parameters -- the previous version reused one slot for both and the
        # notification linked to an order that does not exist.
        await conn.execute(
            """INSERT INTO notifications (user_id, type, title, body, link)
               VALUES ($1, 'order_confirmed', 'Order Confirmed!',
                       'Payment received for order #' || $2 || '. It is being prepared.',
                       '/orders/' || $3)""",
            row["user_id"], str(order_id)[:8], str(order_id),
        )
    for item in await conn.fetch(
        "SELECT product_id FROM order_items WHERE order_id = $1::uuid", order_id
    ):
        await conn.execute(
            "INSERT INTO user_interactions (user_id, product_id, event_type) "
            "VALUES ($1, $2, 'purchase')",
            row["user_id"], item["product_id"],
        )


# ── refunds ──────────────────────────────────────────────────────────────────

class CreateRefundBody(BaseModel):
    order_id: str
    amount: float = Field(gt=0)
    reason: str = "customer_request"
    notes: str | None = None


@router.post("/refunds", status_code=201)
async def create_refund(
    body: CreateRefundBody,
    user: dict = Depends(require_role(["admin"])),
    _rl=Depends(_limit("payments.refund")),
) -> dict:
    """
    Refunds money, against a payment, and records it.

    The amount is checked against what is actually left, not against the order
    total -- an order refunded twice must not be able to send the money back
    twice, and the order total does not know about the first refund.
    """
    order_uuid = to_valid_uuid(body.order_id)
    if not order_uuid:
        raise HTTPException(400, detail={"code": "VALIDATION_ERROR", "message": "order_id must be a UUID."})

    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            order = await conn.fetchrow(
                """SELECT o.id, o.user_id, o.status, o.total_amount,
                          p.id AS payment_id, p.status AS payment_status, p.amount AS paid_amount
                     FROM orders o
                     JOIN payments p
                       ON p.order_id = o.id
                      -- 'partially_refunded' is a payment that still has money
                      -- in it. Matching only on 'success' meant the first partial
                      -- refund made the order permanently unrefundable, because
                      -- the lookup for the second one found no row at all.
                      AND p.status IN ('success', 'partially_refunded')
                    WHERE o.id = $1::uuid
                    ORDER BY p.created_at DESC LIMIT 1""",
                order_uuid,
            )
            if not order:
                raise HTTPException(
                    404,
                    detail={"code": "NO_REFUNDABLE_PAYMENT",
                            "message": "This order has no successful payment to refund."},
                )

            already = await conn.fetchval(
                "SELECT COALESCE(SUM(amount), 0) FROM refunds "
                "WHERE order_id = $1::uuid AND status IN ('requested', 'approved', 'processing', 'processed')",
                order_uuid,
            )
            remaining = float(order["paid_amount"]) - float(already)
            if float(body.amount) > remaining + 0.005:
                raise HTTPException(
                    400,
                    detail={
                        "code": "REFUND_EXCEEDS_REMAINING",
                        "message": f"Only ₹{remaining:.2f} of this payment is still refundable.",
                        "data": {"refundable": round(remaining, 2)},
                    },
                )

            refund = await conn.fetchrow(
                """INSERT INTO refunds (order_id, payment_id, amount, reason, status,
                                        gateway, requested_by, provider_payload)
                   VALUES ($1::uuid, $2::uuid, $3, $4, 'requested', 'razorpay', $5::uuid,
                           jsonb_build_object('notes', $6::text))
                   RETURNING id, amount, status, reason, created_at""",
                order_uuid, order["payment_id"], body.amount, body.reason,
                user["id"], body.notes or "",
            )

    if not gateway.is_configured:
        # Recorded as a request rather than done. An admin asking for a refund
        # against a deployment with no keys is a fact to preserve, and the refund
        # can be sent from the dashboard once the keys exist.
        return {
            "success": True,
            "message": "Refund recorded as requested. No gateway keys are configured, so no money has moved.",
            "data": _refund_dict(refund) | {"gateway_called": False},
        }

    try:
        gateway_refund = await gateway.create_refund(
            payment_id=await pool.fetchval(
                "SELECT provider_ref FROM payments WHERE id = $1::uuid", order["payment_id"]
            ),
            amount=body.amount,
            notes={"refund_id": str(refund["id"]), "order_id": str(order_uuid)},
        )
    except GatewayError as exc:
        logger.error("Razorpay refund failed for %s: %s", order_uuid, exc)
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE refunds SET status = 'failed', failure_reason = $2, updated_at = NOW() "
                "WHERE id = $1::uuid",
                refund["id"], str(exc),
            )
        raise HTTPException(
            502,
            detail={"code": "GATEWAY_ERROR", "message": "The refund was recorded but the gateway refused it."},
        ) from exc

    async with pool.acquire() as conn:
        async with conn.transaction():
            settled = gateway_refund.get("status") == "processed"
            # processed_at is passed rather than computed with a CASE on the same
            # placeholder as the status: varchar and text in one expression makes
            # Postgres infer two different types for $4 and refuse the query.
            row = await conn.fetchrow(
                "UPDATE refunds SET status = $4::varchar, gateway_refund_id = $2, processed_by = $3::uuid, "
                "processed_at = $5::timestamptz, updated_at = NOW() WHERE id = $1::uuid RETURNING *",
                refund["id"], gateway_refund.get("id"), user["id"],
                "processed" if settled else "processing",
                datetime.now(timezone.utc) if settled else None,
            )
            if settled:
                # The gateway has the money on its way back, so the order and the
                # payment can be corrected now. When it has not, the
                # refund.processed webhook does this instead -- and says so by
                # leaving the refund 'processing' rather than guessing.
                await _settle_refund(conn, order_uuid, order["payment_id"], order["paid_amount"])

    return {
        "success": True,
        "message": "Refund sent to the gateway.",
        "data": _refund_dict(row) | {"gateway_called": True},
    }


@router.get("/refunds")
async def list_refunds(
    order_id: str | None = None,
    status_filter: str | None = None,
    user: dict = Depends(require_role(["admin"])),
) -> dict:
    """
    The refunds list, for the admin's money page.

    Keyed on the order's gateway payment id so the filter matches the column the
    table is indexed on rather than the one a reader expects.
    """
    clauses, params = [], []
    if order_id:
        params.append(to_valid_uuid(order_id))
        clauses.append(f"r.order_id = ${len(params)}::uuid")
    if status_filter and status_filter != "all":
        params.append(status_filter)
        clauses.append(f"r.status = ${len(params)}")

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    pool = get_pool()
    rows = await pool.fetch(
        f"""SELECT r.id, r.order_id, r.amount, r.reason, r.status, r.gateway,
                   r.gateway_refund_id, r.failure_reason, r.created_at, r.processed_at,
                   o.total_amount AS order_total, o.status AS order_status
              FROM refunds r JOIN orders o ON o.id = r.order_id
              {where}
             ORDER BY r.created_at DESC LIMIT 200""",
        *params,
    )
    return {
        "success": True,
        "data": {
            "refunds": [
                {**dict(r), "amount": float(r["amount"]), "order_total": float(r["order_total"])}
                for r in rows
            ]
        },
    }


def _refund_dict(row) -> dict:
    d = dict(row)
    if "amount" in d:
        d["amount"] = float(d["amount"])
    return d


async def restore_stock(conn, order_id: UUID) -> None:
    """
    Gives back what an order took out of stock.

    Every order decrements under a row lock and nothing put it back until now, so
    an abandoned or cancelled order was inventory the catalogue would not sell for
    as long as the order row survived. Restoring from order_items rather than a
    stored "previous stock" is deliberate: the order line records what was
    *taken*, which is the only figure that is still true, whereas a saved copy of
    the old value goes stale the moment anyone else sells a unit.

    A line whose option no longer exists cannot be restored, and is reported
    rather than skipped. That case is reachable -- order_items.variant_id is ON
    DELETE SET NULL, so hard-deleting an option nulls the line -- and crediting
    the quantity to the product instead would be worse than doing nothing: on a
    product with options the trigger maintains that column from the options, so
    the total would be inflated until somebody next edited a row, and the fix
    would look like a stock discrepancy with no cause.
    """
    lines = await conn.fetch(
        """SELECT oi.product_id, oi.variant_id, oi.quantity, oi.sku_at_purchase,
                  oi.variant_snapshot, p.has_variants
             FROM order_items oi
             JOIN products p ON p.id = oi.product_id
            WHERE oi.order_id = $1::uuid""",
        order_id,
    )
    for line in lines:
        if line["variant_id"]:
            result = await conn.execute(
                """UPDATE product_variants
                      SET stock_qty = stock_qty + $1, updated_at = CURRENT_TIMESTAMP
                    WHERE id = $2::uuid""",
                line["quantity"], line["variant_id"],
            )
            if result.endswith("0"):
                logger.warning(
                    "Could not restore stock for order %s: option %s is gone (line was %s x %s)",
                    order_id, line["variant_id"], line["quantity"],
                    line["variant_snapshot"] or line["sku_at_purchase"],
                )
                continue
        elif line["has_variants"]:
            # The line named an option, the option is gone, and the product is
            # still a variant product. There is no correct row to add to.
            logger.warning(
                "Could not restore stock for order %s: the option for %s x %s (%s) has been deleted, "
                "and the product's total is derived from its options",
                order_id, line["quantity"], line["product_id"],
                line["variant_snapshot"] or line["sku_at_purchase"],
            )
            continue
        else:
            await conn.execute(
                "UPDATE products SET stock_qty = stock_qty + $1, updated_at = CURRENT_TIMESTAMP "
                "WHERE id = $2",
                line["quantity"], line["product_id"],
            )
        # The product's own row is a trigger's job when it has options; for a
        # plain product the status has to be walked back out of out_of_stock.
        await conn.execute(
            "UPDATE products SET status = 'active', updated_at = CURRENT_TIMESTAMP "
            "WHERE id = $1 AND status = 'out_of_stock'",
            line["product_id"],
        )
