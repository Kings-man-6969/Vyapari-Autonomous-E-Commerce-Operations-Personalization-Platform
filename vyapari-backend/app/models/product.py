"""
Vyapari — Product & Catalog Models
Covers categories (self-referencing), products, images, and variants.
"""
from __future__ import annotations

import enum
import uuid

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import BaseModel, JSON_TYPE, UUID_TYPE

TSVECTOR_TYPE = Text().with_variant(TSVECTOR, "postgresql")


# ── Category ──────────────────────────────────────────────────────────────────

class Category(BaseModel):
    __tablename__ = "categories"

    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # Self-referencing FK for nested categories (e.g. Electronics > Mobiles > Smartphones)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID_TYPE,
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    parent: Mapped["Category | None"] = relationship(
        "Category", remote_side="Category.id", back_populates="children"
    )
    children: Mapped[list["Category"]] = relationship(
        "Category", back_populates="parent"
    )
    products: Mapped[list["Product"]] = relationship(
        "Product", back_populates="category", lazy="select"
    )


# ── Product ───────────────────────────────────────────────────────────────────

class ProductStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    archived = "archived"
    out_of_stock = "out_of_stock"


class Product(BaseModel):
    __tablename__ = "products"

    seller_id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE,
        ForeignKey("seller_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID_TYPE,
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(300), nullable=False, unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    brand: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)

    # Base price (before variants)
    price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    # Total stock (sum of variant stocks or direct)
    stock_qty: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    status: Mapped[ProductStatus] = mapped_column(
        Enum(ProductStatus, name="productstatus"),
        default=ProductStatus.draft,
        nullable=False,
        index=True,
    )

    # Full-text search vector (populated by trigger or manual update)
    search_vector: Mapped[str | None] = mapped_column(TSVECTOR_TYPE, nullable=True)

    # Extra attributes (HSN code, tax_rate, etc.)
    meta: Mapped[dict] = mapped_column(JSON_TYPE, default=dict, nullable=False)


    # ── Relationships ─────────────────────────────────────────────────────────
    seller: Mapped["SellerProfile"] = relationship(  # noqa: F821
        "SellerProfile", back_populates="products"
    )
    category: Mapped["Category | None"] = relationship(
        "Category", back_populates="products"
    )
    images: Mapped[list["ProductImage"]] = relationship(
        "ProductImage", back_populates="product", cascade="all, delete-orphan"
    )
    variants: Mapped[list["ProductVariant"]] = relationship(
        "ProductVariant", back_populates="product", cascade="all, delete-orphan"
    )
    reviews: Mapped[list["Review"]] = relationship(  # noqa: F821
        "Review", back_populates="product", lazy="select"
    )
    embedding: Mapped["ProductEmbedding"] = relationship(  # noqa: F821
        "ProductEmbedding", back_populates="product", uselist=False, lazy="select"
    )


# ── Product Image ─────────────────────────────────────────────────────────────

class ProductImage(BaseModel):
    __tablename__ = "product_images"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE,
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    url: Mapped[str] = mapped_column(String(512), nullable=False)
    alt_text: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    product: Mapped["Product"] = relationship("Product", back_populates="images")


# ── Product Variant ───────────────────────────────────────────────────────────

class ProductVariant(BaseModel):
    __tablename__ = "product_variants"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE,
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sku: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    # Variant attributes: {"size": "L", "color": "Red"}
    attributes: Mapped[dict] = mapped_column(JSON_TYPE, default=dict, nullable=False)
    # Price delta from base product price (can be negative)
    price_delta: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    stock_qty: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    product: Mapped["Product"] = relationship("Product", back_populates="variants")

