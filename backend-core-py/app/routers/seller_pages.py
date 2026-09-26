"""
Seller Showcase Pages — owner/editor API (seller + admin only).

GET    /api/seller-pages/mine
PUT    /api/seller-pages/mine                  profile, bio, theme, SEO
POST   /api/seller-pages/mine/publish          publish / unpublish
POST   /api/seller-pages/mine/media            attach uploaded media
PATCH  /api/seller-pages/mine/media/:id        caption / pin / reorder / hide
DELETE /api/seller-pages/mine/media/:id
POST   /api/seller-pages/mine/highlights
PUT    /api/seller-pages/mine/highlights/order
DELETE /api/seller-pages/mine/highlights/:id
PUT    /api/seller-pages/mine/blocks/order     drag-to-reorder composition
POST   /api/seller-pages/mine/blocks
DELETE /api/seller-pages/mine/blocks/:id
GET    /api/seller-pages/mine/analytics
"""
import json
import re
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from app.auth.dependencies import require_auth
from app.db import get_db, get_pool
from app.seller_page_service import (
    PAGE_SELECT,
    TIERS,
    get_entitlement,
    get_or_create_page,
    invalidate_entitlement_cache,
    normalize_handle,
    require_capacity,
    require_feature,
    serialize_page,
    validate_media_url,
)
from app.utils import require_valid_uuid

router = APIRouter()

_seller_or_admin = require_auth

HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


async def _load_owned_page(db, seller_id: str, display_name: str = "") -> dict[str, Any]:
    """Fetch (or lazily create) the caller's page. Every write path starts here."""
    row = await db.fetchrow(
        f"{PAGE_SELECT} WHERE sp.seller_id = $1::uuid",
        seller_id,
    )
    if row:
        return dict(row)
    await get_or_create_page(db, seller_id, display_name)
    row = await db.fetchrow(
        f"{PAGE_SELECT} WHERE sp.seller_id = $1::uuid",
        seller_id,
    )
    return dict(row)


async def _follower_count(db, page_id: str) -> int:
    return int(await db.fetchval("SELECT COUNT(*) FROM seller_page_follows WHERE seller_page_id = $1", page_id) or 0)


def _require_seller_role(user: dict) -> None:
    if user.get("role") not in ("seller", "admin"):
        raise HTTPException(
            status_code=403,
            detail={
                "code": "FORBIDDEN",
                "message": "Only seller accounts can manage a showcase page.",
            },
        )


# ── Page profile ──────────────────────────────────────────────────────────────

class UpdatePageBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    handle: Optional[str] = None
    tagline: Optional[str] = Field(default=None, max_length=140)
    bio: Optional[str] = Field(default=None, max_length=5000)
    theme_accent: Optional[str] = None
    seo_title: Optional[str] = Field(default=None, max_length=160)
    seo_description: Optional[str] = Field(default=None, max_length=320)
    avatar_media_id: Optional[str] = None
    cover_media_id: Optional[str] = None


@router.get("/mine")
async def get_my_page(
    user: dict = Depends(_seller_or_admin), db=Depends(get_db)
) -> dict:
    _require_seller_role(user)
    page = await _load_owned_page(db, user["id"])
    entitlement = await get_entitlement(db, user["id"])

    media_count = int(await db.fetchval(
        "SELECT COUNT(*) FROM seller_media WHERE seller_page_id = $1 AND is_active", page["id"]
    ) or 0)
    highlight_count = int(await db.fetchval(
        "SELECT COUNT(*) FROM seller_highlights WHERE seller_page_id = $1 AND is_active", page["id"]
    ) or 0)
    block_count = int(await db.fetchval(
        "SELECT COUNT(*) FROM seller_page_blocks WHERE seller_page_id = $1 AND is_active", page["id"]
    ) or 0)

    # Compose serialize_page rather than repeating its field list by hand. The
    # hand-rolled version had already drifted -- it was missing avatar_url and
    # cover_url, so the editor could not display the seller's own picture.
    return {
        "success": True,
        "data": {
            **serialize_page(page, entitlement, await _follower_count(db, str(page["id"]))),
            "public_url": f"/store/{page['handle']}",
            "usage": {
                "media": {"used": media_count, "limit": entitlement["max_media"]},
                "highlights": {"used": highlight_count, "limit": entitlement["max_highlights"]},
                "blocks": {"used": block_count, "limit": entitlement["max_blocks"]},
            },
        },
    }


