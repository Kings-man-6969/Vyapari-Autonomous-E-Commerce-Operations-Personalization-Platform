"""
Vyapari — Seller: Products Router
All routes are KYC-gated (kyc_status == approved).
GET    /api/v1/seller/products
POST   /api/v1/seller/products
PATCH  /api/v1/seller/products/{product_id}
DELETE /api/v1/seller/products/{product_id}
"""
from __future__ import annotations

import re
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import AsyncSessionDep, CurrentUserIdDep, SellerDep
from app.models.product import Product, ProductStatus
from app.models.seller_profile import KYCStatus, SellerProfile
from app.schemas.common import MessageResponse
from app.schemas.product import ProductCreate, ProductRead, ProductUpdate

router = APIRouter(prefix="/seller/products", tags=["seller-products"])


async def _get_seller_profile(user_id: UUID, db: AsyncSession) -> SellerProfile:
    result = await db.execute(
        select(SellerProfile).where(SellerProfile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Seller profile not found.")
    return profile


def _verify_kyc(profile: SellerProfile) -> None:
    if profile.kyc_status != KYCStatus.approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="KYC verification required before listing or modifying products.",
        )


def _slugify(text: str) -> str:
    slug = text.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_-]+", "-", slug)
    return slug[:280]


@router.get("", response_model=list[ProductRead])
async def list_seller_products(
    user_id: CurrentUserIdDep,
    _: SellerDep,
    db: AsyncSessionDep,
) -> list[ProductRead]:
    profile = await _get_seller_profile(user_id, db)
    result = await db.execute(
        select(Product)
        .where(Product.seller_id == profile.id)
        .options(selectinload(Product.images), selectinload(Product.variants))
        .order_by(Product.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("", response_model=ProductRead, status_code=201)
async def create_product(
    data: ProductCreate,
    user_id: CurrentUserIdDep,
    _: SellerDep,
    db: AsyncSessionDep,
) -> ProductRead:
    profile = await _get_seller_profile(user_id, db)
    _verify_kyc(profile)

    import uuid as _uuid
    slug = f"{_slugify(data.name)}-{str(_uuid.uuid4())[:8]}"

    from app.models.product import ProductVariant
    product = Product(
        seller_id=profile.id,
        name=data.name,
        slug=slug,
        description=data.description,
        brand=data.brand,
        price=data.price,
        stock_qty=data.stock_qty,
        category_id=data.category_id,
        status=ProductStatus.active,
        meta=data.meta,
    )
    db.add(product)
    await db.flush()

    for v in data.variants:
        db.add(ProductVariant(
            product_id=product.id,
            sku=v.sku,
            attributes=v.attributes,
            price_delta=v.price_delta,
            stock_qty=v.stock_qty,
        ))

    await db.flush()
    return product


@router.patch("/{product_id}", response_model=ProductRead)
async def update_product(
    product_id: UUID,
    data: ProductUpdate,
    user_id: CurrentUserIdDep,
    _: SellerDep,
    db: AsyncSessionDep,
) -> ProductRead:
    profile = await _get_seller_profile(user_id, db)
    _verify_kyc(profile)

    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.seller_id == profile.id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(product, field, value)
    return product


@router.delete("/{product_id}", response_model=MessageResponse)
async def delete_product(
    product_id: UUID,
    user_id: CurrentUserIdDep,
    _: SellerDep,
    db: AsyncSessionDep,
) -> MessageResponse:
    profile = await _get_seller_profile(user_id, db)
    _verify_kyc(profile)

    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.seller_id == profile.id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")
    product.status = ProductStatus.archived
    return MessageResponse(message="Product archived successfully.")
