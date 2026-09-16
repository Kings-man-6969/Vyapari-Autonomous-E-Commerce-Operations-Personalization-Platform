"""
Vyapari — Seller-specific Pydantic Schemas
"""
from __future__ import annotations

from uuid import UUID

from pydantic import Field, field_validator

from app.models.seller_profile import KYCStatus
from app.schemas.common import VyapariBaseModel


# ── KYC ───────────────────────────────────────────────────────────────────────

class KYCSubmission(VyapariBaseModel):
    """Seller KYC document submission."""
    gstin: str = Field(pattern=r"^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d[Z]{1}[A-Z\d]{1}$")
    pan: str = Field(pattern=r"^[A-Z]{5}\d{4}[A-Z]{1}$")
    # bank_account_details keys: account_number, ifsc_code, account_holder_name, bank_name
    bank_account_details: dict = Field(
        description="Keys: account_number, ifsc_code, account_holder_name, bank_name"
    )
    # business_address keys: line1, line2, city, state, pincode, country
    business_address: dict = Field(
        description="Keys: line1, city, state, pincode, country"
    )

    @field_validator("bank_account_details")
    @classmethod
    def validate_bank(cls, v: dict) -> dict:
        required = {"account_number", "ifsc_code", "account_holder_name", "bank_name"}
        missing = required - v.keys()
        if missing:
            raise ValueError(f"Missing bank detail fields: {missing}")
        return v


# ── Admin KYC Actions ─────────────────────────────────────────────────────────

class KYCActionRequest(VyapariBaseModel):
    action: KYCStatus  # approved | rejected
    reason: str | None = Field(default=None, max_length=500)


# ── Analytics ─────────────────────────────────────────────────────────────────

class RevenueAnalytics(VyapariBaseModel):
    total_revenue: float
    total_orders: int
    avg_order_value: float
    period_days: int


class TopProduct(VyapariBaseModel):
    product_id: UUID
    product_name: str
    units_sold: int
    revenue: float


# ── Payout ────────────────────────────────────────────────────────────────────

class PayoutRead(VyapariBaseModel):
    id: UUID
    amount: float
    status: str
    settlement_date: str | None
    reference: str | None
