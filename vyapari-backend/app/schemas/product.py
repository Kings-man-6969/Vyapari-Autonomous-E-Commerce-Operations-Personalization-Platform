"""
Vyapari — Product Pydantic Schemas
"""
from __future__ import annotations

from uuid import UUID

from pydantic import Field

from app.models.product import ProductStatus
from app.schemas.common import VyapariBaseModel


# ── Category ──────────────────────────────────────────────────────────────────

class CategoryRead(VyapariBaseModel):
    id: UUID
    name: str
    slug: str
    description: str | None
    image_url: str | None
    parent_id: UUID | None


# ── Product Image ─────────────────────────────────────────────────────────────

class ProductImageRead(VyapariBaseModel):
    id: UUID
    url: str
    alt_text: str | None
    is_primary: bool
    sort_order: int


# ── Product Variant ───────────────────────────────────────────────────────────

class ProductVariantRead(VyapariBaseModel):
    id: UUID
    sku: str
    attributes: dict
    price_delta: float
    stock_qty: int
    is_active: bool


class ProductVariantCreate(VyapariBaseModel):
    sku: str = Field(min_length=1, max_length=100)
    attributes: dict = Field(default_factory=dict)
    price_delta: float = 0.0
    stock_qty: int = Field(ge=0, default=0)


# ── Product ───────────────────────────────────────────────────────────────────

class ProductRead(VyapariBaseModel):
    id: UUID
    name: str
    slug: str
    description: str | None
    brand: str | None
    price: float
    stock_qty: int
    status: ProductStatus
    category_id: UUID | None
    seller_id: UUID
    images: list[ProductImageRead] = []
    variants: list[ProductVariantRead] = []


class ProductListItem(VyapariBaseModel):
    """Lightweight product for catalog listing (no variants/images list)."""
    id: UUID
    name: str
    slug: str
    brand: str | None
    price: float
    stock_qty: int
    status: ProductStatus
    primary_image_url: str | None = None
    average_rating: float | None = None
    review_count: int = 0


class ProductCreate(VyapariBaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    brand: str | None = None
    price: float = Field(gt=0)
    stock_qty: int = Field(ge=0, default=0)
    category_id: UUID | None = None
    variants: list[ProductVariantCreate] = []
    meta: dict = Field(default_factory=dict)


class ProductUpdate(VyapariBaseModel):
    name: str | None = None
    description: str | None = None
    brand: str | None = None
    price: float | None = Field(default=None, gt=0)
    stock_qty: int | None = Field(default=None, ge=0)
    category_id: UUID | None = None
    status: ProductStatus | None = None
    meta: dict | None = None


class StockUpdate(VyapariBaseModel):
    stock_qty: int = Field(ge=0)
