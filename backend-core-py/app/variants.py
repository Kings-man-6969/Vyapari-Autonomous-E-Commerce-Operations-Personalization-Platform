"""
Product variants: resolution, serialisation and reconciliation.

The rule this module exists to enforce, stated once so there is exactly one
place to look when the numbers are wrong:

    A purchase line's price and stock come from its VARIANT when it has one,
    and from its PRODUCT when it does not.

Which of the two is authoritative for a *product* is decided by
``products.has_variants``:

  has_variants = false   The product's own price and stock_qty are authored
                         directly. This is every product the platform shipped
                         with, all 10,057 of them.
  has_variants = true    A database trigger (V8, sync_product_stock_from_variants)
                         maintains products.stock_qty as the SUM of the active
                         variants, and each variant's price is the price of its
                         line. Sellers must not write products.stock_qty; a
                         trigger warns them when they try (V9).

Because products.stock_qty stays correct in both cases, every pre-existing read
path -- catalogue listing, facet counts, admin lists, product_stats_daily, the
recommendation service's stock filter -- keeps working with no has_variants
branch. Only the code in this file and the routes that call it branches.

resolve_purchase_line() is the single entry point for "what does this line cost
and is there enough of it". The cart and the order path both go through it, so
the two can never disagree about price -- which is the class of bug that shows
up as a customer being charged the wrong amount and having no way to tell.
"""
from __future__ import annotations

import json
import re
from decimal import Decimal
from typing import Any, Iterable

from fastapi import HTTPException
from pydantic import BaseModel, field_validator

# Axis keys are free-form (a category can add Capacity or Pack Size without a
# migration), so the label is derived rather than stored. These are the ones
# where a naive title-case reads badly.
_AXIS_LABELS = {
    "size": "Size",
    "colour": "Colour",
    "color": "Colour",
    "shade": "Shade",
    "pack": "Pack Size",
    "pack_size": "Pack Size",
    "capacity": "Capacity",
    "volume": "Volume",
    "flavour": "Flavour",
    "flavor": "Flavour",
    "weight": "Weight",
    "length": "Length",
    "material": "Material",
    "style": "Style",
    "pattern": "Pattern",
    "finish": "Finish",
    "scent": "Scent",
}


def _axis_label(key: str) -> str:
    if key in _AXIS_LABELS:
        return _AXIS_LABELS[key]
    return re.sub(r"[_\-]+", " ", str(key)).strip().title()


def coerce_attributes(raw: Any) -> dict:
    """
    product_variants.attributes is jsonb, which asyncpg may hand back either as
    a dict or as raw text depending on how the pool was configured. Sellers
    also send form-encoded strings. All three become a flat {str: str}.

    Values are stringified rather than rejected: a seller who types size "10"
    and gets a hard error for not using a number is a support ticket, and
    nothing downstream needs the type.
    """
    if raw is None:
        return {}
    if isinstance(raw, str):
        raw = raw.strip()
        if not raw:
            return {}
        try:
            raw = json.loads(raw)
        except (ValueError, TypeError):
            # Not JSON. Treat as a single free-form pair, which is what a seller
            # typing "Red" into an "attributes" box meant.
            return {"option": raw}
    if not isinstance(raw, dict):
        return {}

    out: dict[str, str] = {}
    for key, value in raw.items():
        if value is None:
            continue
        name = str(key).strip()
        if not name:
            continue
        if isinstance(value, (dict, list)):
            # A nested object under an axis is a category mistake, not a value.
            continue
        text = str(value).strip()
        if text:
            out[name] = text
    return out


def serialise_variant(row: Any, product_price: Any = None) -> dict:
    """
    Shapes a variant row for the API.

    price and compare_at_price are echoed as the *effective* price, so a
    variant with price NULL (meaning "inherit the product price", which is why
    the column is nullable) still tells the client what a buyer will actually
    pay. list_price keeps the raw value so an editor can tell the difference
    between "inherits" and "set to the same number".
    """
    item = dict(row)
    raw_price = item.get("price")
    effective = raw_price if raw_price is not None else product_price

    item["attributes"] = coerce_attributes(item.get("attributes"))
    item["price"] = float(effective) if effective is not None else None
    item["compare_at_price"] = float(item["compare_at_price"]) if item.get("compare_at_price") is not None else None
    item["list_price"] = float(raw_price) if raw_price is not None else None
    item["inherits_price"] = raw_price is None
    item["stock_qty"] = int(item.get("stock_qty") or 0)
    item["in_stock"] = item["is_active"] and item["stock_qty"] > 0
    item["id"] = str(item["id"])
    if item.get("product_id") is not None:
        item["product_id"] = str(item["product_id"])
    return item


