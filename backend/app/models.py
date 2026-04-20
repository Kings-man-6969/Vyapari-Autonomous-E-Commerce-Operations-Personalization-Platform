from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


class ApiResponse(BaseModel):
    data: Any | None = None
    error: str | None = None
    status: str = "ok"


class AuthRegisterRequest(BaseModel):
    role: Literal["seller", "customer"]


class AuthSessionOut(BaseModel):
    clerk_id: str
    role: Literal["seller", "customer"]
    token: str


class ProductOut(BaseModel):
    id: str
    name: str
    category: str
    price: float
    cost: float
    stock: int
    description: str


class ProductPatchRequest(BaseModel):
    field: Literal["price", "stock", "name", "category", "description", "cost"]
    value: Any


class ProductCreateRequest(BaseModel):
    name: str = Field(min_length=3, max_length=100)
    category: Literal["Electronics", "Clothing", "Books", "Home & Kitchen", "Sports"]
    price: float = Field(gt=0)
    cost: float = Field(gt=0)
    stock: int = Field(ge=0)
    description: str = Field(default="", max_length=500)

    @field_validator("price")
    @classmethod
    def validate_margin(cls, value: float, info):
        cost = info.data.get("cost")
        if cost is not None and value <= cost:
            raise ValueError("price must be greater than cost")
        return value


class ProductUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=3, max_length=100)
    category: Literal["Electronics", "Clothing", "Books", "Home & Kitchen", "Sports"] | None = None
    price: float | None = Field(default=None, gt=0)
    cost: float | None = Field(default=None, gt=0)
    stock: int | None = Field(default=None, ge=0)
    description: str | None = Field(default=None, max_length=500)


class ReviewCreateRequest(BaseModel):
    product_id: str
    user_id: str
    stars: int = Field(ge=1, le=5)
    text: str = Field(min_length=10, max_length=500)


class CartAddRequest(BaseModel):
    product_id: str
    qty: int = Field(ge=1, le=100)


class WishlistAddRequest(BaseModel):
    product_id: str


class DecisionResolveRequest(BaseModel):
    action: Literal["approve", "reject"]
    resolved_by: str = Field(min_length=2, max_length=64)


class AgentSettingsUpdateRequest(BaseModel):
    restock_threshold_days: int = Field(ge=1, le=30)
    restock_buffer_days: int = Field(ge=7, le=30)
    price_drift_threshold_pct: float = Field(ge=5, le=30)
    minimum_price_margin_pct: float = Field(ge=5, le=50)
    escalation_star_threshold: int = Field(ge=1, le=2)
    sentiment_confidence_min: float = Field(ge=0.5, le=0.99)
    autonomous_confidence_threshold: float = Field(ge=0.7, le=0.99)
    max_auto_drafts_per_run: int = Field(ge=1, le=200)


class AuditRecordOut(BaseModel):
    id: int
    type: str
    product_id: str
    product_name: str
    mode: str
    confidence: float
    reasoning: str
    payload: dict
    status: str
    created_at: datetime
    resolved_at: datetime | None
    resolved_by: str | None
