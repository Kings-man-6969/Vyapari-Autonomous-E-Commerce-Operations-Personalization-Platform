"""
Admin catalogue operations: products, stock, categories.

Split out of `admin.py` rather than appended to it, because these are the
operations an administrator actually performs and the file was already the
catch-all for metrics, KYC and system health.

Three things are deliberate here and are the reason this is not a thin copy of
the seller routes:

1. **Admin stock edits go to the row that owns the number.** V8 installs a
   trigger that maintains `products.stock_qty` from `product_variants` whenever
   `has_variants` is true. An admin "correcting" the stock on such a product by
   writing the parent column gets a number that looks accepted, is wrong, and
   silently reverts at the next option edit. So `PUT /products/{id}/stock`
   refuses with the option list rather than writing a value it cannot keep.

2. **Every stock write is recorded.** `stock_qty` is a bare integer that anyone
   with admin rights can overwrite in one request, and an unexplained drop from
   40 to 0 on a live listing is indistinguishable from a bug. Each write leaves
   a `product_stock_movements` row (V10) recording who, from what, to what, why.

3. **Deletes refuse loudly.** `order_items.product_id` is `ON DELETE RESTRICT`,
   so a product that has ever been ordered cannot be removed. Rather than let
   that surface as a 500, `DELETE` counts the order lines and answers 409 with
   the figure and a pointer at archiving, which is what an admin actually wants
   to do with a product that has sales history.
"""

import json
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator

from app.auth.dependencies import require_role
from app.db import get_db
from app.redis_client import cache
from app.variants import coerce_attributes

router = APIRouter(tags=["admin"])
_admin_guard = Depends(require_role("admin"))

#: Mirrors the `products.status` CHECK constraint. Validated here so a bad value
#: is a 400 with a readable message rather than a 500 out of the database.
PRODUCT_STATUSES = ("draft", "active", "out_of_stock", "archived")


def _slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (value or "").lower()).strip("-")


def _db_integrity_errors():
    """
    asyncpg's exception classes, imported lazily so this module can be imported
    (and its schemas collected) without a live pool. Same reason as
    `variants.asyncpg_unique_violation`.
    """
    import asyncpg

    return (
        asyncpg.UniqueViolationError,
        asyncpg.ForeignKeyViolationError,
        asyncpg.CheckViolationError,
    )


def _as_uuid(value: str, code: str, message: str):
    try:
        return uuid.UUID(str(value))
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(status_code=404, detail={"code": code, "message": message})


def _bad_request(code: str, message: str):
    return HTTPException(status_code=400, detail={"code": code, "message": message})


def _row_to_product(row, *, include_images: bool = True) -> dict:
    d = dict(row)
    for key in ("id", "seller_id", "category_id"):
        if d.get(key):
            d[key] = str(d[key])
    for key in ("created_at", "updated_at"):
        if d.get(key):
            d[key] = d[key].isoformat()
    if d.get("price") is not None:
        d["price"] = float(d["price"])
    if d.get("compare_at_price") is not None:
        d["compare_at_price"] = float(d["compare_at_price"])
    if isinstance(d.get("images"), str):
        try:
            d["images"] = json.loads(d["images"])
        except (ValueError, TypeError):
            d["images"] = []
    if not include_images:
        d.pop("images", None)
    return d


# ----------------------------------------------------------------------------
# F1. Admin product create / edit / delete
# ----------------------------------------------------------------------------
class AdminProductBody(BaseModel):
    """
    Create or replace a product on a seller's behalf.

    `seller_id` is required rather than defaulting to the admin's own id,
    because a product without a seller is not a product: `products.seller_id` is
    NOT NULL and the storefront, the seller's order list and the payout split
    are all keyed on it. Guessing would attribute a seller's listing to staff.
    """

    seller_id: str
    title: str
    category_id: str
    price: float
    description: str = ""
    slug: str | None = None
    compare_at_price: float | None = None
    cost_price: float | None = None
    stock_qty: int = 0
    images: list[str] = []
    status: str = "draft"
    tags: list[str] | str = []

    @field_validator("title")
    @classmethod
    def _title_present(cls, v: str) -> str:
        if not (v or "").strip():
            raise ValueError("A product needs a title.")
        return v.strip()

    @field_validator("price")
    @classmethod
    def _price_not_negative(cls, v: float) -> float:
        if v is None or v < 0:
            raise ValueError("Price cannot be negative.")
        return v

    @field_validator("stock_qty")
    @classmethod
    def _stock_not_negative(cls, v: int) -> int:
        if v is None or v < 0:
            raise ValueError("Stock cannot be negative.")
        return v

    @field_validator("status")
    @classmethod
    def _known_status(cls, v: str) -> str:
        if v not in PRODUCT_STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(PRODUCT_STATUSES)}.")
        return v