def variant_axes(variants: Iterable[dict]) -> list[dict]:
    """
    Derives the selectable axes from a product's variants, for the PDP.

    Values keep first-seen order, which follows the variants' sort_order, so
    the picker shows S, M, L rather than L, M, S.

    Each value carries how many active, in-stock variants carry it, which is
    what the picker needs to grey out "Large" when only one L is left and the
    cart already holds it. Computing availability on the client from the full
    variant list is possible but makes the client re-derive a rule the server
    already knows; the count is cheap to send.
    """
    order: list[str] = []
    values: dict[str, list[str]] = {}
    counts: dict[str, dict[str, int]] = {}

    for v in variants:
        attributes = coerce_attributes(v.get("attributes"))
        available = 1 if (v.get("is_active") and (v.get("stock_qty") or 0) > 0) else 0
        for key, value in attributes.items():
            if key not in values:
                order.append(key)
                values[key] = []
                counts[key] = {}
            if value not in counts[key]:
                values[key].append(value)
                counts[key][value] = 0
            counts[key][value] += available

    return [
        {
            "key": key,
            "label": _axis_label(key),
            "values": [
                {"value": v, "available": counts[key][v]} for v in values[key]
            ],
        }
        for key in order
    ]


def describe_attributes(attributes: Any) -> str:
    """
    "Indigo / Large" from {"colour": "Indigo", "size": "Large"}.

    Every list of a multi-option product has to name the option somehow, and
    three places need it -- the bag, the order page, the seller's order list --
    so the format is decided once here rather than three times with three
    different separators.

    Values only, no axis names. A line item reading "Colour: Indigo / Size:
    Large" states the obvious twice: the axis names are on the picker the
    customer just used, and on the product title line next to it. What a line
    item has to convey is which of the choices was made, not what the choices
    were called.

    Axis order is jsonb's, not the seller's. jsonb does not preserve the order
    keys were written in; it reorders them by length and then bytewise, so
    {"size": "XL", "colour": "Indigo"} comes back as size first and prints
    "XL / Indigo" however the seller listed them. Making the order survive would
    mean storing the axes as an ordered array instead of an object, which is a
    schema change for the sake of which of two values a line item mentions
    first. The order is stable for a given product, which is what actually
    matters -- the same line always reads the same way.

    Returns "" for an empty set rather than "/", so a plain product's line item
    shows no option at all instead of a stray separator.
    """
    clean = coerce_attributes(attributes)
    if not clean:
        return ""
    return " / ".join(clean.values())


class ResolvedLine:
    """
    The answer to "what is this line, what does it cost, is there enough of it".

    Not a dict, so that adding a field cannot silently become part of the JSON
    response. to_dict() is the only way out.
    """

    __slots__ = (
        "product_id", "product_title", "product_status", "product_price",
        "product_stock", "seller_id", "has_variants", "variant_id", "variant",
        "price", "stock", "inherits_price",
    )

    def __init__(self, **kw):
        for slot in self.__slots__:
            setattr(self, slot, kw.get(slot))

    def to_dict(self) -> dict:
        return {
            "product_id": str(self.product_id),
            "product_title": self.product_title,
            "seller_id": str(self.seller_id) if self.seller_id else None,
            "variant_id": str(self.variant_id) if self.variant_id else None,
            "variant_attributes": coerce_attributes(
                (self.variant or {}).get("attributes")
            ) if self.variant else {},
            "sku": (self.variant or {}).get("sku") if self.variant else None,
            "price": float(self.price),
            "stock_qty": int(self.stock),
            "inherits_price": bool(self.inherits_price),
        }


