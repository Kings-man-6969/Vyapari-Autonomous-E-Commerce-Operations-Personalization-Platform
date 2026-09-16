"""
Vyapari — Seller: Analytics Router
GET /api/v1/seller/analytics/revenue
GET /api/v1/seller/analytics/top-products
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import AsyncSessionDep, CurrentUserIdDep, SellerDep
from app.models.order import Order, OrderItem, OrderStatus
from app.models.product import Product
from app.models.seller_profile import SellerProfile
from app.schemas.seller import RevenueAnalytics, TopProduct

router = APIRouter(prefix="/seller/analytics", tags=["seller-analytics"])


async def _get_seller(user_id: UUID, db: AsyncSession) -> SellerProfile:
    result = await db.execute(select(SellerProfile).where(SellerProfile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Seller profile not found.")
    return profile


@router.get("/revenue", response_model=RevenueAnalytics)
async def get_revenue(
    user_id: CurrentUserIdDep,
    _: SellerDep,
    db: AsyncSessionDep,
    days: int = Query(default=30, ge=1, le=365),
) -> RevenueAnalytics:
    """Revenue summary for the last N days."""
    from datetime import datetime, timedelta, timezone
    profile = await _get_seller(user_id, db)
    cutoff = datetime.now(tz=timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(
            func.sum(OrderItem.unit_price * OrderItem.qty).label("revenue"),
            func.count(func.distinct(OrderItem.order_id)).label("order_count"),
        )
        .join(Order, Order.id == OrderItem.order_id)
        .where(
            OrderItem.seller_id == profile.id,
            Order.status.not_in([OrderStatus.cancelled, OrderStatus.refunded]),
            Order.created_at >= cutoff,
        )
    )
    row = result.one()
    revenue = float(row.revenue or 0)
    orders = int(row.order_count or 0)
    avg = revenue / orders if orders > 0 else 0.0

    return RevenueAnalytics(
        total_revenue=revenue,
        total_orders=orders,
        avg_order_value=avg,
        period_days=days,
    )


@router.get("/top-products", response_model=list[TopProduct])
async def get_top_products(
    user_id: CurrentUserIdDep,
    _: SellerDep,
    db: AsyncSessionDep,
    limit: int = Query(default=10, ge=1, le=50),
) -> list[TopProduct]:
    profile = await _get_seller(user_id, db)

    result = await db.execute(
        select(
            OrderItem.product_id,
            Product.name,
            func.sum(OrderItem.qty).label("units"),
            func.sum(OrderItem.unit_price * OrderItem.qty).label("revenue"),
        )
        .join(Product, Product.id == OrderItem.product_id)
        .join(Order, Order.id == OrderItem.order_id)
        .where(
            OrderItem.seller_id == profile.id,
            Order.status.not_in([OrderStatus.cancelled, OrderStatus.refunded]),
        )
        .group_by(OrderItem.product_id, Product.name)
        .order_by(desc("units"))
        .limit(limit)
    )

    return [
        TopProduct(
            product_id=row.product_id,
            product_name=row.name,
            units_sold=int(row.units),
            revenue=float(row.revenue),
        )
        for row in result.all()
    ]
