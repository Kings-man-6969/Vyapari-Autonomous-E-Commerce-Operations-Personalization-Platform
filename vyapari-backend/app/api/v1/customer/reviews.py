"""
Vyapari — Customer: Reviews Router
GET  /api/v1/catalog/products/{product_id}/reviews
POST /api/v1/catalog/products/{product_id}/reviews
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import AsyncSessionDep, CurrentUserIdDep, CustomerDep
from app.db.session import get_async_session
from app.models.customer_profile import CustomerProfile
from app.models.review import Review
from app.schemas.common import MessageResponse, VyapariBaseModel

router = APIRouter(prefix="/catalog/products/{product_id}/reviews", tags=["reviews"])


class ReviewCreate(VyapariBaseModel):
    rating: int = Field(ge=1, le=5)
    title: str | None = Field(default=None, max_length=255)
    comment: str | None = None
    images: list[str] = Field(default_factory=list)


class ReviewRead(VyapariBaseModel):
    id: UUID
    product_id: UUID
    customer_id: UUID
    rating: int
    title: str | None
    comment: str | None
    images: list
    is_verified_purchase: bool
    helpful_count: int


@router.get("", response_model=list[ReviewRead])
async def list_reviews(
    product_id: UUID,
    db: AsyncSessionDep,
) -> list[ReviewRead]:
    result = await db.execute(
        select(Review)
        .where(Review.product_id == product_id, Review.is_visible == True)
        .order_by(Review.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("", response_model=ReviewRead, status_code=201)
async def create_review(
    product_id: UUID,
    data: ReviewCreate,
    user_id: CurrentUserIdDep,
    _: CustomerDep,
    db: AsyncSessionDep,
) -> ReviewRead:
    # Get customer profile
    profile_result = await db.execute(
        select(CustomerProfile).where(CustomerProfile.user_id == user_id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer profile not found.")

    # Check for duplicate review
    existing = await db.execute(
        select(Review).where(
            Review.product_id == product_id,
            Review.customer_id == profile.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already reviewed this product.",
        )

    review = Review(
        product_id=product_id,
        customer_id=profile.id,
        rating=data.rating,
        title=data.title,
        comment=data.comment,
        images=data.images,
    )
    db.add(review)
    await db.flush()
    return review
