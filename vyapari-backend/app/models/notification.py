"""
Vyapari — Notification Model
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import BaseModel, JSON_TYPE, UUID_TYPE


class NotificationType(str, enum.Enum):
    order_confirmed = "order_confirmed"
    order_shipped = "order_shipped"
    order_delivered = "order_delivered"
    order_cancelled = "order_cancelled"
    payment_received = "payment_received"
    kyc_approved = "kyc_approved"
    kyc_rejected = "kyc_rejected"
    low_stock = "low_stock"
    price_drop = "price_drop"
    restock = "restock"
    review_posted = "review_posted"
    promo = "promo"


class Notification(BaseModel):
    __tablename__ = "notifications"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type: Mapped[NotificationType] = mapped_column(
        Enum(NotificationType, name="notificationtype"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    # Arbitrary data for rendering the notification on the frontend
    payload: Mapped[dict] = mapped_column(JSON_TYPE, default=dict, nullable=False)

    read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user: Mapped["User"] = relationship("User", back_populates="notifications")  # noqa: F821
