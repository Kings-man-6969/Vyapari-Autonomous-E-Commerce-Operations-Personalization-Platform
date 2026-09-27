"""
Content — storefront reads for banners and CMS copy.

Unauthenticated by design, and cached, because these are on the critical path
of the first paint: the homepage hero is the largest thing on the page and it
must not wait on a database round trip that changes twice a week.

Two things this router is careful about:

  * **A banner is only ever returned if it is genuinely live.** `is_active` is
    necessary and not sufficient -- a banner with a future `start_at` or a past
    `end_at` must not appear, and "is_active" alone would show it. The window
    predicate is in the SQL, not in Python, so the cached answer and a
    revalidation cannot disagree about a boundary.

  * **A missing CMS key is a normal answer, not an error.** Copy lives in the
    database and the keys live in the frontend; during a rolling deploy the two
    are briefly out of step. A 404 here would blank the homepage, so a missing
    key comes back as an empty object and the storefront keeps the copy it
    already has compiled in.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from app.db import get_db
from app.redis_client import cache

router = APIRouter(tags=["content"])

# The five slots V8's CHECK constraint allows. Duplicated here as a constant
# rather than read from the database: it is a validation vocabulary for the
# admin write path, and the database already enforces the real thing.
BANNER_PLACEMENTS = (
    "homepage_hero",
    "homepage_strip",
    "category_top",
    "pdp_promo",
    "seller_page",
)

# A slot renders a handful of items, not a page. The cap is here so a
# misconfigured sort_order cannot make the homepage load 10,000 rows.
MAX_BANNERS_PER_SLOT = 12

# CMS copy changes a few times a month; the storefront can serve a version that
# is a few minutes old. Short enough that an admin who fixes a broken headline
# sees it, long enough that this is a cache hit rather than a query.
CONTENT_TTL_SECONDS = 300


class CmsUpdateBody(BaseModel):
    """Admin write of one CMS key. Lives here so the shape is defined once."""

    value: dict | list
    note: Optional[str] = Field(default=None, max_length=200)

    @field_validator("value")
    @classmethod
    def _not_blank(cls, v):
        if v is None:
            raise ValueError("A value is required.")
        if isinstance(v, (dict, list)) and len(v) == 0:
            # An empty object is indistinguishable from "no content", and the
            # storefront cannot tell an empty section from a broken one. Refuse
            # it and let the admin delete the key instead, which is explicit.
            raise ValueError("Value cannot be empty. Delete the key to remove the section.")
        return v


def banner_cache_key(placement: str) -> str:
    return f"content:banners:{placement}"


def cms_cache_key(key: str) -> str:
    return f"content:cms:{key}"


# The live-window predicate, written once.
#
# `start_at IS NULL` means "no lower bound", `end_at IS NULL` means "no upper
# bound", and both being set is checked at write time by chk_banner_window. So
# this is a two-sided bound with optional edges, and it is applied in SQL so the
# index does the work.
LIVE_NOW = "CURRENT_TIMESTAMP"
LIVE_PREDICATE = f"(start_at IS NULL OR start_at <= {LIVE_NOW}) AND (end_at IS NULL OR end_at >= {LIVE_NOW})"


async def _invalidate_banner_slots(placements: list[str]) -> None:
    for placement in placements:
        await cache.delete(banner_cache_key(placement))


async def read_banners(db, placement: str) -> list[dict]:
    """One slot, live banners only, in display order."""
    rows = await db.fetch(
        f"""SELECT id, title, subtitle, media_type, url, thumbnail_url,
                   cta_label, target_url
              FROM banners
             WHERE placement = $1
               AND is_active
               AND {LIVE_PREDICATE}
             ORDER BY sort_order, created_at
             LIMIT {MAX_BANNERS_PER_SLOT}""",
        placement,
    )
    return [dict(r) for r in rows]


# ----------------------------------------------------------------------------
# Storefront reads
# ----------------------------------------------------------------------------
@router.get("/banners")
async def get_banners(
    placement: str = Query(..., description="One of: " + ", ".join(BANNER_PLACEMENTS)),
    db=Depends(get_db),
) -> dict:
    """
    Live banners for one slot.

    400 on an unknown placement rather than an empty list: a typo in a slot name
    is a bug, and an empty array looks identical to "no campaigns configured",
    which is the answer you do not want to debug at 2am.
    """
    if placement not in BANNER_PLACEMENTS:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "UNKNOWN_PLACEMENT",
                "message": f"Unknown banner slot '{placement}'.",
                "data": {"allowed": list(BANNER_PLACEMENTS)},
            },
        )

    cache_key = banner_cache_key(placement)
    cached = await cache.get_json(cache_key)
    if cached is not None:
        return {"success": True, "data": cached, "cached": True}

    banners = await read_banners(db, placement)
    await cache.set_json(cache_key, banners, ex=CONTENT_TTL_SECONDS)
    return {"success": True, "data": banners, "cached": False}


@router.get("/banners/{placement}/all")
async def get_all_slots(
    db=Depends(get_db),
) -> dict:
    """
    Every slot at once, for the storefront that mounts several.

    One round trip instead of five. The empty slots come back as empty arrays
    rather than being omitted, so the frontend can index without a guard on
    every access.
    """
    rows = await db.fetch(
        f"""SELECT id, placement, title, subtitle, media_type, url, thumbnail_url,
                   cta_label, target_url
              FROM banners
             WHERE is_active
               AND {LIVE_PREDICATE}
             ORDER BY placement, sort_order, created_at"""
    )
    grouped: dict[str, list] = {p: [] for p in BANNER_PLACEMENTS}
    for r in rows:
        d = dict(r)
        d["id"] = str(d["id"])
        grouped.setdefault(d["placement"], []).append(d)
    return {"success": True, "data": grouped}


@router.get("/cms/{key}")
async def get_cms_key(
    key: str,
    db=Depends(get_db),
) -> dict:
    """
    One CMS key.

    Always 200. A key that has never been written is `{"data": null}` and not a
    404, because the storefront's contract is "fall back to the compiled-in
    copy" and it can only honour that if absence is not an error.
    """
    cache_key = cms_cache_key(key)
    cached = await cache.get_json(cache_key)
    if cached is not None:
        return {"success": True, "data": cached, "cached": True}

    row = await db.fetchrow("SELECT value FROM cms_content WHERE key = $1", key)
    value = None if row is None else _decode(row["value"])
    if value is not None:
        await cache.set_json(cache_key, value, ex=CONTENT_TTL_SECONDS)
    # An unwritten key is deliberately not cached. `get_json` answers None for
    # both "not cached" and "cached null", so caching the absence would be
    # indistinguishable from a miss and the entry could never be trusted to
    # mean anything. The cost is one indexed primary-key lookup for a key that
    # is not configured, which is not worth a lie in the cache layer.
    return {"success": True, "data": value, "cached": False}


@router.get("/cms")
async def get_all_cms(db=Depends(get_db)) -> dict:
    """Every CMS key as one object, for the page that wants them all."""
    rows = await db.fetch("SELECT key, value FROM cms_content ORDER BY key")
    return {
        "success": True,
        "data": {r["key"]: _decode(r["value"]) for r in rows},
    }


def _decode(value):
    """jsonb arrives as text from asyncpg; the frontend wants an object."""
    if value is None or isinstance(value, (dict, list)):
        return value
    try:
        import json

        return json.loads(value)
    except (ValueError, TypeError):
        return None
