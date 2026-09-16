"""
Vyapari — ML Event & Search Query Models
User behaviour events (Day 1 requirement — logged before any ML model exists).
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, JSON_TYPE, UUID_TYPE

EMBEDDING_DIM = 768

try:
    from pgvector.sqlalchemy import Vector  # type: ignore[import-untyped]
    VECTOR_TYPE = Text().with_variant(Vector(EMBEDDING_DIM), "postgresql")
except ImportError:
    VECTOR_TYPE = Text()



class EventType(str, enum.Enum):
    view = "view"
    click = "click"
    cart_add = "cart_add"
    cart_remove = "cart_remove"
    wishlist_add = "wishlist_add"
    purchase = "purchase"
    review = "review"
    search = "search"


class UserEvent(Base):
    """
    Append-only event log — every user interaction that has ML signal.
    No updated_at since events are immutable once written.
    """
    __tablename__ = "user_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE, primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_type: Mapped[EventType] = mapped_column(
        Enum(EventType, name="eventtype"), nullable=False, index=True
    )
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID_TYPE,
        ForeignKey("products.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    session_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    # Arbitrary context: {"position": 3, "source": "recommendations", "query": "shoes"}
    event_metadata: Mapped[dict] = mapped_column(JSON_TYPE, default=dict, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )

    user: Mapped["User"] = relationship("User", back_populates="user_events")  # noqa: F821


class SearchQuery(Base):
    """
    Logs each search query and its results.
    Stores the query embedding for future semantic search training.
    """
    __tablename__ = "search_queries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE, primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID_TYPE,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    raw_query: Mapped[str] = mapped_column(String(500), nullable=False)
    # Populated asynchronously once embeddings pipeline is live
    query_embedding: Mapped[list[float] | None] = mapped_column(
        VECTOR_TYPE, nullable=True
    )
    # IDs of products the user clicked after this query
    results_clicked: Mapped[dict] = mapped_column(JSON_TYPE, default=dict)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )

