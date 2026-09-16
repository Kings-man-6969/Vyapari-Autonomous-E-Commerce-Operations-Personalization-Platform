"""
Vyapari — Customer: Cart Router
GET    /api/v1/customer/cart
POST   /api/v1/customer/cart/items
PATCH  /api/v1/customer/cart/items/{item_id}
DELETE /api/v1/customer/cart/items/{item_id}
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.core.dependencies import AsyncSessionDep, CurrentUserIdDep, CustomerDep
from app.schemas.common import MessageResponse
from app.schemas.order import CartItemAdd, CartItemUpdate, CartRead
from app.services.order_service import OrderService

router = APIRouter(prefix="/customer/cart", tags=["cart"])


def _svc(db: AsyncSessionDep) -> OrderService:
    return OrderService(db)


@router.get("", response_model=CartRead)
async def get_cart(
    user_id: CurrentUserIdDep,
    _: CustomerDep,
    svc: OrderService = Depends(_svc),
) -> CartRead:
    return await svc.get_cart(user_id)


@router.post("/items", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def add_to_cart(
    data: CartItemAdd,
    user_id: CurrentUserIdDep,
    _: CustomerDep,
    svc: OrderService = Depends(_svc),
) -> MessageResponse:
    await svc.add_to_cart(user_id, data)
    return MessageResponse(message="Item added to cart.")


@router.patch("/items/{item_id}", response_model=MessageResponse)
async def update_cart_item(
    item_id: UUID,
    data: CartItemUpdate,
    user_id: CurrentUserIdDep,
    _: CustomerDep,
    svc: OrderService = Depends(_svc),
) -> MessageResponse:
    await svc.update_cart_item(user_id, item_id, data)
    return MessageResponse(message="Cart item updated.")



@router.delete("/items/{item_id}", response_model=MessageResponse)
async def remove_cart_item(
    item_id: UUID,
    user_id: CurrentUserIdDep,
    _: CustomerDep,
    svc: OrderService = Depends(_svc),
) -> MessageResponse:
    await svc.remove_cart_item(user_id, item_id)
    return MessageResponse(message="Item removed from cart.")
