import asyncio
import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth.dependencies import require_auth
from app.db import get_db, get_pool

router = APIRouter(tags=["wishlist"])


async def _get_or_create_wishlist(db, user_id: str) -> str:
    row = await db.fetchrow("SELECT id FROM wishlists WHERE user_id = $1", user_id)
    if row:
        return str(row["id"])
    new_row = await db.fetchrow(
        "INSERT INTO wishlists (user_id) VALUES ($1) RETURNING id", user_id
    )
    return str(new_row["id"])


def _fire_and_forget_interaction(user_id: str, product_id: str):
    pool = get_pool()

    async def _insert():
        try:
            await pool.execute(
                """INSERT INTO user_interactions (user_id, product_id, event_type)
                   VALUES ($1, $2, 'wishlist')""",
                user_id,
                product_id,
            )
        except Exception:
            pass

    asyncio.create_task(_insert())


@router.get("")
@router.get("/")
async def get_wishlist(
    user: dict = Depends(require_auth),
    db=Depends(get_db),
) -> dict:
    wishlist_id = await _get_or_create_wishlist(db, user["id"])
    rows = await db.fetch(
        """SELECT 
            wi.id AS wishlist_item_id,
            wi.added_at,
            p.id AS product_id,
            p.title,
            p.slug,
            p.price,
            p.compare_at_price,
            p.stock_qty,
            p.status,
            p.images,
            sp.store_name,
            c.name AS category_name
           FROM wishlist_items wi
           JOIN products p ON wi.product_id = p.id
           LEFT JOIN seller_profiles sp ON p.seller_id = sp.user_id
           LEFT JOIN categories c ON p.category_id = c.id
           WHERE wi.wishlist_id = $1
           ORDER BY wi.added_at DESC""",
        wishlist_id,
    )

    items = []
    for r in rows:
        d = dict(r)
        d["wishlist_item_id"] = str(d["wishlist_item_id"])
        d["product_id"] = str(d["product_id"])
        if d.get("added_at"):
            d["added_at"] = d["added_at"].isoformat()
        if isinstance(d.get("images"), str):
            try:
                d["images"] = json.loads(d["images"])
            except Exception:
                pass
        items.append(d)

    return {
        "success": True,
        "data": {
            "items": items,
            "total_count": len(items),
        },
    }


class WishlistBody(BaseModel):
    product_id: str | None = None
    productId: str | None = None


@router.post("")
@router.post("/")
async def add_to_wishlist_body(
    body: WishlistBody,
    user: dict = Depends(require_auth),
    db=Depends(get_db),
) -> dict:
    product_id = body.product_id or body.productId
    if not product_id:
        raise HTTPException(
            status_code=400,
            detail={"code": "VALIDATION_ERROR", "message": "product_id is required."},
        )

    prod = await db.fetchrow("SELECT id FROM products WHERE id = $1", product_id)
    if not prod:
        raise HTTPException(
            status_code=404,
            detail={"code": "PRODUCT_NOT_FOUND", "message": "Product not found."},
        )

    wishlist_id = await _get_or_create_wishlist(db, user["id"])
    await db.execute(
        """INSERT INTO wishlist_items (wishlist_id, product_id)
           VALUES ($1, $2)
           ON CONFLICT (wishlist_id, product_id) DO NOTHING""",
        wishlist_id,
        product_id,
    )

    _fire_and_forget_interaction(user["id"], product_id)

    return {"success": True, "message": "Added to wishlist."}


@router.post("/{product_id}")
async def add_to_wishlist_param(
    product_id: str,
    user: dict = Depends(require_auth),
    db=Depends(get_db),
) -> dict:
    prod = await db.fetchrow("SELECT id FROM products WHERE id = $1", product_id)
    if not prod:
        raise HTTPException(
            status_code=404,
            detail={"code": "PRODUCT_NOT_FOUND", "message": "Product not found."},
        )

    wishlist_id = await _get_or_create_wishlist(db, user["id"])
    await db.execute(
        """INSERT INTO wishlist_items (wishlist_id, product_id)
           VALUES ($1, $2)
           ON CONFLICT (wishlist_id, product_id) DO NOTHING""",
        wishlist_id,
        product_id,
    )

    _fire_and_forget_interaction(user["id"], product_id)

    return {"success": True, "message": "Added to wishlist."}


@router.delete("/{product_id}")
async def remove_from_wishlist(
    product_id: str,
    user: dict = Depends(require_auth),
    db=Depends(get_db),
) -> dict:
    wishlist_id = await _get_or_create_wishlist(db, user["id"])
    await db.execute(
        "DELETE FROM wishlist_items WHERE wishlist_id = $1 AND product_id = $2",
        wishlist_id,
        product_id,
    )
    return {"success": True, "message": "Removed from wishlist."}
