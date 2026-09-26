"""
Seller Showcase Pages — public read API.

Backs the /store/:handle route. Unauthenticated by design: these pages are the
whole point of the feature, they are the upsell surface for paid plans, and they
must be indexable.

Privacy rules enforced here:
  * unpublished pages 404 for everyone except the owner
  * inactive media, expired highlights and out-of-window blocks never render
  * capability the seller's plan does not include is filtered at read time, not
    just at write time, so downgrading a seller takes effect immediately
"""
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from app.auth.dependencies import optional_auth
from app.db import get_db
from app.seller_page_service import PAGE_SELECT, get_entitlement, jsonb_object, serialize_page
from app.utils import require_valid_uuid

router = APIRouter()

# Public grid page size. The frontend lazy-loads the rest as the user scrolls.
GRID_PAGE_SIZE = 24
GRID_MAX_PAGE_SIZE = 60


async def _load_published_page(db, handle: str, viewer_id: Optional[str]) -> dict[str, Any]:
    """Resolve a handle to a visible page, or 404. Owners may preview unpublished."""
    page = await db.fetchrow(
        f"{PAGE_SELECT} WHERE sp.handle = $1",
        handle,
    )
    if page is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "STORE_NOT_FOUND", "message": "This store page does not exist."},
        )

    is_owner = viewer_id is not None and str(page["seller_id"]) == viewer_id
    if not page["is_published"] and not is_owner:
        # Same 404 as a nonexistent page: an unpublished handle should not be a
        # way to probe which sellers have accounts.
        raise HTTPException(
            status_code=404,
            detail={"code": "STORE_NOT_FOUND", "message": "This store page does not exist."},
        )

    result = dict(page)
    result["_is_owner"] = is_owner
    return result


def _media_payload(m: dict, allows_video: bool) -> Optional[dict[str, Any]]:
    """Serialise one seller_media row, or None if the plan hides it."""
    if m["media_type"] == "video" and not allows_video:
        return None
    return {
        "id": str(m["id"]),
        "media_type": m["media_type"],
        "url": m["url"],
        "thumbnail_url": m["thumbnail_url"] or m["url"],
        "poster_url": m["poster_url"],
        "width": m["width"],
        "height": m["height"],
        "duration_ms": m["duration_ms"],
        "caption": m["caption"],
        "alt_text": m["alt_text"],
        "product_id": str(m["product_id"]) if m["product_id"] else None,
        "is_pinned": bool(m["is_pinned"]),
        "view_count": int(m["view_count"] or 0),
        "sort_order": m["sort_order"],
    }


