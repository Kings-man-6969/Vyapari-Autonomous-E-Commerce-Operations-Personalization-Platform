"""
Variant management for sellers and admins.

    GET    /api/products/:product_id/variants
    POST   /api/products/:product_id/variants
    PUT    /api/products/:product_id/variants/order
    PUT    /api/products/:product_id/variants/:variant_id
    DELETE /api/products/:product_id/variants/:variant_id

Mounted under /api/products rather than /api/seller so the admin console and
the seller console share one implementation and one set of rules. What a variant
is does not change because you are an administrator.

Public variant data for the storefront is not here: it comes from
GET /api/products/:id, which already returns the product. A PDP should be one
request, not two.

Ownership: a seller may only touch variants of their own products; an admin may
touch any. Same check as the product routes, extracted to one function so the
two cannot drift.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator

from app.auth.dependencies import require_role
from app.db import get_db
from app.utils import to_valid_uuid
from app.variants import (
    coerce_attributes,
    load_variants,
    serialise_variant,
    sync_variant_flag,
    variant_axes,
)

#: No prefix here. main.py mounts this at /api/products, the same prefix as the
#: products router, and declaring one here as well produced
#: /api/products/products/{id}/variants -- the kind of thing that type-checks
#: fine and 404s in production.
router = APIRouter(tags=["product-variants"])

#: How many options one product may have. A picker with 500 entries is not a
#: picker, and the product is probably a set rather than a product. Raised
#: deliberately high enough that no real catalogue hits it.
MAX_VARIANTS_PER_PRODUCT = 200


async def _load_owned_product(conn, product_id: str, user: dict) -> dict:
    """Fetches a product and checks the caller may edit it. 404 if not."""
    clean = to_valid_uuid(product_id)
    if not clean:
        raise HTTPException(
            status_code=404,
            detail={"code": "PRODUCT_NOT_FOUND", "message": "Product not found."},
        )
    row = await conn.fetchrow("SELECT * FROM products WHERE id = $1::uuid", clean)
    if not row:
        raise HTTPException(
            status_code=404,
            detail={"code": "PRODUCT_NOT_FOUND", "message": "Product not found."},
        )
    product = dict(row)
    if user["role"] != "admin" and str(product["seller_id"]) != str(user["id"]):
        # 404 rather than 403: a seller probing ids learns nothing about which
        # products exist elsewhere, which is the only thing 403 would tell them.
        raise HTTPException(
            status_code=404,
            detail={"code": "PRODUCT_NOT_FOUND", "message": "Product not found."},
        )
    return product


class VariantFields(BaseModel):
    price: float | None = None
    compare_at_price: float | None = None
    stock_qty: int = 0
    sku: str | None = None
    attributes: dict | str | None = None
    is_default: bool = False
    is_active: bool = True
    image_url: str | None = None
    sort_order: int = 0

    @field_validator("stock_qty")
    @classmethod
    def _non_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError("stock_qty cannot be negative")
        return v

    @field_validator("price", "compare_at_price")
    @classmethod
    def _non_negative_money(cls, v):
        if v is not None and v < 0:
            raise ValueError("price cannot be negative")
        return v


class CreateVariantBody(VariantFields):
    pass


class UpdateVariantBody(BaseModel):
    price: float | None = None
    compare_at_price: float | None = None
    stock_qty: int | None = None
    sku: str | None = None
    attributes: dict | str | None = None
    is_default: bool | None = None
    is_active: bool | None = None
    image_url: str | None = None
    sort_order: int | None = None


class ReorderBody(BaseModel):
    variant_ids: list[str]


def _validate_money(price, compare_at) -> None:
    """
    compare_at_price is a "was" price, so it must not undercut the price. A
    compare-at below the selling price is how a sale banner ends up advertising
    a discount of minus 40 rupees.

    Only checked when both are known. A variant with price NULL inherits the
    product's, and comparing against a product price that may itself change
    would reject an edit that is perfectly valid today.
    """
    if price is not None and compare_at is not None and compare_at < price:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_COMPARE_AT_PRICE",
                "message": "The 'was' price cannot be lower than the selling price.",
            },
        )


def _require_attributes(attributes: dict) -> dict:
    """
    An option with no attributes is indistinguishable from the product itself,
    so a picker cannot present it and a customer cannot select it. Rejecting it
    at the door is friendlier than a listing that mysteriously offers "Default"
    next to "Medium".
    """
    clean = coerce_attributes(attributes)
    if not clean:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "VARIANT_ATTRIBUTES_REQUIRED",
                "message": "Give this option at least one attribute, such as Size or Colour.",
            },
        )
    return clean


@router.get("/{product_id}/variants")
async def list_variants(
    product_id: str,
    user: dict = Depends(require_role(["seller", "admin"])),
    db=Depends(get_db),
) -> dict:
    """
    The editor's view: every variant, including retired ones.

    The storefront gets its variants from GET /api/products/:id and sees only
    active rows, so a seller needs a way to reach the ones that are switched off
    -- otherwise turning a size off is irreversible from the UI.
    """
    product = await _load_owned_product(db, product_id, user)
    variants = await load_variants(db, str(product["id"]), include_inactive=True)
    return {
        "success": True,
        "data": {
            "product_id": str(product["id"]),
            "has_variants": bool(product["has_variants"]),
            "variants": variants,
            "axes": variant_axes(variants),
            "max_variants": MAX_VARIANTS_PER_PRODUCT,
        },
    }


@router.post("/{product_id}/variants", status_code=201)
async def create_variant(
    product_id: str,
    body: CreateVariantBody,
    user: dict = Depends(require_role(["seller", "admin"])),
    db=Depends(get_db),
) -> dict:
    product = await _load_owned_product(db, product_id, user)
    attributes = _require_attributes(body.attributes)
    _validate_money(body.price, body.compare_at_price)

    count = await db.fetchval(
        "SELECT count(*) FROM product_variants WHERE product_id = $1::uuid", product["id"]
    )
    if count >= MAX_VARIANTS_PER_PRODUCT:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "TOO_MANY_VARIANTS",
                "message": f"A product can have at most {MAX_VARIANTS_PER_PRODUCT} options.",
            },
        )

    # The first option added to a product becomes its default, unless the
    # seller says otherwise. Without this the create-a-variant flow leaves a
    # product with options but no default, and any buyer who does not use the
    # picker gets VARIANT_REQUIRED at checkout.
    existing_default = await db.fetchval(
        "SELECT id FROM product_variants WHERE product_id = $1::uuid AND is_default",
        product["id"],
    )
    make_default = body.is_default or (existing_default is None and count == 0)

    # One transaction: demoting the incumbent and inserting the new default have
    # to succeed or fail together, or the product is left with two defaults
    # (rejected by the index) or none (every picker-less checkout then fails).
    #
    # db is the Connection get_db yields, not a pool.
    async with db.transaction():
        # The incumbent has to step down BEFORE the insert.
        # uq_product_variants_default is a partial unique index on
        # (product_id) WHERE is_default, so inserting a second default
        # while the first is still flagged is rejected by the index -- and
        # doing it after the insert means the request fails outright rather
        # than swapping the default, which is what the seller asked for by
        # ticking the box.
        if make_default and existing_default:
            await db.execute(
                "UPDATE product_variants SET is_default = FALSE, updated_at = NOW() "
                "WHERE id = $1::uuid",
                existing_default,
            )

        try:
            row = await db.fetchrow(
                """INSERT INTO product_variants
                     (product_id, price, compare_at_price, stock_qty, sku, attributes,
                      is_default, is_active, image_url, sort_order)
                   VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10)
                   RETURNING *""",
                product["id"],
                body.price,
                body.compare_at_price,
                body.stock_qty,
                (body.sku or "").strip() or None,
                _dump(attributes),
                make_default,
                body.is_active,
                body.image_url,
                body.sort_order,
            )
        except asyncpg_unique_violation() as exc:
            raise _duplicate_variant_error(exc) from exc

        await sync_variant_flag(db, str(product["id"]))

    await _invalidate(db, str(product["id"]))

    fresh = await db.fetchrow(
        """SELECT v.*, p.price AS product_price
             FROM product_variants v JOIN products p ON p.id = v.product_id
            WHERE v.id = $1::uuid""",
        row["id"],
    )
    return {"success": True, "data": {"variant": serialise_variant(fresh, fresh["product_price"])}}


# Declared before /{variant_id} on purpose, and it has to stay there. Both
# patterns are three segments, so "/variants/order" also matches
# "/variants/{variant_id}" -- and "order" is not a UUID, so without this
# ordering a reorder request would fall through and be rejected as a missing
# variant. Starlette matches in registration order.
@router.put("/{product_id}/variants/order")
async def reorder_variants(
    product_id: str,
    body: ReorderBody,
    user: dict = Depends(require_role(["seller", "admin"])),
    db=Depends(get_db),
) -> dict:
    """
    Bulk sort_order write, for drag-to-reorder in the editor.

    One UPDATE per row rather than a loop of individual PUTs: reordering twelve
    options is a single round trip, and a partially-applied reorder is a worse
    outcome than a rejected one.
    """
    product = await _load_owned_product(db, product_id, user)
    if not body.variant_ids:
        raise HTTPException(
            status_code=400,
            detail={"code": "VALIDATION_ERROR", "message": "variant_ids must not be empty."},
        )

    known = {
        str(r["id"])
        for r in await db.fetch(
            "SELECT id FROM product_variants WHERE product_id = $1::uuid", product["id"]
        )
    }
    submitted = [str(v) for v in body.variant_ids]
    unknown = [v for v in submitted if v not in known]
    if unknown:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "VARIANT_NOT_FOUND",
                "message": f"{len(unknown)} of those options do not belong to this product.",
            },
        )

    # db is the Connection FastAPI's get_db dependency yields, not a pool, so
    # there is nothing to acquire from. It is already a dedicated connection for
    # the duration of the request, which is exactly what a transaction needs.
    async with db.transaction():
        for index, variant_id in enumerate(submitted):
            await db.execute(
                "UPDATE product_variants SET sort_order = $1, updated_at = NOW() WHERE id = $2::uuid",
                index,
                variant_id,
            )

    await _invalidate(db, str(product["id"]))
    return {"success": True, "message": "Order saved."}


@router.put("/{product_id}/variants/{variant_id}")
async def update_variant(
    product_id: str,
    variant_id: str,
    body: UpdateVariantBody,
    user: dict = Depends(require_role(["seller", "admin"])),
    db=Depends(get_db),
) -> dict:
    product = await _load_owned_product(db, product_id, user)
    clean_variant = to_valid_uuid(variant_id)
    if not clean_variant:
        raise HTTPException(
            status_code=404,
            detail={"code": "VARIANT_NOT_FOUND", "message": "That option no longer exists."},
        )

    async with db.transaction():
        current = await db.fetchrow(
            "SELECT * FROM product_variants WHERE id = $1::uuid AND product_id = $2::uuid",
            clean_variant,
            product["id"],
        )
        if not current:
            raise HTTPException(
                status_code=404,
                detail={"code": "VARIANT_NOT_FOUND", "message": "That option no longer exists."},
            )

        price = body.price if body.price is not None else current["price"]
        compare_at = (
            body.compare_at_price
            if body.compare_at_price is not None
            else current["compare_at_price"]
        )
        _validate_money(
            float(price) if price is not None else None,
            float(compare_at) if compare_at is not None else None,
        )

        attributes = (
            _require_attributes(body.attributes)
            if body.attributes is not None
            else coerce_attributes(current["attributes"])
        )

        becomes_default = bool(body.is_default)
        if becomes_default and not current["is_default"]:
            # Clear the incumbent first: uq_product_variants_default allows
            # exactly one default per product, and it is a partial unique index
            # so the demotion and the promotion must be in one transaction.
            await db.execute(
                "UPDATE product_variants SET is_default = FALSE, updated_at = NOW() "
                "WHERE product_id = $1::uuid AND is_default",
                product["id"],
            )

        try:
            row = await db.fetchrow(
                """UPDATE product_variants
                      SET price = $1, compare_at_price = $2, stock_qty = $3,
                          sku = $4, attributes = $5::jsonb, is_default = $6,
                          is_active = $7, image_url = $8, sort_order = $9,
                          updated_at = NOW()
                    WHERE id = $10::uuid
                    RETURNING *""",
                price,
                compare_at,
                body.stock_qty if body.stock_qty is not None else current["stock_qty"],
                (body.sku.strip() or None) if body.sku is not None else current["sku"],
                _dump(attributes),
                becomes_default or current["is_default"],
                body.is_active if body.is_active is not None else current["is_active"],
                body.image_url if body.image_url is not None else current["image_url"],
                body.sort_order if body.sort_order is not None else current["sort_order"],
                clean_variant,
            )
        except asyncpg_unique_violation() as exc:
            raise _duplicate_variant_error(exc) from exc

        await sync_variant_flag(db, str(product["id"]))

    await _invalidate(db, str(product["id"]))
    return {"success": True, "data": {"variant": serialise_variant(row, product["price"])}}


@router.delete("/{product_id}/variants/{variant_id}")
async def delete_variant(
    product_id: str,
    variant_id: str,
    user: dict = Depends(require_role(["seller", "admin"])),
    db=Depends(get_db),
) -> dict:
    """
    Retires an option. Removes it outright only when it has never been bought.

    A hard delete of something that appears in an order history would set
    order_items.variant_id to NULL and lose the SKU, leaving a line item that
    cannot be identified. So: if it has been ordered, it is switched off and
    kept; if it never has, there is nothing to preserve and it goes. The
    response says which happened, because "Delete" producing a hidden row is
    the kind of thing a seller reports as a bug.
    """
    product = await _load_owned_product(db, product_id, user)
    clean_variant = to_valid_uuid(variant_id)
    if not clean_variant:
        raise HTTPException(
            status_code=404,
            detail={"code": "VARIANT_NOT_FOUND", "message": "That option no longer exists."},
        )

    ordered = await db.fetchval(
        "SELECT 1 FROM order_items WHERE variant_id = $1::uuid LIMIT 1", clean_variant
    )

    if ordered:
        await db.execute(
            "UPDATE product_variants SET is_active = FALSE, is_default = FALSE, updated_at = NOW() "
            "WHERE id = $1::uuid",
            clean_variant,
        )
        outcome = "retired"
    else:
        await db.execute("DELETE FROM product_variants WHERE id = $1::uuid", clean_variant)
        outcome = "deleted"

    await sync_variant_flag(db, str(product["id"]))
    await _invalidate(db, str(product["id"]))

    return {
        "success": True,
        "message": (
            "Option retired. It is hidden from buyers and kept for order history."
            if outcome == "retired"
            else "Option deleted."
        ),
        "data": {"outcome": outcome},
    }


# ── helpers ──────────────────────────────────────────────────────────────────

def _dump(attributes: dict) -> str:
    import json

    return json.dumps(attributes, sort_keys=True)


def asyncpg_unique_violation():
    """
    asyncpg's UniqueViolationError, imported lazily so this module can be
    imported (and its schemas collected) without a live pool.
    """
    import asyncpg

    return asyncpg.UniqueViolationError


def _duplicate_variant_error(exc: Exception) -> HTTPException:
    """
    The partial unique indexes in V8/V9 mean a violation here is always the
    same user-facing problem: this exact option already exists.
    """
    constraint = getattr(exc, "constraint_name", "") or ""
    if "sku" in constraint:
        return HTTPException(
            status_code=409,
            detail={
                "code": "DUPLICATE_SKU",
                "message": "You already use that SKU on another option of this product.",
            },
        )
    if "default" in constraint:
        return HTTPException(
            status_code=409,
            detail={
                "code": "DUPLICATE_DEFAULT_VARIANT",
                "message": "Another option is already the default.",
            },
        )
    return HTTPException(
        status_code=409,
        detail={
            "code": "DUPLICATE_VARIANT",
            "message": "This product already has an option with those same attributes.",
        },
    )


async def _invalidate(db, product_id: str) -> None:
    """
    Drops the cached product payload after a variant change.

    Product detail, the catalogue and the suggest/facets indexes are all keyed
    off a product's own fields, and variants change what a buyer sees on all
    three. A stale PDP showing a price that no longer exists is a support
    ticket.
    """
    from app.redis_client import cache

    await cache.delete_prefix("search:")
    await cache.delete_prefix("suggest:")
    await cache.delete("products:facets")
    await cache.delete_prefix("products:popular:")
    for key in (f"product:detail:{product_id.lower()}", f"product:detail:{product_id}"):
        await cache.delete(key)
    row = await db.fetchrow("SELECT slug FROM products WHERE id = $1::uuid", product_id)
    if row and row["slug"]:
        await cache.delete(f"product:detail:{row['slug'].strip().lower()}")
