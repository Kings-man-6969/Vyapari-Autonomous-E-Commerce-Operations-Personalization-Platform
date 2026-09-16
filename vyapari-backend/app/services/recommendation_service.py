"""
Vyapari — Recommendation Service
MVP: rule-based trending/bestseller fallback.
Post-MVP: replace with pgvector ANN similarity search.
"""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.order import OrderItem
from app.models.product import Product, ProductStatus


class RecommendationService:

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_trending(self, limit: int = 10) -> list[Product]:
        """
        Returns products with the most order_items in the last 30 days.
        Rule-based fallback — no ML required.
        """
        from datetime import datetime, timedelta, timezone
        cutoff = datetime.now(tz=timezone.utc) - timedelta(days=30)

        result = await self.db.execute(
            select(Product)
            .join(OrderItem, OrderItem.product_id == Product.id)
            .where(
                Product.status == ProductStatus.active,
                OrderItem.created_at >= cutoff,
            )
            .options(selectinload(Product.images))
            .group_by(Product.id)
            .order_by(desc(func.count(OrderItem.id)))
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_bestsellers(self, limit: int = 10, category_id: UUID | None = None) -> list[Product]:
        """Returns all-time bestsellers, optionally filtered by category."""
        q = (
            select(Product)
            .join(OrderItem, OrderItem.product_id == Product.id)
            .where(Product.status == ProductStatus.active)
            .options(selectinload(Product.images))
        )
        if category_id:
            q = q.where(Product.category_id == category_id)

        result = await self.db.execute(
            q.group_by(Product.id)
            .order_by(desc(func.count(OrderItem.id)))
            .limit(limit)
        )
        return list(result.scalars().all())

    # ── Future ML hook (post-MVP) ─────────────────────────────────────────────

    async def get_similar_products(self, product_id: UUID, limit: int = 8) -> list[Product]:
        """
        Post-MVP: uses pgvector cosine similarity on product_embeddings.
        At MVP, falls back to same-category products.
        """
        product_result = await self.db.execute(select(Product).where(Product.id == product_id))
        product = product_result.scalar_one_or_none()
        if not product:
            return []

        result = await self.db.execute(
            select(Product)
            .where(
                Product.category_id == product.category_id,
                Product.id != product_id,
                Product.status == ProductStatus.active,
            )
            .options(selectinload(Product.images))
            .limit(limit)
        )
        return list(result.scalars().all())
