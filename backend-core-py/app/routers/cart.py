"""
Cart — port of backend-core/src/routes/cart.js

GET    /api/cart
POST   /api/cart/items
PUT    /api/cart/items/:id
DELETE /api/cart/items/:id
DELETE /api/cart
"""
import asyncio

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth.dependencies import require_auth
from app.db import get_db, get_pool

router = APIRouter()


async def get_or_create_cart(user_id: str, db) -> str:
    """Port of getOrCreateCart() helper."""
    row = await db.fetchrow("SELECT id FROM carts WHERE user_id = $1", user_id)
    if row is None:
        row = await db.fetchrow(
            "INSERT INTO carts (user_id) VALUES ($1) RETURNING id", user_id
        )
    return str(row["id"])


@router.get("")
@router.get("/")
async def get_cart(user: dict = Depends(require_auth), db=Depends(get_db)) -> dict:
    cart_id = await get_or_create_cart(user["id"], db)

    rows = await db.fetch(
        """SELECT
            ci.id AS cart_item_id,
            ci.quantity,
            ci.created_at,
            p.id AS product_id,
            p.title,
            p.price,
            p.compare_at_price,
            p.stock_qty,
            p.status,
            p.images,
            sp.store_name
           FROM cart_items ci
           JOIN products p ON ci.product_id = p.id
           JOIN seller_profiles sp ON p.seller_id = sp.user_id
           WHERE ci.cart_id = $1
           ORDER BY ci.created_at DESC""",
        cart_id,
    )

    items = []
    for r in rows:
        item = dict(r)
        item["is_available"] = item["status"] == "active" and item["stock_qty"] >= item["quantity"]
        item["subtotal"] = float(item["price"]) * item["quantity"]
        items.append(item)

    total_amount = sum(i["subtotal"] for i in items if i["is_available"])
    item_count = sum(i["quantity"] for i in items)

    return {
        "success": True,
        "data": {
            "cart_id": cart_id,
            "items": items,
            "total_amount": round(total_amount, 2),
            "item_count": item_count,
        },
    }


class AddItemBody(BaseModel):
    product_id: str
    quantity: int = 1


@router.post("/items")
async def add_to_cart(
    body: AddItemBody, user: dict = Depends(require_auth), db=Depends(get_db)
) -> dict:
    if body.quantity <= 0:
        raise HTTPException(
            status_code=400,
            detail={"code": "VALIDATION_ERROR", "message": "Valid product_id and quantity > 0 are required."},
        )

    product = await db.fetchrow(
        "SELECT id, stock_qty, status, price FROM products WHERE id::text = $1", body.product_id
    )
    if not product:
        raise HTTPException(
            status_code=404,
            detail={"code": "PRODUCT_NOT_FOUND", "message": "Product does not exist."},
        )
    if product["status"] != "active" or product["stock_qty"] < 1:
        raise HTTPException(
            status_code=400,
            detail={"code": "OUT_OF_STOCK", "message": "This item is currently out of stock."},
        )

    cart_id = await get_or_create_cart(user["id"], db)

    # Upsert — mirrors ON CONFLICT (cart_id, product_id) DO UPDATE
    await db.execute(
        """INSERT INTO cart_items (cart_id, product_id, quantity)
           VALUES ($1, $2::uuid, $3)
           ON CONFLICT (cart_id, product_id)
           DO UPDATE SET quantity = LEAST(cart_items.quantity + EXCLUDED.quantity, $4),
                         updated_at = CURRENT_TIMESTAMP""",
        cart_id,
        product["id"],
        body.quantity,
        product["stock_qty"],
    )

    # Fire-and-forget interaction log (safely handled)
    try:
        pool = get_pool()
        if pool:
            asyncio.ensure_future(
                pool.execute(
                    "INSERT INTO user_interactions (user_id, product_id, event_type) VALUES ($1, $2, 'add_to_cart')",
                    user["id"],
                    product["id"],
                )
            )
    except Exception:
        pass

    return {"success": True, "message": "Item added to cart."}


class UpdateItemBody(BaseModel):
    quantity: int | None = None


@router.put("/items/{id}")
async def update_cart_item(
    id: str, body: UpdateItemBody, user: dict = Depends(require_auth), db=Depends(get_db)
) -> dict:
    if body.quantity is None:
        raise HTTPException(
            status_code=400,
            detail={"code": "VALIDATION_ERROR", "message": "Quantity must be a valid number."},
        )

    cart_id = await get_or_create_cart(user["id"], db)

    if body.quantity <= 0:
        await db.execute(
            "DELETE FROM cart_items WHERE id::text = $1 AND cart_id = $2", id, cart_id
        )
        return {"success": True, "message": "Item removed from cart."}

    item = await db.fetchrow(
        """SELECT ci.id, p.stock_qty
           FROM cart_items ci
           JOIN products p ON ci.product_id = p.id
           WHERE ci.id::text = $1 AND ci.cart_id = $2""",
        id,
        cart_id,
    )

    if not item:
        raise HTTPException(
            status_code=404,
            detail={"code": "CART_ITEM_NOT_FOUND", "message": "Cart item not found."},
        )

    capped_qty = min(body.quantity, item["stock_qty"])
    await db.execute(
        "UPDATE cart_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id::text = $2",
        capped_qty,
        id,
    )

    return {"success": True, "data": {"quantity": capped_qty}}


@router.delete("/items/{id}")
async def remove_cart_item(
    id: str, user: dict = Depends(require_auth), db=Depends(get_db)
) -> dict:
    cart_id = await get_or_create_cart(user["id"], db)
    await db.execute(
        "DELETE FROM cart_items WHERE id::text = $1 AND cart_id = $2", id, cart_id
    )
    return {"success": True, "message": "Item removed."}


@router.delete("")
@router.delete("/")
async def clear_cart(user: dict = Depends(require_auth), db=Depends(get_db)) -> dict:
    cart_id = await get_or_create_cart(user["id"], db)
    await db.execute("DELETE FROM cart_items WHERE cart_id = $1", cart_id)
    return {"success": True, "message": "Cart cleared."}