async def resolve_purchase_line(
    conn,
    product_id: str,
    variant_id: str | None = None,
    quantity: int = 1,
    lock: bool = False,
) -> ResolvedLine:
    """
    Resolves one purchase line. The only place price and stock are decided.

    `lock` serialises with concurrent orders. Both the product row and the
    variant row are locked, in that order, everywhere -- two orders touching
    the same product take the locks in the same sequence and cannot deadlock.
    The product lock is not incidental: sync_product_stock_from_variants()
    writes products.stock_qty, so a transaction that only locked the variant
    would race the trigger and lose the update.

    Errors are HTTPException because every caller is a route. 400 for "the
    request is wrong" (bad variant, no choice made), 404 for "gone" (product or
    variant deleted), so a client can tell a race apart from a mistake.
    """
    suffix = " FOR UPDATE" if lock else ""

    product = await conn.fetchrow(
        f"""SELECT id, title, price, stock_qty, status, seller_id, has_variants
              FROM products WHERE id = $1::uuid{suffix}""",
        product_id,
    )
    if not product:
        raise HTTPException(
            status_code=404,
            detail={"code": "PRODUCT_NOT_FOUND", "message": f"Product {product_id} no longer exists."},
        )

    variant = None

    if variant_id:
        variant = await conn.fetchrow(
            f"""SELECT id, product_id, price, compare_at_price, stock_qty, sku,
                       attributes, is_active, is_default
                  FROM product_variants WHERE id = $1::uuid{suffix}""",
            variant_id,
        )
        if not variant:
            raise HTTPException(
                status_code=404,
                detail={"code": "VARIANT_NOT_FOUND", "message": "That option is no longer available."},
            )
        # Defence in depth. V9's trigger already refuses to store this pairing,
        # so a mismatch here means a caller built the line wrong, not that a
        # user sent a bad request -- hence 400 rather than 404.
        if str(variant["product_id"]) != str(product["id"]):
            raise HTTPException(
                status_code=400,
                detail={"code": "VARIANT_MISMATCH", "message": "That option does not belong to this product."},
            )
        if not variant["is_active"]:
            raise HTTPException(
                status_code=400,
                detail={"code": "VARIANT_UNAVAILABLE", "message": "That option has been retired."},
            )
    elif product["has_variants"]:
        # A variant-bearing product with no explicit choice falls back to its
        # default. This is what keeps a buy button working for a client that
        # has not implemented a picker yet, and what keeps legacy cart rows
        # (variant_id NULL) from being stranded when a seller turns variants on
        # for a live product.
        variant = await conn.fetchrow(
            f"""SELECT id, product_id, price, compare_at_price, stock_qty, sku,
                       attributes, is_active, is_default
                  FROM product_variants
                 WHERE product_id = $1::uuid AND is_default AND is_active{suffix}""",
            product_id,
        )
        if not variant:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "VARIANT_REQUIRED",
                    "message": "Please choose an option before adding this to your bag.",
                },
            )

    if variant is not None:
        price = Decimal(str(variant["price"])) if variant["price"] is not None else Decimal(str(product["price"]))
        stock = int(variant["stock_qty"])
        inherits = variant["price"] is None
    else:
        price = Decimal(str(product["price"]))
        stock = int(product["stock_qty"])
        inherits = False

    return ResolvedLine(
        product_id=product["id"],
        product_title=product["title"],
        product_status=product["status"],
        product_price=product["price"],
        product_stock=product["stock_qty"],
        seller_id=product["seller_id"],
        has_variants=product["has_variants"],
        variant_id=variant["id"] if variant is not None else None,
        variant=dict(variant) if variant is not None else None,
        price=price,
        stock=stock,
        inherits_price=inherits,
    )


def assert_sufficient_stock(line: ResolvedLine, quantity: int) -> None:
    """
    One message for both the product and variant case, because from the
    customer's side there is no difference worth explaining -- a size that is
    out of stock and a product that is out of stock are the same problem.
    """
    if line.product_status != "active":
        raise HTTPException(
            status_code=400,
            detail={"code": "PRODUCT_UNAVAILABLE", "message": f"\"{line.product_title}\" is no longer on sale."},
        )
    if line.stock < quantity:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INSUFFICIENT_STOCK",
                "message": f"\"{line.product_title}\" has only {line.stock} unit(s) available.",
            },
        )