@router.put("/mine")
async def update_my_page(
    body: UpdatePageBody, user: dict = Depends(_seller_or_admin), db=Depends(get_db)
) -> dict:
    _require_seller_role(user)
    page = await _load_owned_page(db, user["id"])
    entitlement = await get_entitlement(db, user["id"])

    updates: dict[str, Any] = {}

    if body.handle is not None:
        new_handle = normalize_handle(body.handle)
        if new_handle != page["handle"]:
            clash = await db.fetchval("SELECT 1 FROM seller_pages WHERE handle = $1", new_handle)
            if clash:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "code": "HANDLE_TAKEN",
                        "message": f"'{new_handle}' is already taken. Please choose another handle.",
                    },
                )
            updates["handle"] = new_handle

    if body.theme_accent is not None:
        require_feature(entitlement, "allows_custom_theme", "A custom accent colour")
        if not HEX_COLOR_RE.match(body.theme_accent):
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "INVALID_ACCENT",
                    "message": "Accent colour must be a hex value like #38bdf8.",
                },
            )
        updates["theme_accent"] = body.theme_accent

    for field in ("tagline", "bio", "seo_title", "seo_description"):
        value = getattr(body, field)
        if value is not None:
            updates[field] = value

    for field in ("avatar_media_id", "cover_media_id"):
        value = getattr(body, field)
        if value is None:
            continue
        if value == "":
            updates[field] = None
            continue
        media_id = require_valid_uuid(value, "MEDIA_NOT_FOUND", "Media item does not exist.")
        owned = await db.fetchval(
            "SELECT 1 FROM seller_media WHERE id = $1::uuid AND seller_page_id = $2",
            media_id, page["id"],
        )
        if not owned:
            raise HTTPException(
                status_code=404,
                detail={
                    "code": "MEDIA_NOT_FOUND",
                    "message": "That media item is not on your page.",
                },
            )
        updates[field] = media_id

    if not updates:
        return {
            "success": True,
            "data": {"updated": 0, "handle": page["handle"], "message": "Nothing to update."},
        }

    assignments = ", ".join(f"{k} = ${i + 2}" for i, k in enumerate(updates))
    values = list(updates.values())
    await db.execute(
        f"UPDATE seller_pages SET {assignments} WHERE id = $1",
        page["id"], *values,
    )

    return {"success": True, "data": {"updated": len(updates), "handle": updates.get("handle", page["handle"])}}


class PublishBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    publish: bool = True


@router.post("/mine/publish")
async def set_published(
    body: PublishBody, user: dict = Depends(_seller_or_admin), db=Depends(get_db)
) -> dict:
    _require_seller_role(user)
    page = await _load_owned_page(db, user["id"])

    if body.publish:
        # A page with no avatar reads as broken, so warn by refusing to publish.
        has_avatar = await db.fetchval(
            "SELECT 1 FROM seller_media WHERE id = $1::uuid AND is_active",
            page["avatar_media_id"] or "00000000-0000-0000-0000-000000000000",
        )
        media_count = int(await db.fetchval(
            "SELECT COUNT(*) FROM seller_media WHERE seller_page_id = $1 AND is_active",
            page["id"],
        ) or 0)
        if not has_avatar or media_count < 1:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "PAGE_NOT_READY",
                    "message": "Add a profile photo and at least one media item before publishing.",
                    "details": {"has_avatar": bool(has_avatar), "media_count": media_count},
                },
            )

    await db.execute(
        """UPDATE seller_pages
              SET is_published = $2,
                  launched_at = CASE WHEN $2 AND launched_at IS NULL THEN NOW() ELSE launched_at END
            WHERE id = $1""",
        page["id"], body.publish,
    )

    return {
        "success": True,
        "data": {
            "is_published": body.publish,
            "public_url": f"/store/{page['handle']}" if body.publish else None,
        },
    }


# ── Media ─────────────────────────────────────────────────────────────────────

class AddMediaBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    media_type: str = Field(default="image", pattern="^(image|video)$")
    storage_id: str = Field(..., min_length=1, max_length=128)
    url: str = Field(..., min_length=1)
    thumbnail_url: Optional[str] = None
    poster_url: Optional[str] = None
    width: Optional[int] = Field(default=None, ge=1, le=20000)
    height: Optional[int] = Field(default=None, ge=1, le=20000)
    duration_ms: Optional[int] = Field(default=None, ge=0, le=3_600_000)
    caption: Optional[str] = Field(default=None, max_length=1000)
    alt_text: Optional[str] = Field(default=None, max_length=200)
    product_id: Optional[str] = None


@router.post("/mine/media", status_code=201)
async def add_media(
    body: AddMediaBody, user: dict = Depends(_seller_or_admin), db=Depends(get_db)
) -> dict:
    _require_seller_role(user)
    page = await _load_owned_page(db, user["id"])
    entitlement = await get_entitlement(db, user["id"])

    if body.media_type == "video":
        require_feature(entitlement, "allows_video", "Video uploads")
        if not body.poster_url:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "POSTER_REQUIRED",
                    "message": "Video uploads need a poster image so the grid does not render black boxes.",
                },
            )
        validate_media_url(body.poster_url, "poster_url")

    validate_media_url(body.url, "url")
    if body.thumbnail_url:
        validate_media_url(body.thumbnail_url, "thumbnail_url")

    current = int(await db.fetchval(
        "SELECT COUNT(*) FROM seller_media WHERE seller_page_id = $1 AND is_active", page["id"]
    ) or 0)
    require_capacity(entitlement, current, 1, "max_media", "media items")

    product_id = None
    if body.product_id:
        product_id = require_valid_uuid(body.product_id, "PRODUCT_NOT_FOUND", "Product does not exist.")
        owns = await db.fetchval(
            "SELECT 1 FROM products WHERE id = $1::uuid AND seller_id = $2::uuid",
            product_id, user["id"],
        )
        if not owns:
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "NOT_PRODUCT_OWNER",
                    "message": "You can only tag products from your own catalog.",
                },
            )

    next_sort = int(await db.fetchval(
        "SELECT COALESCE(MAX(sort_order), 0) + 1 FROM seller_media WHERE seller_page_id = $1",
        page["id"],
    ) or 1)

    row = await db.fetchrow(
        """INSERT INTO seller_media
             (seller_page_id, media_type, storage_id, url, thumbnail_url, poster_url,
              width, height, duration_ms, caption, alt_text, product_id, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           RETURNING id, media_type, url, thumbnail_url, poster_url, caption,
                     alt_text, product_id, is_pinned, sort_order, created_at""",
        page["id"], body.media_type, body.storage_id, body.url,
        validate_media_url(body.thumbnail_url, "thumbnail_url") if body.thumbnail_url else None,
        validate_media_url(body.poster_url, "poster_url") if body.poster_url else None,
        body.width, body.height, body.duration_ms, body.caption, body.alt_text,
        product_id, next_sort,
    )

    return {"success": True, "data": {k: (str(v) if k in ("id", "product_id") and v else v) for k, v in dict(row).items()}}


class UpdateMediaBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    caption: Optional[str] = Field(default=None, max_length=1000)
    alt_text: Optional[str] = Field(default=None, max_length=200)
    is_pinned: Optional[bool] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = Field(default=None, ge=0, le=100000)
    product_id: Optional[str] = None


