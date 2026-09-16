"""
Vyapari — Customer: Orders Router
POST /api/v1/customer/orders/checkout
GET  /api/v1/customer/orders
GET  /api/v1/customer/orders/{order_id}
POST /api/v1/customer/orders/{order_id}/cancel
POST /api/v1/customer/orders/{order_id}/pay  → Razorpay order creation
POST /api/v1/customer/orders/{order_id}/capture → payment verification
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Body, Depends

from app.core.dependencies import AsyncSessionDep, CurrentUserIdDep, CustomerDep
from app.schemas.order import CheckoutRequest, OrderRead
from app.services.order_service import OrderService
from app.services.payment_service import PaymentService

router = APIRouter(prefix="/customer/orders", tags=["customer-orders"])


def _order_svc(db: AsyncSessionDep) -> OrderService:
    return OrderService(db)


def _pay_svc(db: AsyncSessionDep) -> PaymentService:
    return PaymentService(db)


@router.post("/checkout", response_model=OrderRead, status_code=201)
async def checkout(
    data: CheckoutRequest,
    user_id: CurrentUserIdDep,
    _: CustomerDep,
    svc: OrderService = Depends(_order_svc),
) -> OrderRead:
    """Create an order from the customer's cart."""
    return await svc.checkout(user_id, data)


@router.get("", response_model=list[OrderRead])
async def list_orders(
    user_id: CurrentUserIdDep,
    _: CustomerDep,
    svc: OrderService = Depends(_order_svc),
) -> list[OrderRead]:
    return await svc.get_customer_orders(user_id)


@router.get("/{order_id}", response_model=OrderRead)
async def get_order(
    order_id: UUID,
    user_id: CurrentUserIdDep,
    _: CustomerDep,
    svc: OrderService = Depends(_order_svc),
) -> OrderRead:
    return await svc.get_order(user_id, order_id)


@router.post("/{order_id}/cancel", response_model=OrderRead)
async def cancel_order(
    order_id: UUID,
    user_id: CurrentUserIdDep,
    _: CustomerDep,
    svc: OrderService = Depends(_order_svc),
) -> OrderRead:
    return await svc.cancel_order(user_id, order_id)


@router.post("/{order_id}/pay")
async def initiate_payment(
    order_id: UUID,
    user_id: CurrentUserIdDep,
    _: CustomerDep,
    pay_svc: PaymentService = Depends(_pay_svc),
) -> dict:
    """Creates a Razorpay order. Returns razorpay_order_id for frontend checkout."""
    return await pay_svc.create_razorpay_order(order_id)


@router.post("/{order_id}/capture")
async def capture_payment(
    order_id: UUID,
    user_id: CurrentUserIdDep,
    _: CustomerDep,
    razorpay_payment_id: str = Body(...),
    razorpay_order_id: str = Body(...),
    razorpay_signature: str = Body(...),
    pay_svc: PaymentService = Depends(_pay_svc),
) -> dict:
    """Verifies Razorpay signature and marks payment as captured."""
    payment = await pay_svc.capture_payment(
        order_id, razorpay_payment_id, razorpay_order_id, razorpay_signature
    )
    return {"status": payment.status, "message": "Payment captured successfully."}