async def sync_variant_flag(conn, product_id: str) -> None:
    """
    Keeps products.has_variants honest after any change to a variant set.

    A product with fewer than two active variants offers no choice, so it is
    not a variant product and its own price and stock are authoritative again.
    A product with two or more is, and the trigger owns its stock.

    The flag is the smaller half of the job. The other half is stock, and it
    does not follow from the flag: the trigger that maintains
    products.stock_qty is gated on has_variants, so the option rows written
    while the flag was down were never reflected in the parent. Both
    directions are covered here -- turning the flag on re-sums, turning it off
    adopts the surviving option -- plus the case the flag cannot express at
    all, which is every option switched off.

    The last variant's price is promoted onto the product when the count drops
    to one. Without that, a seller who priced "Large" at 120 on a 100 product,
    deleted the rest of the size run, and kept the single remaining variant
    would find their 120 silently ignored -- the product would go on selling
    at 100 because that is the row that is now authoritative. Promoting keeps
    the number they last chose on the product they last left behind.

    Deliberately not enforced in the database: flipping has_variants to true
    would have to reject or rewrite every existing cart line, which is a worse
    failure than the ambiguity it prevents.
    """
    product = await conn.fetchrow(
        "SELECT price, compare_at_price, has_variants FROM products WHERE id = $1::uuid",
        product_id,
    )
    if not product:
        return

    tally = await conn.fetchrow(
        """SELECT count(*) AS total,
                  count(*) FILTER (WHERE is_active) AS live
             FROM product_variants WHERE product_id = $1::uuid""",
        product_id,
    )
    total_rows = int(tally["total"] or 0)
    live_rows = int(tally["live"] or 0)

    active = await conn.fetch(
        """SELECT id, price, compare_at_price, stock_qty, is_default
             FROM product_variants
            WHERE product_id = $1::uuid AND is_active
            ORDER BY sort_order, created_at""",
        product_id,
    )

    # ---- Nothing sellable. -------------------------------------------------
    # Every option switched off. This is not a flag transition and cannot be
    # folded into one: the first switch-off already drops has_variants to false
    # (one option is not a choice), so by the time the last one goes the flag has
    # nothing left to change and a transition-shaped check quietly succeeds
    # without doing anything -- leaving the product advertising the stock of an
    # option that no longer exists.
    #
    # So it is checked on its own terms, before the flag logic. "No live options"
    # is what matters, and only when the product has option rows at all: a
    # product with none is a plain product whose stock is its own, authored
    # number, and that is the shape imports and pre-V8 rows arrive in.
    if total_rows and not live_rows:
        await conn.execute(
            """UPDATE products
                  SET has_variants = FALSE,
                      stock_qty = 0,
                      status = CASE WHEN status = 'active' THEN 'out_of_stock' ELSE status END,
                      updated_at = NOW()
                WHERE id = $1::uuid""",
            product_id,
        )
        return

    should_have = len(active) >= 2
    if should_have == bool(product["has_variants"]):
        return

    if should_have:
        # Turning the flag on does not by itself produce a correct stock_qty.
        # V8's trigger is gated on the flag:
        #     UPDATE products ... WHERE p.id = target_product AND p.has_variants = TRUE
        # so any option row written while the flag was still false was inserted
        # without the trigger maintaining anything. Recomputing here is what
        # makes the flag flip a single, complete operation rather than a promise
        # that a later write will keep -- and "a later write" may be a week away
        # or never happen at all.
        total = sum(int(v["stock_qty"] or 0) for v in active)
        await conn.execute(
            """UPDATE products
                  SET has_variants = TRUE,
                      stock_qty = $2,
                      status = CASE
                                   WHEN $2 = 0 AND status = 'active' THEN 'out_of_stock'
                                   WHEN $2 > 0 AND status = 'out_of_stock' THEN 'active'
                                   ELSE status
                               END,
                      updated_at = NOW()
                WHERE id = $1::uuid""",
            product_id,
            total,
        )
        return

    # Dropping back to a single option: adopt that option's numbers.
    remaining = active[0]
    # Zero active options is handled above and returns early, so `active` is
    # non-empty here and $3 is a real quantity rather than a guess.
    await conn.execute(
        """UPDATE products
              SET has_variants = FALSE,
                  price = COALESCE($2, price),
                  compare_at_price = COALESCE($3, compare_at_price),
                  stock_qty = $4,
                  status = CASE
                               WHEN $4::int = 0 AND status = 'active' THEN 'out_of_stock'
                               WHEN $4::int > 0 AND status = 'out_of_stock' THEN 'active'
                               ELSE status
                           END,
                  updated_at = NOW()
            WHERE id = $1::uuid""",
        product_id,
        remaining["price"],
        remaining["compare_at_price"],
        int(remaining["stock_qty"]),
    )


async def load_variants(conn, product_id: str, include_inactive: bool = False) -> list[dict]:
    """
    A product's variants, shaped for the API, plus the derived axis list.

    Ordered by sort_order then creation time, so a seller who never sets
    sort_order still gets a stable, sensible order rather than an arbitrary one.
    """
    where = "" if include_inactive else " AND v.is_active"
    rows = await conn.fetch(
        f"""SELECT v.*, p.price AS product_price
              FROM product_variants v
              JOIN products p ON p.id = v.product_id
             WHERE v.product_id = $1::uuid{where}
             ORDER BY v.sort_order, v.created_at""",
        product_id,
    )
    variants = [serialise_variant(r, r["product_price"]) for r in rows]
    return variants


