"""
Vyapari — Seller: Orders Router
GET   /api/v1/seller/orders
PATCH /api/v1/seller/orders/{order_id}/status
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import AsyncSessionDep, CurrentUserIdDep, SellerDep
from app.models.order import Order, OrderItem
from app.models.seller_profile import SellerProfile
from app.schemas.order import OrderRead, OrderStatusUpdate
from app.services.order_service import OrderService

router = APIRouter(prefix="/seller/orders", tags=["seller-orders"])


async def _get_seller_profile(user_id: UUID, db: AsyncSession) -> SellerProfile:
    result = await db.execute(select(SellerProfile).where(SellerProfile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Seller profile not found.")
    return profile


@router.get("", response_model=list[OrderRead])
async def list_seller_orders(
    user_id: CurrentUserIdDep,
    _: SellerDep,
    db: AsyncSessionDep,
) -> list[OrderRead]:
    """Returns all orders that contain at least one item from this seller."""
    profile = await _get_seller_profile(user_id, db)

    # Orders containing this seller's products
    result = await db.execute(
        select(Order)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .where(OrderItem.seller_id == profile.id)
        .options(selectinload(Order.items), selectinload(Order.payment))
        .distinct()
        .order_by(Order.created_at.desc())
    )
    return list(result.scalars().all())


@router.patch("/{order_id}/status", response_model=OrderRead)
async def update_order_status(
    order_id: UUID,
    data: OrderStatusUpdate,
    user_id: CurrentUserIdDep,
    _: SellerDep,
    db: AsyncSessionDep,
) -> OrderRead:
    svc = OrderService(db)
    return await svc.update_order_status(user_id, order_id, data)