@router.get("/{handle}")
async def get_store_page(
    handle: str,
    user: Optional[dict] = Depends(optional_auth),
    db=Depends(get_db),
) -> dict:
    """
    The full page payload: profile, in-window blocks, highlights, a first page
    of the media grid, and featured products.
    """
    page = await _load_published_page(db, handle, user["id"] if user else None)
    viewer_id = user["id"] if user else None
    entitlement = await get_entitlement(db, str(page["seller_id"]))
    allows_video = bool(entitlement.get("allows_video"))

    blocks = await db.fetch(
        """SELECT id, block_type, title, subtitle, config, cta_label, cta_href, sort_order
             FROM seller_page_blocks
            WHERE seller_page_id = $1
              AND is_active
              AND (starts_at IS NULL OR starts_at <= NOW())
              AND (ends_at IS NULL OR ends_at >= NOW())
            ORDER BY sort_order, id""",
        page["id"],
    )
    # A block type the current plan cannot render is skipped rather than sent
    # and ignored by the client.
    block_type_capability = {
        "reels": "allows_reels",
        "announcement": "allows_announcement",
    }
    visible_blocks = [
        b for b in blocks
        if entitlement.get(block_type_capability.get(b["block_type"], ""), True)
    ]

    media_rows = await db.fetch(
        """SELECT * FROM seller_media
            WHERE seller_page_id = $1 AND is_active
            ORDER BY is_pinned DESC, sort_order, id
            LIMIT $2""",
        page["id"], GRID_PAGE_SIZE,
    )
    media = [m for m in (_media_payload(dict(r), allows_video) for r in media_rows) if m]

    total_media = int(await db.fetchval(
        "SELECT COUNT(*) FROM seller_media WHERE seller_page_id = $1 AND is_active", page["id"]
    ) or 0)

    highlight_rows = await db.fetch(
        """SELECT h.id, h.title, h.cover_media_id, h.sort_order, m.url AS cover_url
             FROM seller_highlights h
             LEFT JOIN seller_media m ON m.id = h.cover_media_id
            WHERE h.seller_page_id = $1 AND h.is_active
            ORDER BY h.sort_order, h.id""",
        page["id"],
    )
    highlights = (
        [{"id": str(h["id"]), "title": h["title"], "cover_url": h["cover_url"], "sort_order": h["sort_order"]}
         for h in highlight_rows]
        if entitlement.get("allows_highlights") else []
    )

    products = await db.fetch(
        """SELECT p.id, p.title, p.price, p.compare_at_price, p.status, p.stock_qty, p.images
             FROM products p
            WHERE p.seller_id = $1 AND p.status = 'active'
            ORDER BY p.created_at DESC
            LIMIT 12""",
        page["seller_id"],
    )

    follower_count = int(await db.fetchval(
        "SELECT COUNT(*) FROM seller_page_follows WHERE seller_page_id = $1", page["id"]
    ) or 0)
    is_following = False
    if viewer_id:
        is_following = bool(await db.fetchval(
            "SELECT 1 FROM seller_page_follows WHERE seller_page_id = $1 AND user_id = $2::uuid",
            page["id"], viewer_id,
        ))

    return {
        "success": True,
        "data": {
            "page": serialize_page(page, entitlement, follower_count),
            "seller": {
                "store_name": page["store_name"],
                "description": page["store_description"],
                "business_info": page["business_info"],
                "is_verified": bool(page["is_verified"]) if page["is_verified"] is not None else False,
                "rating_avg": float(page["seller_rating_avg"]) if page["seller_rating_avg"] is not None else None,
            },
            "blocks": [
                {
                    "id": str(b["id"]),
                    "block_type": b["block_type"],
                    "title": b["title"],
                    "subtitle": b["subtitle"],
                    "config": jsonb_object(b["config"]),
                    "cta_label": b["cta_label"],
                    "cta_href": b["cta_href"],
                    "sort_order": b["sort_order"],
                }
                for b in visible_blocks
            ],
            "highlights": highlights,
            "media": media,
            "media_total": total_media,
            "has_more_media": total_media > len(media),
            "products": [
                {
                    "id": str(p["id"]),
                    "title": p["title"],
                    "price": float(p["price"]),
                    "compare_at_price": float(p["compare_at_price"]) if p["compare_at_price"] else None,
                    "status": p["status"],
                    # Both are sent: ProductCard reads stock_qty, and anything
                    # else building the public UI would rather not have to know
                    # the raw column name.
                    "stock_qty": int(p["stock_qty"] or 0),
                    "in_stock": int(p["stock_qty"] or 0) > 0,
                    "images": p["images"],
                }
                for p in products
            ],
            "viewer": {"is_following": is_following, "is_owner": page["_is_owner"]},
        },
    }


