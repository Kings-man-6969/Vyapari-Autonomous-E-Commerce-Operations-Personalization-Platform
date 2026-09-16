"""
Vyapari — Payment Service (Razorpay)
Wraps the Razorpay SDK with a clean interface.
"""
from __future__ import annotations

import hashlib
import hmac
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import get_logger
from app.models.order import Order, Payment, PaymentStatus

logger = get_logger(__name__)


class PaymentService:

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self._client = self._build_client()

    def _build_client(self):  # type: ignore[return]
        try:
            import razorpay  # type: ignore[import-untyped]
            return razorpay.Client(
                auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
            )
        except ImportError:
            logger.warning("razorpay package not installed — payment service in stub mode")
            return None

    # ── Create Razorpay Order ─────────────────────────────────────────────────

    async def create_razorpay_order(self, order_id: UUID) -> dict:
        """
        Creates a Razorpay order for the given Vyapari order.
        Returns the Razorpay order object (contains `id` for frontend checkout).
        """
        result = await self.db.execute(
            select(Order).where(Order.id == order_id)
        )
        order = result.scalar_one_or_none()
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")

        payment_result = await self.db.execute(
            select(Payment).where(Payment.order_id == order_id)
        )
        payment = payment_result.scalar_one_or_none()
        if not payment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment record not found.")

        if not self._client:
            # Stub mode
            return {"id": f"stub_rzp_{order_id}", "amount": int(order.total_amount * 100)}

        rzp_order = self._client.order.create({
            "amount": int(order.total_amount * 100),  # paise
            "currency": "INR",
            "receipt": str(order_id),
            "notes": {"vyapari_order_id": str(order_id)},
        })
        payment.gateway_order_id = rzp_order["id"]
        logger.info("razorpay_order_created", rzp_order_id=rzp_order["id"], order_id=str(order_id))
        return rzp_order

    # ── Verify Payment Signature ───────────────────────────────────────────────

    def verify_payment_signature(
        self,
        razorpay_order_id: str,
        razorpay_payment_id: str,
        razorpay_signature: str,
    ) -> bool:
        """Verifies the Razorpay payment signature (HMAC-SHA256)."""
        message = f"{razorpay_order_id}|{razorpay_payment_id}"
        expected = hmac.new(
            settings.RAZORPAY_KEY_SECRET.encode(),
            message.encode(),
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, razorpay_signature)

    # ── Capture Payment ───────────────────────────────────────────────────────

    async def capture_payment(
        self,
        order_id: UUID,
        razorpay_payment_id: str,
        razorpay_order_id: str,
        razorpay_signature: str,
    ) -> Payment:
        """Called after frontend confirms payment. Verifies signature and updates DB."""
        if not self.verify_payment_signature(razorpay_order_id, razorpay_payment_id, razorpay_signature):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid payment signature.",
            )

        result = await self.db.execute(
            select(Payment).where(Payment.order_id == order_id)
        )
        payment = result.scalar_one_or_none()
        if not payment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found.")

        payment.gateway_ref = razorpay_payment_id
        payment.status = PaymentStatus.captured
        payment.gateway_response = {
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_order_id": razorpay_order_id,
            "razorpay_signature": razorpay_signature,
        }

        # Update order status to confirmed
        order_result = await self.db.execute(select(Order).where(Order.id == order_id))
        order = order_result.scalar_one_or_none()
        if order:
            from app.models.order import OrderStatus
            order.status = OrderStatus.confirmed

        logger.info("payment_captured", order_id=str(order_id), payment_id=razorpay_payment_id)
        return payment

    # ── Razorpay Webhook ──────────────────────────────────────────────────────

    def verify_webhook_signature(self, body: bytes, signature: str) -> bool:
        """Verifies incoming Razorpay webhook payload."""
        expected = hmac.new(
            settings.RAZORPAY_WEBHOOK_SECRET.encode(),
            body,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature)
