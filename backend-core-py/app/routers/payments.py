"""
Payments Router — Razorpay Webhook Ingestion & State Transitions

POST /api/payments/webhook
"""
import hashlib
import hmac
import logging
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse

from app.config import settings
from app.db import get_pool

logger = logging.getLogger("vyapari-payments")
router = APIRouter()


@router.post("/webhook")
async def razorpay_webhook(request: Request) -> Response:
    raw_body = await request.body()
    received_sig = request.headers.get("X-Razorpay-Signature", "").strip()

    # 1. Cryptographic HMAC-SHA256 signature verification
    webhook_secret = settings.RAZORPAY_WEBHOOK_SECRET or settings.RAZORPAY_KEY_SECRET or "test_secret"
    expected_sig = hmac.new(
        key=webhook_secret.encode("utf-8"),
        msg=raw_body,
        digestmod=hashlib.sha256,
    ).hexdigest()

    if not received_sig or not hmac.compare_digest(expected_sig, received_sig):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_SIGNATURE", "message": "Invalid webhook signature."},
        )

    try:
        payload = await request.json()
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
            # 2. Atomic Event Deduplication via PostgreSQL
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
                # Duplicate delivery: verify payload hash to detect tampering
                existing_hash = await conn.fetchval(
                    "SELECT payload_hash FROM payment_events WHERE event_id = $1", str(event_id)
                )
                if existing_hash and existing_hash != incoming_hash:
                    logger.warning(
                        f"Tampered webhook retry detected: event_id={event_id} has mismatched payload hash!"
                    )
                    return JSONResponse(
                        status_code=422,
                        content={"success": False, "error": {"code": "PAYLOAD_MISMATCH", "message": "Duplicate event_id with altered payload."}},
                    )
                return JSONResponse(
                    status_code=200,
                    content={"success": True, "status": "duplicate_ignored"},
                )

            # 3. State Machine Transitions based on Event Type
            if event_type == "payment.captured":
                payment_entity = (payload.get("payload") or {}).get("payment", {}).get("entity", {})
                provider_order_id = payment_entity.get("order_id")
                provider_payment_id = payment_entity.get("id")

                if provider_order_id:
                    # Authoritative match against razorpay_order_id / payments table
                    await conn.execute(
                        """UPDATE orders
                           SET status = 'paid', updated_at = CURRENT_TIMESTAMP, razorpay_payment_id = $1
                           WHERE (razorpay_order_id = $2 OR id::text = $2) AND status = 'pending';""",
                        provider_payment_id,
                        provider_order_id,
                    )
                    await conn.execute(
                        """UPDATE payments
                           SET status = 'success', provider_ref = $1, provider_payload = $2::jsonb, updated_at = CURRENT_TIMESTAMP
                           WHERE provider_ref = $3 OR order_id::text = $3;""",
                        provider_payment_id,
                        payload,
                        provider_order_id,
                    )

            elif event_type == "payment.failed":
                payment_entity = (payload.get("payload") or {}).get("payment", {}).get("entity", {})
                provider_order_id = payment_entity.get("order_id")
                if provider_order_id:
                    await conn.execute(
                        """UPDATE payments
                           SET status = 'failed', provider_payload = $1::jsonb, updated_at = CURRENT_TIMESTAMP
                           WHERE provider_ref = $2;""",
                        payload,
                        provider_order_id,
                    )

    return JSONResponse(
        status_code=200,
        content={"success": True, "status": "processed", "event_id": event_id},
    )
