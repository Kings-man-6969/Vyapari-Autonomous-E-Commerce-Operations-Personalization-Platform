"""
Vyapari — Seller Profile Model
Includes Indian KYC fields (GSTIN, PAN) as per spec.
"""
from __future__ import annotations

import enum
import uuid

from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime

from app.db.base import BaseModel, JSON_TYPE, UUID_TYPE


class KYCStatus(str, enum.Enum):
    pending = "pending"
    under_review = "under_review"
    approved = "approved"
    rejected = "rejected"


class SellerProfile(BaseModel):
    __tablename__ = "seller_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE,
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    # ── Business Identity ─────────────────────────────────────────────────────
    business_name: Mapped[str] = mapped_column(String(255), nullable=False)
    store_description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    store_logo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # ── Indian KYC ────────────────────────────────────────────────────────────
    gstin: Mapped[str | None] = mapped_column(
        String(15), nullable=True, index=True
    )  # GST Identification Number (15 chars)
    pan: Mapped[str | None] = mapped_column(
        String(10), nullable=True
    )  # Permanent Account Number (10 chars)

    # ── Bank Details (stored as encrypted JSON; never raw card data) ─────────
    # Keys: account_number, ifsc_code, account_holder_name, bank_name
    bank_account_details: Mapped[dict] = mapped_column(
        JSON_TYPE, default=dict, nullable=False
    )

    # ── Business Address ──────────────────────────────────────────────────────
    # Keys: line1, line2, city, state, pincode, country
    business_address: Mapped[dict] = mapped_column(
        JSON_TYPE, default=dict, nullable=False
    )


    # ── KYC Status ────────────────────────────────────────────────────────────
    kyc_status: Mapped[KYCStatus] = mapped_column(
        Enum(KYCStatus, name="kycstatus"),
        default=KYCStatus.pending,
        nullable=False,
        index=True,
    )
    kyc_rejection_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    user: Mapped["User"] = relationship(  # noqa: F821
        "User", back_populates="seller_profile"
    )
    products: Mapped[list["Product"]] = relationship(  # noqa: F821
        "Product", back_populates="seller", lazy="select"
    )
    payouts: Mapped[list["Payout"]] = relationship(  # noqa: F821
        "Payout", back_populates="seller", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<SellerProfile business={self.business_name} kyc={self.kyc_status}>"
