"""
Vyapari — Customer Profile Model
"""
from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import BaseModel, JSON_TYPE, UUID_TYPE


class CustomerProfile(BaseModel):
    __tablename__ = "customer_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE,
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    # FK to addresses table — stored as UUID; relation omitted for conciseness
    default_address_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID_TYPE, nullable=True
    )
    # Stored as JSON: {"preferred_categories": [...], "price_affinity": "medium"}
    preferences: Mapped[dict] = mapped_column(JSON_TYPE, default=dict, nullable=False)

    # ── Relationships ─────────────────────────────────────────────────────────
    user: Mapped["User"] = relationship(  # noqa: F821
        "User", back_populates="customer_profile"
    )
    orders: Mapped[list["Order"]] = relationship(  # noqa: F821
        "Order", back_populates="customer", lazy="select"
    )
    reviews: Mapped[list["Review"]] = relationship(  # noqa: F821
        "Review", back_populates="customer", lazy="select"
    )
    cart: Mapped["Cart"] = relationship(  # noqa: F821
        "Cart", back_populates="customer", uselist=False, lazy="select"
    )
    wishlist: Mapped["Wishlist"] = relationship(  # noqa: F821
        "Wishlist", back_populates="customer", uselist=False, lazy="select"
    )