@router.get("/{handle}/media")
async def get_store_media(
    handle: str,
    limit: int = Query(GRID_PAGE_SIZE, ge=1, le=GRID_MAX_PAGE_SIZE),
    offset: int = Query(0, ge=0, le=100000),
    user: Optional[dict] = Depends(optional_auth),
    db=Depends(get_db),
) -> dict:
    """Paginated media grid, used for infinite scroll on the public page."""
    page = await _load_published_page(db, handle, user["id"] if user else None)
    entitlement = await get_entitlement(db, str(page["seller_id"]))
    allows_video = bool(entitlement.get("allows_video"))

    rows = await db.fetch(
        """SELECT * FROM seller_media
            WHERE seller_page_id = $1 AND is_active
            ORDER BY is_pinned DESC, sort_order, id
            LIMIT $2 OFFSET $3""",
        page["id"], limit, offset,
    )
    media = [m for m in (_media_payload(dict(r), allows_video) for r in rows) if m]

    total = int(await db.fetchval(
        "SELECT COUNT(*) FROM seller_media WHERE seller_page_id = $1 AND is_active", page["id"]
    ) or 0)

    return {
        "success": True,
        "data": {
            "media": media,
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": offset + len(media) < total,
        },
    }


@router.get("/{handle}/products")
async def get_store_products(
    handle: str,
    limit: int = Query(24, ge=1, le=60),
    offset: int = Query(0, ge=0, le=100000),
    sort: str = Query("newest", pattern="^(newest|price_asc|price_desc)$"),
    user: Optional[dict] = Depends(optional_auth),
    db=Depends(get_db),
) -> dict:
    """The seller's full catalog. sort is whitelisted, never interpolated raw."""
    page = await _load_published_page(db, handle, user["id"] if user else None)

    # No rating sort: `products` carries no denormalised rating column, so
    # ranking by review score would need an aggregate over `reviews` on every
    # page of an infinite scroll. Left out rather than paid for per request.
    order_by = {
        "newest": "p.created_at DESC",
        "price_asc": "p.price ASC",
        "price_desc": "p.price DESC",
    }[sort]

    rows = await db.fetch(
        f"""SELECT p.id, p.title, p.slug, p.price, p.compare_at_price, p.stock_qty,
                   p.images, c.name AS category
              FROM products p
              LEFT JOIN categories c ON c.id = p.category_id
             WHERE p.seller_id = $1 AND p.status = 'active'
             ORDER BY {order_by}
             LIMIT $2 OFFSET $3""",
        page["seller_id"], limit, offset,
    )
    total = int(await db.fetchval(
        "SELECT COUNT(*) FROM products WHERE seller_id = $1 AND status = 'active'",
        page["seller_id"],
    ) or 0)

    return {
        "success": True,
        "data": {
            "products": [
                {
                    "id": str(p["id"]),
                    "title": p["title"],
                    "slug": p["slug"],
                    "category": p["category"],
                    "price": float(p["price"]),
                    "compare_at_price": float(p["compare_at_price"]) if p["compare_at_price"] else None,
                    "stock_qty": int(p["stock_qty"] or 0),
                    "in_stock": int(p["stock_qty"] or 0) > 0,
                    "images": p["images"],
                }
                for p in rows
            ],
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": offset + len(rows) < total,
        },
    }


class ViewBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    media_id: Optional[str] = None


@router.post("/{handle}/view")
async def record_view(
    handle: str,
    body: ViewBody = ViewBody(),
    user: Optional[dict] = Depends(optional_auth),
    db=Depends(get_db),
) -> dict:
    """
    Increment view counters.

    An explicit POST rather than a side effect of GET, so the write happens once
    per page open and the frontend can suppress it with a sessionStorage guard
    instead of writing on every re-render.
    """
    page = await _load_published_page(db, handle, user["id"] if user else None)

    await db.execute("UPDATE seller_pages SET view_count = view_count + 1 WHERE id = $1", page["id"])

    if body.media_id:
        mid = require_valid_uuid(body.media_id, "MEDIA_NOT_FOUND", "Media item does not exist.")
        await db.execute(
            "UPDATE seller_media SET view_count = view_count + 1 WHERE id = $1::uuid AND seller_page_id = $2",
            mid, page["id"],
        )

    return {"success": True, "data": {"counted": True}}


