"""
Cart — port of backend-core/src/routes/cart.js

GET    /api/cart
POST   /api/cart/items
PUT    /api/cart/items/:id
DELETE /api/cart/items/:id
DELETE /api/cart

Variant-aware. A line is identified by (product, option), not by product, so a
customer can hold a Medium and a Large of the same shirt as two lines. The
price shown in the bag comes from app.variants.resolve_purchase_line, the same
function the order path charges with.
"""
import asyncio

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth.dependencies import require_auth
from app.db import get_db, get_pool
from app.rate_limit import limit_for, rate_limit
from app.variants import (
    assert_sufficient_stock,
    coerce_attributes,
    describe_attributes,
    resolve_purchase_line,
)


def _limit(scope: str):
    """Build a limiter dependency from the shared table in app.rate_limit."""
    n, window = limit_for(scope)
    return rate_limit(scope, n, window)

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
            ci.variant_id,
            p.id AS product_id,
            p.title,
            p.price,
            p.compare_at_price,
            p.stock_qty,
            p.status,
            p.has_variants,
            p.images,
            sp.store_name,
            v.price AS variant_price,
            v.compare_at_price AS variant_compare_at_price,
            v.stock_qty AS variant_stock,
            v.sku AS variant_sku,
            v.attributes AS variant_attributes,
            v.is_active AS variant_active,
            v.image_url AS variant_image_url
           FROM cart_items ci
           JOIN products p ON ci.product_id = p.id
           JOIN seller_profiles sp ON p.seller_id = sp.user_id
           LEFT JOIN product_variants v ON ci.variant_id = v.id
           WHERE ci.cart_id = $1
           ORDER BY ci.created_at DESC""",
        cart_id,
    )

    items = []
    for r in rows:
        item = dict(r)
        # A cart line is priced by its option, exactly as an order line is, via
        # the same precedence rule. A cart that shows one number and an order
        # that charges another is the kind of thing a customer reports as
        # "the website is lying to me" and it is entirely preventable.
        has_option = item["variant_id"] is not None and item["variant_active"]
        if has_option:
            price = item["variant_price"] if item["variant_price"] is not None else item["price"]
            compare_at = (
                item["variant_compare_at_price"]
                if item["variant_compare_at_price"] is not None
                else item["compare_at_price"]
            )
            available_units = int(item["variant_stock"] or 0)
        else:
            price = item["price"]
            compare_at = item["compare_at_price"]
            available_units = int(item["stock_qty"] or 0)

        item["price"] = float(price) if price is not None else 0.0
        item["compare_at_price"] = float(compare_at) if compare_at is not None else None
        item["available_units"] = available_units
        item["variant_attributes"] = coerce_attributes(item.get("variant_attributes"))
        item["variant_sku"] = item.get("variant_sku")
        item["variant_label"] = describe_attributes(item["variant_attributes"])
        # A retired option stays in the bag so the customer can see it and
        # choose something else, flagged rather than silently dropped.
        item["option_retired"] = item["variant_id"] is not None and not item["variant_active"]
        item["is_available"] = (
            item["status"] == "active"
            and not item["option_retired"]
            and available_units >= item["quantity"]
        )
        item["subtotal"] = item["price"] * item["quantity"]
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
    #: The chosen option. Omitted for a product that has none, and allowed to be
    #: omitted for one that has -- resolve_purchase_line() falls back to the
    #: default, so a client with no picker still works.
    variant_id: str | None = None


@router.post("/items")
async def add_to_cart(
    body: AddItemBody,
    user: dict = Depends(require_auth),
    _rl=Depends(_limit("cart.write")),
    db=Depends(get_db),
) -> dict:
    if body.quantity <= 0:
        raise HTTPException(
            status_code=400,
            detail={"code": "VALIDATION_ERROR", "message": "Valid product_id and quantity > 0 are required."},
        )

    # One resolver for the cart and the order path, so the price a customer is
    # shown and the price they are charged cannot diverge.
    line = await resolve_purchase_line(db, body.product_id, body.variant_id, body.quantity)
    assert_sufficient_stock(line, body.quantity)

    cart_id = await get_or_create_cart(user["id"], db)

    # Upsert. The conflict key includes variant_id, so adding a Large after a
    # Medium is a second line rather than a silent bump of the first line's
    # quantity. NULLS NOT DISTINCT on the index is what keeps the pre-variant
    # NULL case collapsing to one line, as it did before.
    await db.execute(
        """INSERT INTO cart_items (cart_id, product_id, variant_id, quantity)
           VALUES ($1, $2::uuid, $3, $4)
           ON CONFLICT (cart_id, product_id, variant_id)
           DO UPDATE SET quantity = LEAST(cart_items.quantity + EXCLUDED.quantity, $5),
                         updated_at = CURRENT_TIMESTAMP""",
        cart_id,
        line.product_id,
        line.variant_id,
        body.quantity,
        line.stock,
    )

    # Fire-and-forget interaction log (safely handled)
    try:
        pool = get_pool()
        if pool:
            asyncio.ensure_future(
                pool.execute(
                    "INSERT INTO user_interactions (user_id, product_id, event_type) VALUES ($1, $2, 'add_to_cart')",
                    user["id"],
                    line.product_id,
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
        """SELECT ci.id, ci.product_id, ci.variant_id, p.stock_qty, p.price
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

    # Cap against the option's own stock. Capping against the product total is
    # how a size run ends up with a cart that says "18 in stock" for a shirt
    # with three left in the customer's chosen size.
    #
    # Both sides of the COALESCE are qualified: products and product_variants
    # both have a stock_qty column, and an unqualified reference is an
    # "ambiguous column" error, not a silent choice.
    available = await db.fetchval(
        "SELECT COALESCE(v.stock_qty, p.stock_qty) FROM products p "
        "LEFT JOIN product_variants v ON v.id = $2 "
        "WHERE p.id = $1::uuid",
        item["product_id"],
        item["variant_id"],
    )
    available = int(available or 0)

    capped_qty = min(body.quantity, available)
    await db.execute(
        "UPDATE cart_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id::text = $2",
        capped_qty,
        id,
    )

    return {
        "success": True,
        "data": {"quantity": capped_qty, "max_quantity": available},
    }


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
