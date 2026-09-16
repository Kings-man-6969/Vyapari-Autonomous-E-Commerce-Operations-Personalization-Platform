"""
Vyapari — User & Auth Pydantic Schemas
"""
from __future__ import annotations

import re
from uuid import UUID

from pydantic import Field, field_validator

from app.models.user import UserRole
from app.schemas.common import VyapariBaseModel

_EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _validate_email(v: str) -> str:
    if not isinstance(v, str):
        raise ValueError("Email must be a string.")
    v = v.strip().lower()
    if not _EMAIL_REGEX.match(v):
        raise ValueError("Invalid email address format.")
    return v


# ── Signup ────────────────────────────────────────────────────────────────────

class CustomerSignupRequest(VyapariBaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)

    @field_validator("email", mode="before")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        return _validate_email(v)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit.")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter.")
        return v


class SellerSignupRequest(VyapariBaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    business_name: str = Field(min_length=2, max_length=255)
    # KYC fields — can be submitted at signup or later
    gstin: str | None = Field(default=None, pattern=r"^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d[Z]{1}[A-Z\d]{1}$")
    pan: str | None = Field(default=None, pattern=r"^[A-Z]{5}\d{4}[A-Z]{1}$")

    @field_validator("email", mode="before")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        return _validate_email(v)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit.")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter.")
        return v


# ── Login ─────────────────────────────────────────────────────────────────────

class LoginRequest(VyapariBaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str

    @field_validator("email", mode="before")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        return _validate_email(v)


# ── Token ─────────────────────────────────────────────────────────────────────

class TokenResponse(VyapariBaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds
    role: str | None = None
    user_id: str | None = None
    email: str | None = None


class RefreshRequest(VyapariBaseModel):
    refresh_token: str


# ── OAuth ─────────────────────────────────────────────────────────────────────

class GoogleOAuthCallbackRequest(VyapariBaseModel):
    code: str
    state: str | None = None


# ── User Read ─────────────────────────────────────────────────────────────────

class UserRead(VyapariBaseModel):
    id: UUID
    email: str | None
    phone: str | None
    role: UserRole
    is_verified: bool
    is_active: bool


class CustomerProfileRead(VyapariBaseModel):
    id: UUID
    user_id: UUID
    full_name: str | None
    preferences: dict


class SellerProfileRead(VyapariBaseModel):
    id: UUID
    user_id: UUID
    business_name: str
    store_description: str | None
    store_logo_url: str | None
    gstin: str | None
    pan: str | None
    kyc_status: str
    verified_at: str | None


# ── Profile Updates ───────────────────────────────────────────────────────────

class CustomerProfileUpdate(VyapariBaseModel):
    full_name: str | None = None
    preferences: dict | None = None


class SellerProfileUpdate(VyapariBaseModel):
    business_name: str | None = None
    store_description: str | None = None
    gstin: str | None = None
    pan: str | None = None
    bank_account_details: dict | None = None
    business_address: dict | None = None