async def variants_for_display(conn, product_id: str, product_price: Any, has_variants: bool) -> dict:
    """
    What the PDP needs, in one payload.

    For a product without variants this returns an empty list rather than the
    single backfilled default row. Showing a one-option picker is noise, and the
    V8 backfill exists so the *data model* never sees zero variants -- not so
    every product grows a pointless UI control. The default row is still there
    for the purchase path to fall back to.
    """
    if not has_variants:
        return {"variants": [], "axes": [], "variant_count": 0}
    variants = await load_variants(conn, product_id)
    return {
        "variants": variants,
        "axes": variant_axes(variants),
        "variant_count": len(variants),
    }


# ── authoring ────────────────────────────────────────────────────────────────
#
# Everything above reads and resolves. This section is the other direction: a
# form supplying options at creation time. It lives here rather than in a router
# because two create routes need it -- POST /api/products and
# POST /api/seller/products -- and the two bodies disagree about field names
# (stock_qty against inventory_count), so a helper that read a body object would
# only ever fit one of them.


class VariantInput(BaseModel):
    """One option as supplied by a create form."""

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


async def write_initial_variants(
    conn,
    product_id: str,
    *,
    variants: Iterable["VariantInput"] | None,
    price: Any,
    compare_at_price: Any = None,
    stock_qty: int = 0,
) -> None:
    """
    Creates a product's opening set of options.

    Always writes at least one row. The default row mirrors the product's own
    price and stock and carries an empty attribute set, which is exactly what
    V8's backfill produced for the 10,057 products that predate variants --
    except that the V8 backfill set price rather than leaving it NULL, and this
    leaves price NULL so the default row genuinely inherits. Either way
    resolve_purchase_line() arrives at the same number, and NULL is the more
    honest record: it says "this option has no price of its own".
    """
    supplied = list(variants or [])
    if not supplied:
        await conn.execute(
            """INSERT INTO product_variants (product_id, price, stock_qty, attributes, is_default, sort_order)
               VALUES ($1, NULL, $2, '{}'::jsonb, TRUE, 0)
               ON CONFLICT DO NOTHING""",
            product_id,
            stock_qty,
        )
        return

    if len(supplied) == 1:
        # A single option mirrors the product, so it carries the product's
        # numbers rather than an empty attribute set. Creating an option with no
        # attributes is rejected by the variants API for exactly this reason.
        only = supplied[0]
        await conn.execute(
            """INSERT INTO product_variants
                 (product_id, price, compare_at_price, stock_qty, sku, attributes, is_default, image_url, sort_order)
               VALUES ($1,$2,$3,$4,$5,$6::jsonb,TRUE,$7,$8)
               ON CONFLICT DO NOTHING""",
            product_id,
            only.price if only.price is not None else price,
            only.compare_at_price if only.compare_at_price is not None else compare_at_price,
            only.stock_qty if only.stock_qty else stock_qty,
            (only.sku or "").strip() or None,
            json.dumps(coerce_attributes(only.attributes) or {"option": "Standard"}),
            only.image_url,
            only.sort_order,
        )
        return

    # Two or more options makes this a variant product. The flag has to be TRUE
    # *before* the rows land, because the trigger that maintains
    # products.stock_qty is gated on it:
    #
    #     ... WHERE p.id = target_product AND p.has_variants = TRUE
    #
    # Insert first and call sync_variant_flag() afterwards, the flag is still
    # false for every insert, no trigger fires, and the product is left
    # reporting the stock_qty the caller sent (0, for a form that supplies its
    # quantities per option) while its options hold 6. That is the catalogue
    # selling a size run that appears to have nothing in it.
    await conn.execute(
        "UPDATE products SET has_variants = TRUE, updated_at = NOW() WHERE id = $1::uuid",
        product_id,
    )

    for index, variant in enumerate(supplied):
        await conn.execute(
            """INSERT INTO product_variants
                 (product_id, price, compare_at_price, stock_qty, sku, attributes,
                  is_default, is_active, image_url, sort_order)
               VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10)
               ON CONFLICT DO NOTHING""",
            product_id,
            variant.price,
            variant.compare_at_price,
            variant.stock_qty,
            (variant.sku or "").strip() or None,
            json.dumps(coerce_attributes(variant.attributes) or {"option": f"Option {index + 1}"}),
            variant.is_default or index == 0,
            variant.is_active,
            variant.image_url,
            variant.sort_order or index,
        )
