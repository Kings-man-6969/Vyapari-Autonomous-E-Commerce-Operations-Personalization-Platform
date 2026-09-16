"""
Vyapari — ML: Recommendations Router
GET /api/v1/ml/recommendations/trending
GET /api/v1/ml/recommendations/bestsellers
GET /api/v1/ml/recommendations/similar/{product_id}

MVP: rule-based fallbacks.
Post-MVP: pgvector ANN similarity search will be wired in automatically
via the VectorStoreService + RecommendationService.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import AsyncSessionDep
from app.schemas.product import ProductListItem
from app.services.recommendation_service import RecommendationService

router = APIRouter(prefix="/ml/recommendations", tags=["recommendations"])


def _svc(db: AsyncSessionDep) -> RecommendationService:
    return RecommendationService(db)


def _to_product_list_item(p) -> ProductListItem:
    primary_img = None
    if getattr(p, "images", None):
        primary_img = next((img.url for img in p.images if getattr(img, "is_primary", False)), None)
        if not primary_img and len(p.images) > 0:
            primary_img = p.images[0].url
    return ProductListItem(
        id=p.id,
        name=p.name,
        slug=p.slug,
        brand=p.brand,
        price=float(p.price),
        stock_qty=p.stock_qty,
        status=p.status,
        primary_image_url=primary_img,
    )


@router.get("/trending", response_model=list[ProductListItem])
async def trending(
    limit: int = Query(default=10, ge=1, le=50),
    svc: RecommendationService = Depends(_svc),
) -> list[ProductListItem]:
    """Returns products trending in the last 30 days (by order count)."""
    products = await svc.get_trending(limit=limit)
    return [_to_product_list_item(p) for p in products]


@router.get("/bestsellers", response_model=list[ProductListItem])
async def bestsellers(
    limit: int = Query(default=10, ge=1, le=50),
    category_id: UUID | None = Query(default=None),
    svc: RecommendationService = Depends(_svc),
) -> list[ProductListItem]:
    """Returns all-time bestselling products, optionally filtered by category."""
    products = await svc.get_bestsellers(limit=limit, category_id=category_id)
    return [_to_product_list_item(p) for p in products]


@router.get("/similar/{product_id}", response_model=list[ProductListItem])
async def similar_products(
    product_id: UUID,
    limit: int = Query(default=8, ge=1, le=24),
    svc: RecommendationService = Depends(_svc),
) -> list[ProductListItem]:
    """
    Returns similar products.
    MVP: same-category. Post-MVP: pgvector cosine similarity.
    """
    products = await svc.get_similar_products(product_id, limit=limit)
    return [_to_product_list_item(p) for p in products]
