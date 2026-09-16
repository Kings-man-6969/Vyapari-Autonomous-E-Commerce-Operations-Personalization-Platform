"""
Vyapari — Order & Commerce Models
Covers: Cart, CartItem, Wishlist, WishlistItem, Address,
        Order, OrderItem, Payment, Payout, Coupon.
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import BaseModel, JSON_TYPE, UUID_TYPE


# ── Address ───────────────────────────────────────────────────────────────────

class Address(BaseModel):
    __tablename__ = "addresses"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    line1: Mapped[str] = mapped_column(String(255), nullable=False)
    line2: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[str] = mapped_column(String(100), nullable=False)
    pincode: Mapped[str] = mapped_column(String(10), nullable=False)
    country: Mapped[str] = mapped_column(String(60), default="India", nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)



# ── Cart ──────────────────────────────────────────────────────────────────────

class Cart(BaseModel):
    __tablename__ = "carts"

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE,
        ForeignKey("customer_profiles.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    customer: Mapped["CustomerProfile"] = relationship(  # noqa: F821
        "CustomerProfile", back_populates="cart"
    )
    items: Mapped[list["CartItem"]] = relationship(
        "CartItem", back_populates="cart", cascade="all, delete-orphan"
    )


class CartItem(BaseModel):
    __tablename__ = "cart_items"

    cart_id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE, ForeignKey("carts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE, ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )
    variant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID_TYPE, ForeignKey("product_variants.id", ondelete="SET NULL"), nullable=True
    )
    qty: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    saved_for_later: Mapped[bool] = mapped_column(Boolean, default=False)

    cart: Mapped["Cart"] = relationship("Cart", back_populates="items")


# ── Wishlist ──────────────────────────────────────────────────────────────────

class Wishlist(BaseModel):
    __tablename__ = "wishlists"

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE,
        ForeignKey("customer_profiles.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    customer: Mapped["CustomerProfile"] = relationship(  # noqa: F821
        "CustomerProfile", back_populates="wishlist"
    )
    items: Mapped[list["WishlistItem"]] = relationship(
        "WishlistItem", back_populates="wishlist", cascade="all, delete-orphan"
    )


class WishlistItem(BaseModel):
    __tablename__ = "wishlist_items"

    wishlist_id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE, ForeignKey("wishlists.id", ondelete="CASCADE"), nullable=False
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE, ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )

    wishlist: Mapped["Wishlist"] = relationship("Wishlist", back_populates="items")


# ── Order ─────────────────────────────────────────────────────────────────────

class OrderStatus(str, enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    processing = "processing"
    shipped = "shipped"
    delivered = "delivered"
    cancelled = "cancelled"
    return_requested = "return_requested"
    returned = "returned"
    refunded = "refunded"


class Order(BaseModel):
    __tablename__ = "orders"

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE,
        ForeignKey("customer_profiles.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, name="orderstatus"),
        default=OrderStatus.pending,
        nullable=False,
        index=True,
    )
    total_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    # Snapshot of the shipping address at order time (JSON_TYPE avoids stale FK issues)
    shipping_address: Mapped[dict] = mapped_column(JSON_TYPE, nullable=False)
    coupon_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    discount_amount: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    # Logistics
    tracking_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    logistics_provider: Mapped[str | None] = mapped_column(String(100), nullable=True)

    customer: Mapped["CustomerProfile"] = relationship(  # noqa: F821
        "CustomerProfile", back_populates="orders"
    )
    items: Mapped[list["OrderItem"]] = relationship(
        "OrderItem", back_populates="order", cascade="all, delete-orphan"
    )
    payment: Mapped["Payment"] = relationship(
        "Payment", back_populates="order", uselist=False
    )


class OrderItem(BaseModel):
    __tablename__ = "order_items"

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False
    )
    seller_id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE, ForeignKey("seller_profiles.id", ondelete="RESTRICT"), nullable=False
    )
    variant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID_TYPE, ForeignKey("product_variants.id", ondelete="SET NULL"), nullable=True
    )
    qty: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    # Snapshot of product name at order time
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)

    order: Mapped["Order"] = relationship("Order", back_populates="items")


# ── Payment ───────────────────────────────────────────────────────────────────

class PaymentStatus(str, enum.Enum):
    pending = "pending"
    captured = "captured"
    failed = "failed"
    refunded = "refunded"


class PaymentMethod(str, enum.Enum):
    razorpay = "razorpay"
    cod = "cod"
    wallet = "wallet"


class Payment(BaseModel):
    __tablename__ = "payments"

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE,
        ForeignKey("orders.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    gateway_ref: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    gateway_order_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, name="paymentstatus"), default=PaymentStatus.pending
    )
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    method: Mapped[PaymentMethod] = mapped_column(
        Enum(PaymentMethod, name="paymentmethod"), nullable=False
    )
    gateway_response: Mapped[dict] = mapped_column(JSON_TYPE, default=dict)

    order: Mapped["Order"] = relationship("Order", back_populates="payment")


# ── Payout ────────────────────────────────────────────────────────────────────

class PayoutStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    settled = "settled"
    failed = "failed"


class Payout(BaseModel):
    __tablename__ = "payouts"

    seller_id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE,
        ForeignKey("seller_profiles.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    status: Mapped[PayoutStatus] = mapped_column(
        Enum(PayoutStatus, name="payoutstatus"), default=PayoutStatus.pending
    )
    settlement_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reference: Mapped[str | None] = mapped_column(String(200), nullable=True)

    seller: Mapped["SellerProfile"] = relationship("SellerProfile", back_populates="payouts")  # noqa: F821


# ── Coupon ────────────────────────────────────────────────────────────────────

class DiscountType(str, enum.Enum):
    percentage = "percentage"
    flat = "flat"


class Coupon(BaseModel):
    __tablename__ = "coupons"

    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    discount_type: Mapped[DiscountType] = mapped_column(
        Enum(DiscountType, name="discounttype"), nullable=False
    )
    value: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    min_order_value: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    max_discount: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    valid_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    valid_to: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    usage_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    usage_count: Mapped[int] = mapped_column(Integer, default=0)
    # Null = platform-wide coupon; set = seller-specific
    seller_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID_TYPE,
        ForeignKey("seller_profiles.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
