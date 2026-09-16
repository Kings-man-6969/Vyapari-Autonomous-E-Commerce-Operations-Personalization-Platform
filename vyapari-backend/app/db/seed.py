"""
Vyapari — Database Seeder
Seeds demo users (customer, seller, admin), sample categories, and products.
Run with: python -m app.db.seed
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.logging import get_logger
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import AsyncSessionLocal, engine
from app.models.customer_profile import CustomerProfile
from app.models.product import Category, Product, ProductImage, ProductStatus
from app.models.seller_profile import KYCStatus, SellerProfile
from app.models.user import User, UserRole

logger = get_logger(__name__)


async def seed_all():
    print("Starting Vyapari database seeding...")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # 1. Admin User
        admin_email = "admin@vyapari.local"
        res = await db.execute(select(User).where(User.email == admin_email))
        admin = res.scalar_one_or_none()
        if not admin:
            admin = User(
                email=admin_email,
                password_hash=hash_password("AdminPass123!"),
                role=UserRole.admin,
                is_verified=True,
                is_active=True,
            )
            db.add(admin)
            await db.flush()
            print("Created Admin: admin@vyapari.local (AdminPass123!)")

        # 2. Demo Seller
        seller_email = "seller@vyapari.local"
        res = await db.execute(select(User).where(User.email == seller_email))
        seller = res.scalar_one_or_none()
        if not seller:
            seller = User(
                email=seller_email,
                password_hash=hash_password("SellerPass123!"),
                role=UserRole.seller,
                is_verified=True,
                is_active=True,
            )
            db.add(seller)
            await db.flush()

            seller_profile = SellerProfile(
                user_id=seller.id,
                business_name="Sharma Electronics Pvt. Ltd.",
                store_description="Premier audio and consumer tech distributor based in Bengaluru.",
                gstin="29AAAAA0000A1Z5",
                pan="ABCDE1234F",
                kyc_status=KYCStatus.approved,
                verified_at=datetime.now(tz=timezone.utc),
                business_address={
                    "line1": "Plot 42, Electronics City Phase 1",
                    "city": "Bengaluru",
                    "state": "Karnataka",
                    "pincode": "560100",
                    "country": "India",
                },
                bank_account_details={
                    "account_number": "50200088921822",
                    "ifsc_code": "HDFC0000128",
                    "bank_name": "HDFC Bank Ltd.",
                    "account_holder_name": "Sharma Electronics",
                },
            )
            db.add(seller_profile)
            await db.flush()
            print("Created Demo Seller: seller@vyapari.local (SellerPass123!)")

        # 3. Demo Customer
        customer_email = "customer@vyapari.local"
        res = await db.execute(select(User).where(User.email == customer_email))
        customer = res.scalar_one_or_none()
        if not customer:
            customer = User(
                email=customer_email,
                password_hash=hash_password("CustomerPass123!"),
                role=UserRole.customer,
                is_verified=True,
                is_active=True,
            )
            db.add(customer)
            await db.flush()

            customer_profile = CustomerProfile(
                user_id=customer.id,
                full_name="Aditya Sharma",
                preferences={"preferred_categories": ["Electronics", "Audio & Wearables"]},
            )
            db.add(customer_profile)
            await db.flush()
            print("Created Demo Customer: customer@vyapari.local (CustomerPass123!)")

        # 4. Categories
        categories_data = [
            ("Consumer Electronics", "electronics", "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600"),
            ("Audio & Wearables", "audio-wearables", "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600"),
            ("Home & Living", "home-living", "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=600"),
            ("Apparel & Fashion", "fashion", "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=600"),
        ]
        created_categories = {}
        for name, slug, img in categories_data:
            res_cat = await db.execute(select(Category).where(Category.slug == slug))
            cat = res_cat.scalar_one_or_none()
            if not cat:
                cat = Category(name=name, slug=slug, image_url=img)
                db.add(cat)
                await db.flush()
            created_categories[slug] = cat

        await db.commit()
    print("Seeding completed successfully!")


if __name__ == "__main__":
    asyncio.run(seed_all())