@router.patch("/mine/media/{media_id}")
async def update_media(
    media_id: str,
    body: UpdateMediaBody,
    user: dict = Depends(_seller_or_admin),
    db=Depends(get_db),
) -> dict:
    _require_seller_role(user)
    page = await _load_owned_page(db, user["id"])
    mid = require_valid_uuid(media_id, "MEDIA_NOT_FOUND", "Media item does not exist.")

    owned = await db.fetchval(
        "SELECT 1 FROM seller_media WHERE id = $1::uuid AND seller_page_id = $2", mid, page["id"]
    )
    if not owned:
        raise HTTPException(
            status_code=404,
            detail={"code": "MEDIA_NOT_FOUND", "message": "Media item does not exist on your page."},
        )

    updates: dict[str, Any] = {}
    for field in ("caption", "alt_text", "is_pinned", "is_active", "sort_order"):
        value = getattr(body, field)
        if value is not None:
            updates[field] = value

    if body.product_id is not None:
        if body.product_id == "":
            updates["product_id"] = None
        else:
            pid = require_valid_uuid(body.product_id, "PRODUCT_NOT_FOUND", "Product does not exist.")
            owns = await db.fetchval(
                "SELECT 1 FROM products WHERE id = $1::uuid AND seller_id = $2::uuid", pid, user["id"]
            )
            if not owns:
                raise HTTPException(
                    status_code=403,
                    detail={
                        "code": "NOT_PRODUCT_OWNER",
                        "message": "You can only tag products from your own catalog.",
                    },
                )
            updates["product_id"] = pid

    if not updates:
        return {"success": True, "data": {"updated": 0}}

    assignments = ", ".join(f"{k} = ${i + 2}" for i, k in enumerate(updates))
    await db.execute(
        f"UPDATE seller_media SET {assignments} WHERE id = $1", mid, *updates.values()
    )
    return {"success": True, "data": {"updated": len(updates)}}


@router.delete("/mine/media/{media_id}")
async def delete_media(
    media_id: str, user: dict = Depends(_seller_or_admin), db=Depends(get_db)
) -> dict:
    _require_seller_role(user)
    page = await _load_owned_page(db, user["id"])
    mid = require_valid_uuid(media_id, "MEDIA_NOT_FOUND", "Media item does not exist.")

    # Soft delete: product_id references and pinned state stay auditable, and a
    # free-plan seller who re-adds the same post does not lose their sort slot.
    await db.execute(
        "UPDATE seller_media SET is_active = FALSE WHERE id = $1::uuid AND seller_page_id = $2",
        mid, page["id"],
    )
    await db.execute(
        """UPDATE seller_pages
              SET avatar_media_id = NULL WHERE id = $1 AND avatar_media_id = $2""",
        page["id"], mid,
    )
    return {"success": True, "data": {"deleted": True, "media_id": mid}}


# ── Highlights ────────────────────────────────────────────────────────────────

class AddHighlightBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(..., min_length=1, max_length=60)
    cover_media_id: Optional[str] = None


@router.post("/mine/highlights", status_code=201)
async def add_highlight(
    body: AddHighlightBody, user: dict = Depends(_seller_or_admin), db=Depends(get_db)
) -> dict:
    _require_seller_role(user)
    page = await _load_owned_page(db, user["id"])
    entitlement = await get_entitlement(db, user["id"])
    require_feature(entitlement, "allows_highlights", "Story highlights")

    current = int(await db.fetchval(
        "SELECT COUNT(*) FROM seller_highlights WHERE seller_page_id = $1 AND is_active", page["id"]
    ) or 0)
    require_capacity(entitlement, current, 1, "max_highlights", "highlights")

    cover = None
    if body.cover_media_id:
        cover = require_valid_uuid(body.cover_media_id, "MEDIA_NOT_FOUND", "Cover image does not exist.")
        owned = await db.fetchval(
            "SELECT 1 FROM seller_media WHERE id = $1::uuid AND seller_page_id = $2", cover, page["id"]
        )
        if not owned:
            raise HTTPException(
                status_code=404,
                detail={"code": "MEDIA_NOT_FOUND", "message": "That cover image is not on your page."},
            )

    next_sort = int(await db.fetchval(
        "SELECT COALESCE(MAX(sort_order), 0) + 1 FROM seller_highlights WHERE seller_page_id = $1",
        page["id"],
    ) or 1)

    row = await db.fetchrow(
        """INSERT INTO seller_highlights (seller_page_id, title, cover_media_id, sort_order)
           VALUES ($1, $2, $3, $4) RETURNING id, title, cover_media_id, sort_order""",
        page["id"], body.title, cover, next_sort,
    )
    return {"success": True, "data": {k: (str(v) if k.endswith("_id") and v else v) for k, v in dict(row).items()}}


class ReorderBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    # Ordered list of ids; the server rewrites sort_order from list position.
    ids: list[str] = Field(..., min_length=1, max_length=100)


async def _reorder(db, table: str, page_id: str, ids: list[str]) -> int:
    """
    Rewrite sort_order to match the submitted id order, scoped to the page.

    One statement rather than a loop: ids that do not belong to this page are
    silently ignored by the WHERE clause, and the returned row count is the
    honest number of items actually moved.
    """
    valid_ids = [require_valid_uuid(raw, "NOT_FOUND", "Item does not exist.") for raw in ids]
    return int(await db.fetchval(
        f"""WITH ordered AS (
                SELECT unnest($2::uuid[]) AS id,
                       generate_subscripts($2::uuid[], 1) AS position
            ),
            upd AS (
                UPDATE {table} t
                   SET sort_order = o.position
                  FROM ordered o
                 WHERE t.id = o.id AND t.seller_page_id = $1
             RETURNING 1
            )
            SELECT COUNT(*) FROM upd""",
        page_id, valid_ids,
    ) or 0)


@router.put("/mine/media/order")
async def reorder_media(
    body: ReorderBody, user: dict = Depends(_seller_or_admin), db=Depends(get_db)
) -> dict:
    _require_seller_role(user)
    page = await _load_owned_page(db, user["id"])
    return {"success": True, "data": {"reordered": await _reorder(db, "seller_media", page["id"], body.ids)}}


@router.put("/mine/highlights/order")
async def reorder_highlights(
    body: ReorderBody, user: dict = Depends(_seller_or_admin), db=Depends(get_db)
) -> dict:
    _require_seller_role(user)
    page = await _load_owned_page(db, user["id"])
    return {"success": True, "data": {"reordered": await _reorder(db, "seller_highlights", page["id"], body.ids)}}


@router.put("/mine/blocks/order")
async def reorder_blocks(
    body: ReorderBody, user: dict = Depends(_seller_or_admin), db=Depends(get_db)
) -> dict:
    _require_seller_role(user)
    page = await _load_owned_page(db, user["id"])
    return {"success": True, "data": {"reordered": await _reorder(db, "seller_page_blocks", page["id"], body.ids)}}


@router.delete("/mine/highlights/{highlight_id}")
async def delete_highlight(
    highlight_id: str, user: dict = Depends(_seller_or_admin), db=Depends(get_db)
) -> dict:
    _require_seller_role(user)
    page = await _load_owned_page(db, user["id"])
    hid = require_valid_uuid(highlight_id, "NOT_FOUND", "Highlight does not exist.")
    await db.execute(
        "DELETE FROM seller_highlights WHERE id = $1::uuid AND seller_page_id = $2", hid, page["id"]
    )
    return {"success": True, "data": {"deleted": True}}


# ── Blocks ────────────────────────────────────────────────────────────────────

class AddBlockBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    block_type: str
    title: Optional[str] = Field(default=None, max_length=140)
    subtitle: Optional[str] = Field(default=None, max_length=280)
    config: dict = Field(default_factory=dict)
    cta_label: Optional[str] = Field(default=None, max_length=60)
    cta_href: Optional[str] = Field(default=None, max_length=300)
    # Parsed by Pydantic rather than passed through as a string: asyncpg refuses
    # a str for a timestamptz column, so an ISO-8601 body would 500.
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None


