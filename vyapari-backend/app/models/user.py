"""
Vyapari — User Model
Single users table with role enum covering customer, seller, and admin.
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import BaseModel, UUID_TYPE



class UserRole(str, enum.Enum):
    customer = "customer"
    seller = "seller"
    admin = "admin"


class User(BaseModel):
    __tablename__ = "users"

    # ── Identity ──────────────────────────────────────────────────────────────
    email: Mapped[str | None] = mapped_column(
        String(255), unique=True, index=True, nullable=True
    )
    phone: Mapped[str | None] = mapped_column(
        String(20), unique=True, index=True, nullable=True
    )
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # ── OAuth ─────────────────────────────────────────────────────────────────
    google_sub: Mapped[str | None] = mapped_column(
        String(255), unique=True, index=True, nullable=True
    )  # Google OAuth2 subject identifier

    # ── Role & Status ─────────────────────────────────────────────────────────
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="userrole"),
        default=UserRole.customer,
        nullable=False,
        index=True,
    )
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    customer_profile: Mapped["CustomerProfile"] = relationship(  # noqa: F821
        "CustomerProfile", back_populates="user", uselist=False, lazy="select"
    )
    seller_profile: Mapped["SellerProfile"] = relationship(  # noqa: F821
        "SellerProfile", back_populates="user", uselist=False, lazy="select"
    )
    notifications: Mapped[list["Notification"]] = relationship(  # noqa: F821
        "Notification", back_populates="user", lazy="select"
    )
    user_events: Mapped[list["UserEvent"]] = relationship(  # noqa: F821
        "UserEvent", back_populates="user", lazy="select"
    )
    user_embedding: Mapped["UserEmbedding"] = relationship(  # noqa: F821
        "UserEmbedding", back_populates="user", uselist=False, lazy="select"
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email} role={self.role}>"
