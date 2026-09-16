"""
Vyapari — AI/ML Embedding Models
pgvector tables for product and user embeddings + model registry.
These tables exist from Day 1 (even before any ML model consumes them)
to ensure we never have to retroactively migrate production data.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import BaseModel, JSON_TYPE, UUID_TYPE

# pgvector extension type
EMBEDDING_DIM = 768  # sentence-transformers all-mpnet-base-v2 default

try:
    from pgvector.sqlalchemy import Vector  # type: ignore[import-untyped]
    VECTOR_TYPE = Text().with_variant(Vector(EMBEDDING_DIM), "postgresql")
except ImportError:
    VECTOR_TYPE = Text()


class ProductEmbedding(BaseModel):
    """
    Stores a high-dimensional embedding vector for each product.
    Used for semantic search and \"similar products\" recommendations.
    """
    __tablename__ = "product_embeddings"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE,
        ForeignKey("products.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    # The actual embedding vector — 768-dim by default
    embedding: Mapped[list[float]] = mapped_column(
        VECTOR_TYPE, nullable=False
    )
    model_version: Mapped[str] = mapped_column(String(100), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    product: Mapped["Product"] = relationship("Product", back_populates="embedding")  # noqa: F821


class UserEmbedding(BaseModel):
    """
    Stores a user's preference embedding derived from their event history.
    Used for personalised recommendations.
    """
    __tablename__ = "user_embeddings"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE,
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    embedding: Mapped[list[float]] = mapped_column(
        VECTOR_TYPE, nullable=False
    )
    model_version: Mapped[str] = mapped_column(String(100), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="user_embedding")  # noqa: F821


class ModelRegistry(BaseModel):
    """
    Tracks which ML model version is currently live.
    Enables safe rollback to a previous model without code changes.
    """
    __tablename__ = "model_registry"

    model_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    version: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    artifact_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    # Performance metrics at training time: {"accuracy": 0.92, "ndcg@10": 0.87}
    metrics: Mapped[dict] = mapped_column(JSON_TYPE, default=dict, nullable=False)
    deployed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)