@router.post("/mine/blocks", status_code=201)
async def add_block(
    body: AddBlockBody, user: dict = Depends(_seller_or_admin), db=Depends(get_db)
) -> dict:
    _require_seller_role(user)
    page = await _load_owned_page(db, user["id"])
    entitlement = await get_entitlement(db, user["id"])

    if body.block_type == "announcement":
        require_feature(entitlement, "allows_announcement", "Announcements")
    if body.block_type == "reels":
        require_feature(entitlement, "allows_reels", "Reels")

    current = int(await db.fetchval(
        "SELECT COUNT(*) FROM seller_page_blocks WHERE seller_page_id = $1 AND is_active", page["id"]
    ) or 0)
    require_capacity(entitlement, current, 1, "max_blocks", "page sections")

    next_sort = int(await db.fetchval(
        "SELECT COALESCE(MAX(sort_order), 0) + 1 FROM seller_page_blocks WHERE seller_page_id = $1",
        page["id"],
    ) or 1)

    try:
        row = await db.fetchrow(
            """INSERT INTO seller_page_blocks
                 (seller_page_id, block_type, title, subtitle, config, cta_label, cta_href,
                  starts_at, ends_at, sort_order)
               VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8::timestamptz,$9::timestamptz,$10)
               RETURNING id, block_type, title, subtitle, config, cta_label, cta_href,
                         starts_at, ends_at, sort_order""",
            page["id"], body.block_type, body.title, body.subtitle,
            json.dumps(body.config), body.cta_label, body.cta_href,
            body.starts_at, body.ends_at, next_sort,
        )
    except Exception as exc:
        # The CHECK constraints in V7 own CTA-safety, block type and the
        # schedule window. Surface them as a clean 400 rather than a 500.
        message = str(exc)
        if "chk_seller_block_cta_safe" in message:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "UNSAFE_CTA_URL",
                    "message": "Link must be a relative path (starting with /) or an absolute https:// URL.",
                },
            ) from exc
        if "chk_seller_block_type" in message:
            raise HTTPException(
                status_code=400,
                detail={"code": "INVALID_BLOCK_TYPE", "message": "Unsupported section type."},
            ) from exc
        if "chk_seller_block_window" in message:
            raise HTTPException(
                status_code=400,
                detail={"code": "INVALID_SCHEDULE", "message": "End date must be after the start date."},
            ) from exc
        raise

    return {"success": True, "data": {k: (str(v) if k == "id" else v) for k, v in dict(row).items()}}


@router.delete("/mine/blocks/{block_id}")
async def delete_block(
    block_id: str, user: dict = Depends(_seller_or_admin), db=Depends(get_db)
) -> dict:
    _require_seller_role(user)
    page = await _load_owned_page(db, user["id"])
    bid = require_valid_uuid(block_id, "NOT_FOUND", "Section does not exist.")
    await db.execute(
        "DELETE FROM seller_page_blocks WHERE id = $1::uuid AND seller_page_id = $2", bid, page["id"]
    )
    return {"success": True, "data": {"deleted": True}}


# ── Analytics ─────────────────────────────────────────────────────────────────

@router.get("/mine/analytics")
async def my_page_analytics(
    user: dict = Depends(_seller_or_admin), db=Depends(get_db)
) -> dict:
    """
    Page performance. Paid-tier only -- this is one of the headline elite
    features, and the underlying counters exist from day one so there is no
    backfill problem when a seller upgrades.
    """
    _require_seller_role(user)
    page = await _load_owned_page(db, user["id"])
    entitlement = await get_entitlement(db, user["id"])
    require_feature(entitlement, "allows_analytics", "Page analytics")

    followers = await _follower_count(db, str(page["id"]))

    top_media = await db.fetch(
        """SELECT id, media_type, url, thumbnail_url, poster_url, caption,
                  view_count, product_id
             FROM seller_media
            WHERE seller_page_id = $1 AND is_active
            ORDER BY view_count DESC, sort_order ASC, id ASC
            LIMIT 12""",
        page["id"],
    )

    tagged = await db.fetch(
        """SELECT m.id, m.url, m.thumbnail_url, m.caption, m.view_count,
                  p.id AS product_id, p.title, p.price, p.status
             FROM seller_media m
             JOIN products p ON p.id = m.product_id
            WHERE m.seller_page_id = $1 AND m.is_active
            ORDER BY m.view_count DESC
            LIMIT 20""",
        page["id"],
    )

    follower_growth = await db.fetch(
        """SELECT DATE(created_at) AS day, COUNT(*) AS follows
             FROM seller_page_follows
            WHERE seller_page_id = $1 AND created_at > NOW() - INTERVAL '30 days'
            GROUP BY DATE(created_at) ORDER BY day""",
        page["id"],
    )

    return {
        "success": True,
        "data": {
            "plan": entitlement["plan"],
            "totals": {
                "page_views": int(page["view_count"] or 0),
                "followers": followers,
                "media_count": int(await db.fetchval(
                    "SELECT COUNT(*) FROM seller_media WHERE seller_page_id = $1 AND is_active",
                    page["id"],
                ) or 0),
                "tagged_products": int(await db.fetchval(
                    "SELECT COUNT(*) FROM seller_media WHERE seller_page_id = $1 AND is_active AND product_id IS NOT NULL",
                    page["id"],
                ) or 0),
            },
            "top_media": [
                {
                    "id": str(m["id"]),
                    "media_type": m["media_type"],
                    "url": m["url"],
                    "thumbnail_url": m["thumbnail_url"],
                    "poster_url": m["poster_url"],
                    "caption": m["caption"],
                    "view_count": int(m["view_count"] or 0),
                    "product_id": str(m["product_id"]) if m["product_id"] else None,
                }
                for m in top_media
            ],
            "tagged_products": [
                {
                    "media_id": str(t["id"]),
                    "thumbnail_url": t["thumbnail_url"],
                    "url": t["url"],
                    "caption": t["caption"],
                    "views": int(t["view_count"] or 0),
                    "product_id": str(t["product_id"]),
                    "title": t["title"],
                    "price": float(t["price"]),
                    "status": t["status"],
                }
                for t in tagged
            ],
            "follower_growth_30d": [
                {"day": g["day"].isoformat(), "follows": int(g["follows"])} for g in follower_growth
            ],
        },
    }


