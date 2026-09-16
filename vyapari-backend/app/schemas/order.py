"""
Vyapari — Order Pydantic Schemas
"""
from __future__ import annotations

from uuid import UUID

from pydantic import Field

from app.models.order import OrderStatus, PaymentMethod
from app.schemas.common import VyapariBaseModel


# ── Cart ──────────────────────────────────────────────────────────────────────

class CartItemRead(VyapariBaseModel):
    id: UUID
    product_id: UUID
    variant_id: UUID | None
    qty: int
    saved_for_later: bool
    # Denormalized for frontend convenience
    product_name: str | None = None
    product_price: float | None = None
    primary_image_url: str | None = None


class CartRead(VyapariBaseModel):
    id: UUID
    items: list[CartItemRead] = []
    subtotal: float = 0.0


class CartItemAdd(VyapariBaseModel):
    product_id: UUID
    variant_id: UUID | None = None
    qty: int = Field(ge=1, default=1)


class CartItemUpdate(VyapariBaseModel):
    qty: int | None = Field(default=None, ge=0)  # 0 = remove
    saved_for_later: bool | None = None


# ── Address ───────────────────────────────────────────────────────────────────

class AddressCreate(VyapariBaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    phone: str = Field(min_length=10, max_length=15)
    line1: str = Field(min_length=1, max_length=255)
    line2: str | None = None
    city: str = Field(min_length=1, max_length=100)
    state: str = Field(min_length=1, max_length=100)
    pincode: str = Field(pattern=r"^\d{6}$")
    country: str = "India"
    is_default: bool = False


class AddressRead(AddressCreate):
    id: UUID
    user_id: UUID


# ── Checkout & Orders ─────────────────────────────────────────────────────────

class CheckoutRequest(VyapariBaseModel):
    shipping_address_id: UUID
    payment_method: PaymentMethod
    coupon_code: str | None = None


class OrderItemRead(VyapariBaseModel):
    id: UUID
    product_id: UUID
    seller_id: UUID
    variant_id: UUID | None
    qty: int
    unit_price: float
    product_name: str


class PaymentRead(VyapariBaseModel):
    id: UUID
    gateway_ref: str | None
    gateway_order_id: str | None
    status: str
    amount: float
    method: str


class OrderRead(VyapariBaseModel):
    id: UUID
    status: OrderStatus
    total_amount: float
    discount_amount: float
    shipping_address: dict
    tracking_number: str | None
    logistics_provider: str | None
    items: list[OrderItemRead] = []
    payment: PaymentRead | None = None


class OrderStatusUpdate(VyapariBaseModel):
    status: OrderStatus
    tracking_number: str | None = None
    logistics_provider: str | None = None


# ── Razorpay Webhook ──────────────────────────────────────────────────────────

class RazorpayWebhookPayload(VyapariBaseModel):
    """Incoming webhook from Razorpay — minimal validated fields."""
    event: str
    payload: dict