class AdminProductUpdate(BaseModel):
    """
    A partial update. Every field is optional and absent means "leave it alone",
    which is why this cannot be the same body as create: a full-replace PUT
    would blank a description the admin did not notice on screen.

    Note there is no `stock_qty` here on purpose. Stock is F2's job and has the
    variant rule attached; accepting it in two places means one of them is the
    way the rule gets bypassed.
    """

    title: str | None = None
    category_id: str | None = None
    price: float | None = None
    description: str | None = None
    slug: str | None = None
    compare_at_price: float | None = None
    cost_price: float | None = None
    images: list[str] | None = None
    status: str | None = None
    tags: list[str] | str | None = None

    @field_validator("status")
    @classmethod
    def _known_status(cls, v: str | None) -> str | None:
        if v is not None and v not in PRODUCT_STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(PRODUCT_STATUSES)}.")
        return v

    @field_validator("price")
    @classmethod
    def _price_not_negative(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("Price cannot be negative.")
        return v


@router.post("/products", status_code=201)
async def admin_create_product(
    body: AdminProductBody,
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> dict:
    seller_uuid = _as_uuid(body.seller_id, "SELLER_NOT_FOUND", "Seller not found.")
    category_uuid = _as_uuid(body.category_id, "CATEGORY_NOT_FOUND", "Category not found.")

    if not await db.fetchval("SELECT 1 FROM users WHERE id = $1::uuid", seller_uuid):
        raise HTTPException(
            status_code=404, detail={"code": "SELLER_NOT_FOUND", "message": "Seller not found."}
        )
    if not await db.fetchval("SELECT 1 FROM categories WHERE id = $1::uuid", category_uuid):
        raise HTTPException(
            status_code=404, detail={"code": "CATEGORY_NOT_FOUND", "message": "Category not found."}
        )

    if body.compare_at_price is not None and body.compare_at_price < body.price:
        # The database has a CHECK for this, but a check violation is a 500 and
        # "compare at price must be at least the price" is the whole answer.
        raise _bad_request(
            "INVALID_COMPARE_AT_PRICE",
            "The compare-at price cannot be lower than the price.",
        )

    base = _slugify(body.slug or body.title) or "product"
    final_slug = f"{base}-{str(int(uuid.uuid4().int % 10000)):0>4}"

    tags = (
        body.tags
        if isinstance(body.tags, list)
        else [t.strip() for t in str(body.tags).split(",") if t.strip()]
    )
    attributes = {"cost_price": body.cost_price, "tags": tags}

    try:
        row = await db.fetchrow(
            """INSERT INTO products
               (seller_id, category_id, title, slug, description, price,
                compare_at_price, stock_qty, images, attributes, status)
               VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11)
               RETURNING *""",
            seller_uuid,
            category_uuid,
            body.title,
            final_slug,
            body.description or "",
            body.price,
            body.compare_at_price,
            body.stock_qty,
            json.dumps(body.images or []),
            json.dumps(attributes),
            body.status,
        )
    except _db_integrity_errors() as exc:
        raise _integrity_to_http(exc, "PRODUCT_NOT_CREATED", "The product could not be created.")

    await _invalidate_catalogue_caches(db, row)
    return {
        "success": True,
        "message": "Product created.",
        "data": _row_to_product(row),
    }


@router.put("/products/{product_id}")
async def admin_update_product(
    product_id: str,
    body: AdminProductUpdate,
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> dict:
    p_uuid = _as_uuid(product_id, "PRODUCT_NOT_FOUND", "Product not found.")

    current = await db.fetchrow("SELECT * FROM products WHERE id = $1::uuid", p_uuid)
    if not current:
        raise HTTPException(
            status_code=404, detail={"code": "PRODUCT_NOT_FOUND", "message": "Product not found."}
        )

    # COALESCE($n, existing) is the whole partial-update story in one
    # expression. `null` means "not supplied" for every field here, so it is not
    # a value the admin can set -- which is why compare_at_price cannot be
    # cleared through this route and clearing it is a separate question.
    price = body.price if body.price is not None else float(current["price"])
    compare_at = body.compare_at_price
    if compare_at is None:
        compare_at = (
            float(current["compare_at_price"]) if current["compare_at_price"] is not None else None
        )
    if compare_at is not None and compare_at < price:
        raise _bad_request(
            "INVALID_COMPARE_AT_PRICE",
            "The compare-at price cannot be lower than the price.",
        )

    # `products.attributes` is jsonb, so asyncpg hands it back as text. The
    # bare `dict(text)` this started as raises "dictionary update sequence
    # element #0 has length 1; 2 is required" -- a 500 on every edit of a
    # product that has attributes at all, which is all of them.
    attributes = coerce_attributes(current["attributes"])
    if body.cost_price is not None:
        attributes["cost_price"] = body.cost_price
    if body.tags is not None:
        attributes["tags"] = (
            body.tags
            if isinstance(body.tags, list)
            else [t.strip() for t in str(body.tags).split(",") if t.strip()]
        )

    try:
        row = await db.fetchrow(
            """UPDATE products SET
                   title           = COALESCE($2, title),
                   category_id     = COALESCE($3::uuid, category_id),
                   price           = $4,
                   compare_at_price= $5,
                   description     = COALESCE($6, description),
                   slug            = COALESCE($7, slug),
                   images          = COALESCE($8::jsonb, images),
                   attributes      = $9::jsonb,
                   status          = COALESCE($10, status),
                   updated_at      = CURRENT_TIMESTAMP
               WHERE id = $1::uuid
               RETURNING *""",
            p_uuid,
            body.title,
            body.category_id,
            price,
            compare_at,
            body.description,
            _slugify(body.slug) or None if body.slug else None,
            json.dumps(body.images) if body.images is not None else None,
            json.dumps(attributes),
            body.status,
        )
    except _db_integrity_errors() as exc:
        raise _integrity_to_http(exc, "PRODUCT_NOT_UPDATED", "The product could not be updated.")

    await _invalidate_catalogue_caches(db, {"id": str(p_uuid), "slug": current.get("slug")})
    return {
        "success": True,
        "message": "Product updated.",
        "data": _row_to_product(row),
    }


@router.delete("/products/{product_id}")
async def admin_delete_product(
    product_id: str,
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> dict:
    p_uuid = _as_uuid(product_id, "PRODUCT_NOT_FOUND", "Product not found.")

    if await db.fetchval("SELECT 1 FROM products WHERE id = $1::uuid", p_uuid) is None:
        raise HTTPException(
            status_code=404, detail={"code": "PRODUCT_NOT_FOUND", "message": "Product not found."}
        )
    existing = await db.fetchrow("SELECT slug FROM products WHERE id = $1::uuid", p_uuid)

    # Checked rather than caught, because the answer is more useful than a
    # constraint name: "12 orders reference this" tells the admin what to do,
    # "foreign key violation" does not.
    order_lines = int(
        await db.fetchval("SELECT COUNT(*) FROM order_items WHERE product_id = $1::uuid", p_uuid) or 0
    )
    if order_lines:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "PRODUCT_HAS_ORDER_HISTORY",
                "message": (
                    f"This product appears on {order_lines} order "
                    f"{'line' if order_lines == 1 else 'lines'}. Archive it instead of "
                    "deleting it -- the order history has to keep pointing at something real."
                ),
                # Anything beyond code/message goes under `data`. The handler in
                # main.py reads only those three keys plus `data`, so a sibling
                # key in this dict would be dropped on the floor and the client
                # would get the count in the prose and nothing to compute with.
                "data": {"order_line_count": order_lines},
            },
        )

    try:
        # Variants go with it (product_variants.product_id is ON DELETE CASCADE,
        # and so are the stock movements from V10).
        await db.execute("DELETE FROM products WHERE id = $1::uuid", p_uuid)
    except _db_integrity_errors() as exc:
        raise _integrity_to_http(
            exc, "PRODUCT_HAS_REFERENCES", "This product is referenced elsewhere and cannot be deleted."
        )

    await _invalidate_catalogue_caches(db, {"id": str(p_uuid), "slug": existing.get("slug")})
    return {
        "success": True,
        "message": "Product deleted.",
        "data": {"id": str(p_uuid)},
    }


# ----------------------------------------------------------------------------
# F2. Admin stock management
# ----------------------------------------------------------------------------
class StockBody(BaseModel):
    stock_qty: int
    reason: str | None = None

    @field_validator("stock_qty")
    @classmethod
    def _stock_not_negative(cls, v: int) -> int:
        if v is None or v < 0:
            raise ValueError("Stock cannot be negative.")
        return v


async def _record_movement(
    conn,
    *,
    product_id,
    variant_id,
    previous: int,
    new: int,
    reason: str | None,
    actor_id,
) -> None:
    await conn.execute(
        """INSERT INTO product_stock_movements
             (product_id, variant_id, previous_qty, new_qty, reason, actor_id)
           VALUES ($1, $2::uuid, $3, $4, $5, $6::uuid)""",
        product_id,
        variant_id,
        previous,
        new,
        (reason or "").strip() or None,
        actor_id,
    )


@router.put("/products/{product_id}/stock")
async def admin_set_product_stock(
    product_id: str,
    body: StockBody,
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> dict:
    p_uuid = _as_uuid(product_id, "PRODUCT_NOT_FOUND", "Product not found.")

    # `db` is a single connection, not a pool (see app/db.py), so the
    # transaction opens on it directly. Taking a second connection out of the
    # pool while still holding this one is done elsewhere in this codebase, but
    # at `min_size=1` it is a self-deadlock, and variants.py already established
    # this form.
    async with db.transaction():
        # FOR UPDATE so a concurrent order decrement cannot be read past.
        # Without the lock, previous_qty in the audit row can be a number that
        # was never the real stock at any moment.
        product = await db.fetchrow(
            """SELECT id, stock_qty, has_variants
                 FROM products WHERE id = $1::uuid FOR UPDATE""",
            p_uuid,
        )
        if not product:
            raise HTTPException(
                status_code=404,
                detail={"code": "PRODUCT_NOT_FOUND", "message": "Product not found."},
            )

        if product["has_variants"]:
            # The trigger owns this column. Writing it would be accepted,
            # displayed, and then overwritten by the next option edit -- so
            # refuse, and hand back the rows that can actually be edited.
            options = await db.fetch(
                """SELECT id, sku, attributes, stock_qty
                     FROM product_variants
                    WHERE product_id = $1::uuid
                    ORDER BY sort_order, created_at""",
                p_uuid,
            )
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "VARIANT_STOCK_REQUIRED",
                    "message": (
                        "This product's stock is the sum of its options and is "
                        "maintained automatically. Edit the option that is wrong."
                    ),
                    "data": {
                        "variants": [
                            {
                                "id": str(o["id"]),
                                "sku": o["sku"],
                                # jsonb arrives from asyncpg as text; handing it
                                # straight to the response would serialise it as
                                # an escaped JSON *string* and the admin UI would
                                # have to parse it a second time.
                                "attributes": coerce_attributes(o["attributes"]),
                                "stock_qty": int(o["stock_qty"] or 0),
                            }
                            for o in options
                        ]
                    },
                },
            )

        previous = int(product["stock_qty"] or 0)
        if previous != body.stock_qty:
            await db.execute(
                "UPDATE products SET stock_qty = $1, updated_at = CURRENT_TIMESTAMP "
                "WHERE id = $2::uuid",
                body.stock_qty,
                p_uuid,
            )
        # Recorded either way: "an admin set it to what it already was" is worth
        # knowing when someone asks why a listing is sitting at zero.
        await _record_movement(
            db,
            product_id=p_uuid,
            variant_id=None,
            previous=previous,
            new=body.stock_qty,
            reason=body.reason,
            actor_id=user["id"],
        )

    await _invalidate_catalogue_caches(db, {"id": str(p_uuid)})
    return {
        "success": True,
        "message": f"Stock set to {body.stock_qty}.",
        "data": {"product_id": str(p_uuid), "previous_stock": previous, "stock_qty": body.stock_qty},
    }


@router.put("/variants/{variant_id}/stock")
async def admin_set_variant_stock(
    variant_id: str,
    body: StockBody,
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> dict:
    v_uuid = _as_uuid(variant_id, "VARIANT_NOT_FOUND", "Option not found.")

    async with db.transaction():
        variant = await db.fetchrow(
            """SELECT id, product_id, stock_qty, is_active
                 FROM product_variants WHERE id = $1::uuid FOR UPDATE""",
            v_uuid,
        )
        if not variant:
            raise HTTPException(
                status_code=404,
                detail={"code": "VARIANT_NOT_FOUND", "message": "Option not found."},
            )

        previous = int(variant["stock_qty"] or 0)
        if previous != body.stock_qty:
            await db.execute(
                """UPDATE product_variants
                      SET stock_qty = $1, updated_at = CURRENT_TIMESTAMP
                    WHERE id = $2::uuid""",
                body.stock_qty,
                v_uuid,
            )
        await _record_movement(
            db,
            product_id=variant["product_id"],
            variant_id=v_uuid,
            previous=previous,
            new=body.stock_qty,
            reason=body.reason,
            actor_id=user["id"],
        )

        # The AFTER trigger has fired by now -- same statement, same
        # transaction -- so this is the post-sync total rather than a guess.
        parent_total = await db.fetchval(
            "SELECT stock_qty FROM products WHERE id = $1::uuid",
            variant["product_id"],
        )

    await _invalidate_catalogue_caches(db, {"id": str(variant["product_id"])})
    return {
        "success": True,
        "message": f"Stock set to {body.stock_qty}.",
        "data": {
            "variant_id": str(v_uuid),
            "product_id": str(variant["product_id"]),
            "previous_stock": previous,
            "stock_qty": body.stock_qty,
            "product_total": int(parent_total or 0),
        },
    }


@router.get("/products/{product_id}/stock-movements")
async def admin_stock_history(
    product_id: str,
    limit: int = Query(50, ge=1, le=200),
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> dict:
    p_uuid = _as_uuid(product_id, "PRODUCT_NOT_FOUND", "Product not found.")

    rows = await db.fetch(
        """SELECT m.id, m.variant_id, m.previous_qty, m.new_qty, m.reason, m.created_at,
                  m.actor_id, u.name AS actor_name
             FROM product_stock_movements m
             LEFT JOIN users u ON u.id = m.actor_id
            WHERE m.product_id = $1::uuid
            ORDER BY m.created_at DESC
            LIMIT $2""",
        p_uuid,
        limit,
    )

    results = []
    for r in rows:
        d = dict(r)
        d["id"] = str(d["id"])
        d["variant_id"] = str(d["variant_id"]) if d.get("variant_id") else None
        d["actor_id"] = str(d["actor_id"]) if d.get("actor_id") else None
        d["previous_qty"] = int(d["previous_qty"] or 0)
        d["new_qty"] = int(d["new_qty"] or 0)
        if d.get("created_at"):
            d["created_at"] = d["created_at"].isoformat()
        results.append(d)

    return {"success": True, "data": results}


# ----------------------------------------------------------------------------
# F3. Admin categories edit / delete
# ----------------------------------------------------------------------------
class UpdateCategoryBody(BaseModel):
    name: str | None = None
    slug: str | None = None
    description: str | None = None
    icon_url: str | None = None
    parent_id: str | None = None

    @field_validator("name")
    @classmethod
    def _name_present(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("A category needs a name.")
        return v.strip() if v else v


@router.put("/categories/{category_id}")
async def admin_update_category(
    category_id: str,
    body: UpdateCategoryBody,
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> dict:
    c_uuid = _as_uuid(category_id, "CATEGORY_NOT_FOUND", "Category not found.")

    current = await db.fetchrow("SELECT * FROM categories WHERE id = $1::uuid", c_uuid)
    if not current:
        raise HTTPException(
            status_code=404, detail={"code": "CATEGORY_NOT_FOUND", "message": "Category not found."}
        )

    parent_uuid = None
    if body.parent_id is not None:
        parent_uuid = _as_uuid(body.parent_id, "CATEGORY_NOT_FOUND", "Parent category not found.")
        if parent_uuid == c_uuid:
            raise _bad_request("CATEGORY_CYCLE", "A category cannot be its own parent.")
        if await db.fetchval("SELECT 1 FROM categories WHERE id = $1::uuid", parent_uuid) is None:
            raise HTTPException(
                status_code=404,
                detail={"code": "CATEGORY_NOT_FOUND", "message": "Parent category not found."},
            )
        # Moving a category under its own descendant would detach that whole
        # subtree from the tree, so the descendants are walked rather than
        # trusting the caller to have checked.
        descendants = await _descendant_ids(db, c_uuid)
        if parent_uuid in descendants:
            raise _bad_request(
                "CATEGORY_CYCLE",
                "That parent is inside this category's own subtree, so the move would "
                "detach the tree from itself.",
            )
    elif "parent_id" in body.model_fields_set and body.parent_id is None:
        # An explicit null is a request to unparent, which COALESCE cannot
        # express. Worth supporting: the root of a branch is otherwise stuck
        # under whatever it was created beneath.
        parent_uuid = "SET_NULL"
    else:
        parent_uuid = current["parent_id"]

    try:
        row = await db.fetchrow(
            """UPDATE categories SET
                   name        = COALESCE($2, name),
                   slug        = COALESCE($3, slug),
                   description = COALESCE($4, description),
                   icon_url    = COALESCE($5, icon_url),
                   parent_id   = CASE WHEN $6 = 'SET_NULL' THEN NULL ELSE $6::uuid END
               WHERE id = $1::uuid
               RETURNING *""",
            c_uuid,
            body.name,
            _slugify(body.slug) or None if body.slug else None,
            body.description,
            body.icon_url,
            parent_uuid,
        )
    except _db_integrity_errors() as exc:
        raise _integrity_to_http(
            exc, "CATEGORY_CONFLICT", "Another category already uses that name or slug."
        )

    await _invalidate_category_caches()
    d = dict(row)
    d["id"] = str(d["id"])
    d["parent_id"] = str(d["parent_id"]) if d.get("parent_id") else None
    if d.get("created_at"):
        d["created_at"] = d["created_at"].isoformat()

    return {"success": True, "message": "Category updated.", "data": d}


@router.delete("/categories/{category_id}")
async def admin_delete_category(
    category_id: str,
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> dict:
    c_uuid = _as_uuid(category_id, "CATEGORY_NOT_FOUND", "Category not found.")

    if await db.fetchval("SELECT 1 FROM categories WHERE id = $1::uuid", c_uuid) is None:
        raise HTTPException(
            status_code=404, detail={"code": "CATEGORY_NOT_FOUND", "message": "Category not found."}
        )

    # `categories.parent_id` is ON DELETE SET NULL, so deleting a parent with
    # children would not fail -- it would quietly re-root them at the top level
    # and leave the catalogue in a shape nobody chose. Refuse instead.
    child_count = int(
        await db.fetchval("SELECT COUNT(*) FROM categories WHERE parent_id = $1::uuid", c_uuid) or 0
    )
    if child_count:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "CATEGORY_HAS_CHILDREN",
                "message": (
                    f"{child_count} sub-{'category' if child_count == 1 else 'categories'} "
                    f"sit under this one. Move {'it' if child_count == 1 else 'them'} first."
                ),
                "data": {"child_count": child_count},
            },
        )

    # `products.category_id` is ON DELETE RESTRICT, so this is a 500 from the
    # database unless it is asked about first.
    product_count = int(
        await db.fetchval("SELECT COUNT(*) FROM products WHERE category_id = $1::uuid", c_uuid) or 0
    )
    if product_count:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "CATEGORY_IN_USE",
                "message": (
                    f"{product_count} product{'s' if product_count != 1 else ''} "
                    f"{'are' if product_count != 1 else 'is'} filed under this category. "
                    "Move them before deleting it."
                ),
                "data": {"product_count": product_count},
            },
        )

    await db.execute("DELETE FROM categories WHERE id = $1::uuid", c_uuid)
    await _invalidate_category_caches()
    return {
        "success": True,
        "message": "Category deleted.",
        "data": {"id": str(c_uuid)},
    }


async def _descendant_ids(db, root) -> set:
    """Every category below `root`, found by walking down from it."""
    found = set()
    frontier = [root]
    while frontier:
        rows = await db.fetch(
            "SELECT id FROM categories WHERE parent_id = ANY($1::uuid[])", frontier
        )
        frontier = []
        for r in rows:
            if r["id"] not in found and r["id"] != root:
                found.add(r["id"])
                frontier.append(r["id"])
    return found


def _integrity_to_http(exc: Exception, code: str, message: str):
    """Turn a database constraint failure into something an admin can act on."""
    unique, fk, check = _db_integrity_errors()
    if isinstance(exc, unique):
        detail = getattr(exc, "constraint_name", "") or ""
        if "slug" in detail:
            return HTTPException(
                status_code=409,
                detail={
                    "code": "SLUG_TAKEN",
                    "message": "That slug is already in use. Pick another.",
                },
            )
        if "name" in detail:
            return HTTPException(
                status_code=409,
                detail={
                    "code": "NAME_TAKEN",
                    "message": "Another record already uses that name.",
                },
            )
        return HTTPException(
            status_code=409,
            detail={"code": "DUPLICATE", "message": f"{message} A unique value is already taken."},
        )
    if isinstance(exc, fk):
        return HTTPException(
            status_code=409,
            detail={
                "code": "REFERENCED_ELSEWHERE",
                "message": f"{message} Something else still points at it.",
            },
        )
    if isinstance(exc, check):
        return HTTPException(
            status_code=400,
            detail={
                "code": "CONSTRAINT_VIOLATION",
                "message": f"{message} A database rule rejected the value.",
            },
        )
    return HTTPException(status_code=400, detail={"code": "BAD_REQUEST", "message": message})


async def _invalidate_catalogue_caches(db=None, product=None) -> None:
    """
    The key set is taken from the writes in `products.py` rather than invented.

    `product:detail:` is singular, and it is keyed by *both* slug and id, so a
    slug change leaves the old slug's entry cached and serving the old price
    until the TTL expires. Hence the two lookups. Getting this wrong is silent:
    the write succeeds, the database is correct, and the storefront keeps
    serving yesterday's number.
    """
    if product is not None:
        pid = product.get("id")
        if pid:
            await cache.delete(f"product:detail:{str(pid).strip().lower()}")
        slug = product.get("slug")
        if slug:
            await cache.delete(f"product:detail:{str(slug).strip().lower()}")
    await cache.delete_prefix("search:")
    await cache.delete_prefix("suggest:")
    await cache.delete("products:facets")
    await cache.delete_prefix("products:popular:")


async def _invalidate_category_caches() -> None:
    await cache.delete("categories:tree")
    await cache.delete_prefix("categories:slug:")
    # A category name is a product facet and a search label, so moving or
    # renaming one changes both.
    await cache.delete("products:facets")
    await cache.delete_prefix("search:")
    await cache.delete_prefix("suggest:")
    await cache.delete_prefix("products:popular:")