# ── Plan management (admin-granted; billing attaches here later) ──────────────

class GrantPlanBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    seller_id: str
    plan: str = Field(..., pattern="^(free|pro|elite)$")
    price_inr: float = Field(default=0, ge=0)
    days: Optional[int] = Field(default=None, ge=1, le=3650)
    auto_renew: bool = False


@router.post("/mine/plan", status_code=201)
async def grant_own_plan(
    body: GrantPlanBody, user: dict = Depends(_seller_or_admin), db=Depends(get_db)
) -> dict:
    """
    Self-service plan change stub.

    Deliberately admin-only right now: billing is not wired, so letting a seller
    self-select a paid plan would be a trivially exploitable privilege bug. The
    moment Razorpay Subscriptions is connected this becomes the webhook target.
    """
    if user.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail={
                "code": "FORBIDDEN",
                "message": "Plan changes are made by Vyapari support until billing goes live.",
            },
        )

    seller_id = require_valid_uuid(body.seller_id, "USER_NOT_FOUND", "Seller does not exist.")
    is_seller = await db.fetchval(
        "SELECT 1 FROM users WHERE id = $1::uuid AND role IN ('seller','admin')", seller_id
    )
    if not is_seller:
        raise HTTPException(
            status_code=404,
            detail={"code": "USER_NOT_FOUND", "message": "Seller account does not exist."},
        )

    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                """UPDATE seller_subscriptions
                      SET status = 'cancelled'
                    WHERE seller_id = $1::uuid AND status IN ('trialing','active')""",
                seller_id,
            )
            row = await conn.fetchrow(
                """INSERT INTO seller_subscriptions
                     (seller_id, plan, status, price_inr, auto_renew, ends_at, granted_by)
                   VALUES ($1::uuid, $2, 'active', $3, $4,
                           CASE WHEN $5::int IS NULL THEN NULL
                                ELSE NOW() + make_interval(days => $5::int) END,
                           $6::uuid)
                   RETURNING id, plan, status, price_inr, ends_at""",
                seller_id, body.plan, body.price_inr, body.auto_renew,
                body.days, user["id"],
            )

    await invalidate_entitlement_cache(seller_id)

    return {
        "success": True,
        "data": {
            "id": str(row["id"]),
            "seller_id": seller_id,
            "plan": row["plan"],
            "status": row["status"],
            "price_inr": float(row["price_inr"]),
            "ends_at": row["ends_at"].isoformat() if row["ends_at"] else None,
        },
    }


@router.get("/plans")
async def list_plans(user: dict = Depends(_seller_or_admin)) -> dict:
    """Public plan matrix so the seller console can render the upgrade cards."""
    return {
        "success": True,
        "data": {
            "plans": [
                {"plan": name, **limits}
                for name, limits in TIERS.items()
            ]
        },
    }
