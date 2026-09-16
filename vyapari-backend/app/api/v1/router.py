"""
Vyapari — V1 Router
Aggregates all sub-routers.
"""
from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.customer.catalog import router as catalog_router
from app.api.v1.customer.cart import router as cart_router
from app.api.v1.customer.orders import router as customer_orders_router
from app.api.v1.customer.reviews import router as reviews_router
from app.api.v1.seller.products import router as seller_products_router
from app.api.v1.seller.orders import router as seller_orders_router
from app.api.v1.seller.analytics import router as seller_analytics_router
from app.api.v1.admin.approvals import router as admin_router
from app.api.v1.ml.recommendations import router as ml_recommendations_router

v1_router = APIRouter(prefix="/api/v1")

v1_router.include_router(auth_router)
v1_router.include_router(catalog_router)
v1_router.include_router(cart_router)
v1_router.include_router(customer_orders_router)
v1_router.include_router(reviews_router)
v1_router.include_router(seller_products_router)
v1_router.include_router(seller_orders_router)
v1_router.include_router(seller_analytics_router)
v1_router.include_router(admin_router)
v1_router.include_router(ml_recommendations_router)