@router.post("/{handle}/follow", status_code=201)
async def follow_store(
    handle: str, user: dict = Depends(optional_auth), db=Depends(get_db)
) -> dict:
    if not user:
        raise HTTPException(
            status_code=401,
            detail={"code": "AUTH_REQUIRED", "message": "Sign in to follow this store."},
        )
    page = await _load_published_page(db, handle, user["id"])
    if str(page["seller_id"]) == user["id"]:
        raise HTTPException(
            status_code=400,
            detail={"code": "SELF_FOLLOW", "message": "You cannot follow your own store."},
        )

    await db.execute(
        """INSERT INTO seller_page_follows (seller_page_id, user_id)
           VALUES ($1, $2::uuid) ON CONFLICT DO NOTHING""",
        page["id"], user["id"],
    )
    count = int(await db.fetchval(
        "SELECT COUNT(*) FROM seller_page_follows WHERE seller_page_id = $1", page["id"]
    ) or 0)
    return {"success": True, "data": {"is_following": True, "follower_count": count}}


@router.delete("/{handle}/follow")
async def unfollow_store(
    handle: str, user: dict = Depends(optional_auth), db=Depends(get_db)
) -> dict:
    if not user:
        raise HTTPException(
            status_code=401,
            detail={"code": "AUTH_REQUIRED", "message": "Sign in to manage your follows."},
        )
    page = await _load_published_page(db, handle, user["id"])
    await db.execute(
        "DELETE FROM seller_page_follows WHERE seller_page_id = $1 AND user_id = $2::uuid",
        page["id"], user["id"],
    )
    count = int(await db.fetchval(
        "SELECT COUNT(*) FROM seller_page_follows WHERE seller_page_id = $1", page["id"]
    ) or 0)
    return {"success": True, "data": {"is_following": False, "follower_count": count}}


@router.get("/{handle}/highlights/{highlight_id}")
async def get_highlight_detail(
    handle: str,
    highlight_id: str,
    user: Optional[dict] = Depends(optional_auth),
    db=Depends(get_db),
) -> dict:
    """The contents of one highlight: its media posts and tagged products."""
    page = await _load_published_page(db, handle, user["id"] if user else None)
    entitlement = await get_entitlement(db, str(page["seller_id"]))
    if not entitlement.get("allows_highlights"):
        raise HTTPException(
            status_code=404,
            detail={"code": "STORE_NOT_FOUND", "message": "This store page does not exist."},
        )

    hid = require_valid_uuid(highlight_id, "HIGHLIGHT_NOT_FOUND", "Highlight does not exist.")
    highlight = await db.fetchrow(
        "SELECT id, title FROM seller_highlights WHERE id = $1::uuid AND seller_page_id = $2 AND is_active",
        hid, page["id"],
    )
    if highlight is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "HIGHLIGHT_NOT_FOUND", "message": "Highlight does not exist."},
        )

    items = await db.fetch(
        """SELECT i.id, i.caption, i.sort_order, i.media_id, i.product_id,
                  m.url, m.thumbnail_url, m.poster_url, m.media_type,
                  p.title AS product_title, p.price, p.status AS product_status
             FROM seller_highlight_items i
             LEFT JOIN seller_media m ON m.id = i.media_id AND m.is_active
             LEFT JOIN products p ON p.id = i.product_id AND p.status = 'active'
            WHERE i.highlight_id = $1
            ORDER BY i.sort_order""",
        hid,
    )

    return {
        "success": True,
        "data": {
            "id": str(highlight["id"]),
            "title": highlight["title"],
            "items": [
                {
                    "id": str(i["id"]),
                    "caption": i["caption"],
                    "media": (
                        {
                            "id": str(i["media_id"]),
                            "url": i["url"],
                            "thumbnail_url": i["thumbnail_url"] or i["url"],
                            "poster_url": i["poster_url"],
                            "media_type": i["media_type"],
                        }
                        if i["media_id"] and i["url"] else None
                    ),
                    "product": (
                        {
                            "id": str(i["product_id"]),
                            "title": i["product_title"],
                            "price": float(i["price"]) if i["price"] is not None else None,
                        }
                        if i["product_id"] and i["product_title"] else None
                    ),
                }
                for i in items
            ],
        },
    }
