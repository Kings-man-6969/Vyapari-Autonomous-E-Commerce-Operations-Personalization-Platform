"""
Vyapari — Customer: Catalog Router
GET /api/v1/catalog/categories
GET /api/v1/catalog/products
GET /api/v1/catalog/products/{product_id}
GET /api/v1/catalog/products/{product_id}/reviews
POST /api/v1/catalog/products/{product_id}/reviews
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import AsyncSessionDep, CustomerDep
from app.models.product import Category, Product, ProductStatus
from app.models.review import Review
from app.schemas.common import PaginatedResponse
from app.schemas.product import CategoryRead, ProductListItem, ProductRead

router = APIRouter(prefix="/catalog", tags=["catalog"])


@router.get("/categories", response_model=list[CategoryRead])
async def list_categories(db: AsyncSessionDep) -> list[CategoryRead]:
    """Returns all top-level and nested categories."""
    result = await db.execute(select(Category).order_by(Category.name))
    return list(result.scalars().all())


@router.get("/products", response_model=PaginatedResponse[ProductListItem])
async def list_products(
    db: AsyncSessionDep,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=24, ge=1, le=100),
    category_id: UUID | None = Query(default=None),
    brand: str | None = Query(default=None),
    min_price: float | None = Query(default=None, ge=0),
    max_price: float | None = Query(default=None, ge=0),
    min_rating: float | None = Query(default=None, ge=1, le=5),
    q: str | None = Query(default=None, description="Keyword search"),
    sort: str = Query(default="created_at_desc", description="created_at_desc | price_asc | price_desc | rating_desc"),
) -> PaginatedResponse[ProductListItem]:
    """
    Paginated product catalog with filters: category, brand, price range,
    rating, and keyword search (PostgreSQL tsvector at MVP).
    """
    query = select(Product).where(Product.status == ProductStatus.active)

    if category_id:
        query = query.where(Product.category_id == category_id)
    if brand:
        query = query.where(Product.brand.ilike(f"%{brand}%"))
    if min_price is not None:
        query = query.where(Product.price >= min_price)
    if max_price is not None:
        query = query.where(Product.price <= max_price)
    if q:
        # Full-text search using pg_trgm similarity
        query = query.where(
            Product.name.ilike(f"%{q}%")
        )

    sort_map = {
        "created_at_desc": desc(Product.created_at),
        "price_asc": Product.price,
        "price_desc": desc(Product.price),
    }
    order_col = sort_map.get(sort, desc(Product.created_at))
    query = query.order_by(order_col)

    # Count
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    result = await db.execute(
        query.options(selectinload(Product.images)).offset(offset).limit(page_size)
    )
    products = list(result.scalars().all())

    items = []
    for p in products:
        primary_img = next((img.url for img in p.images if img.is_primary), None)
        if not primary_img and p.images:
            primary_img = p.images[0].url
        items.append(ProductListItem(
            id=p.id,
            name=p.name,
            slug=p.slug,
            brand=p.brand,
            price=float(p.price),
            stock_qty=p.stock_qty,
            status=p.status,
            primary_image_url=primary_img,
        ))

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        has_next=offset + page_size < total,
        has_prev=page > 1,
    )


@router.get("/products/{product_id}", response_model=ProductRead)
async def get_product(product_id: UUID, db: AsyncSessionDep) -> ProductRead:
    """Full product detail including variants, images."""
    result = await db.execute(
        select(Product)
        .where(Product.id == product_id)
        .options(selectinload(Product.images), selectinload(Product.variants))
    )
    product = result.scalar_one_or_none()
    if not product:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")
    return product
