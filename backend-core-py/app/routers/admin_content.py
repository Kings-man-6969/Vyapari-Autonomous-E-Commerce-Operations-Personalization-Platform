"""
Admin content management — banners (G1) and CMS copy (G3).

Split from admin_catalogue.py because the rules are different in kind: a product
is business data with referential integrity, a banner is a scheduled creative
with a date window, and a CMS key is a blob of copy whose only contract is that
the storefront can read it back.

The one thing worth stating up front is what a write here invalidates. Banner
slots and CMS keys are read on the homepage's critical path and are cached for
CONTENT_TTL_SECONDS, so a write that does not clear its own cache entry is a
write the customer does not see for up to five minutes. Every mutating route
here ends by invalidating exactly the keys it could have affected -- the slot on
a banner write, the key on a CMS write -- and nothing else, because
`delete_prefix` over a wildcard would take the product cache with it.
"""
import json
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from app.auth.dependencies import require_role
from app.db import get_db
from app.redis_client import cache
from app.routers.admin_catalogue import _db_integrity_errors
from app.routers.content import (
    BANNER_PLACEMENTS,
    CmsUpdateBody,
    cms_cache_key,
    banner_cache_key,
)

router = APIRouter(tags=["admin-content"])
_admin_guard = Depends(require_role("admin"))

# Matches the banners table: title is VARCHAR(160), subtitle VARCHAR(255),
# cta_label VARCHAR(40). Validated here as well so the error is a 400 with a
# field name in it rather than a 500 from the database's name for the limit.
TITLE_MAX = 160
SUBTITLE_MAX = 255
CTA_MAX = 40

# A target_url that is not one of these is a link out of the site, and the
# storefront renders it as an <a href>. javascript: is the reason this check
# exists; a CMS editor typing a URL should never be able to ship script.
ALLOWED_SCHEMES = ("http://", "https://", "/")


class BannerBody(BaseModel):
    title: str = Field(..., max_length=TITLE_MAX)
    subtitle: str | None = Field(default=None, max_length=SUBTITLE_MAX)
    placement: str = Field(default="homepage_hero")
    media_type: str = Field(default="image")
    storage_provider: str = Field(default="local")
    storage_id: str | None = Field(default=None, max_length=128)
    url: str = Field(..., max_length=2048)
    thumbnail_url: str | None = Field(default=None, max_length=2048)
    cta_label: str | None = Field(default=None, max_length=CTA_MAX)
    target_url: str | None = Field(default=None, max_length=2048)
    start_at: datetime | None = None
    end_at: datetime | None = None
    is_active: bool = True
    sort_order: int = 0

    @field_validator("placement")
    @classmethod
    def _known_placement(cls, v):
        if v not in BANNER_PLACEMENTS:
            raise ValueError(
                f"Unknown placement '{v}'. Use one of: {', '.join(BANNER_PLACEMENTS)}."
            )
        return v

    @field_validator("media_type")
    @classmethod
    def _known_media(cls, v):
        if v not in ("image", "video"):
            raise ValueError("media_type must be 'image' or 'video'.")
        return v

    @field_validator("storage_provider")
    @classmethod
    def _known_provider(cls, v):
        # Not free text: 'appwrite' was V8's default and there is no such
        # provider in this codebase, so a bad value here is a banner that can
        # never be resolved to bytes.
        if v not in ("local", "s3"):
            raise ValueError("storage_provider must be 'local' or 's3'.")
        return v

    @field_validator("target_url")
    @classmethod
    def _safe_target(cls, v):
        if v is None or not v.strip():
            return None
        v = v.strip()
        if not v.startswith(ALLOWED_SCHEMES):
            raise ValueError("target_url must be an http(s) URL or a site-relative path.")
        return v

    @field_validator("url")
    @classmethod
    def _non_blank_url(cls, v):
        if not v.strip():
            raise ValueError("url cannot be blank -- a banner with no image renders an empty slot.")
        return v.strip()


class BannerUpdate(BaseModel):
    """Partial update. `null` means "not supplied" for every field."""

    title: str | None = Field(default=None, max_length=TITLE_MAX)
    subtitle: str | None = Field(default=None, max_length=SUBTITLE_MAX)
    placement: str | None = None
    media_type: str | None = None
    storage_provider: str | None = None
    storage_id: str | None = Field(default=None, max_length=128)
    url: str | None = Field(default=None, max_length=2048)
    thumbnail_url: str | None = Field(default=None, max_length=2048)
    cta_label: str | None = Field(default=None, max_length=CTA_MAX)
    target_url: str | None = Field(default=None, max_length=2048)
    start_at: datetime | None = None
    end_at: datetime | None = None
    is_active: bool | None = None
    sort_order: int | None = None

    @field_validator("placement")
    @classmethod
    def _known_placement(cls, v):
        if v is not None and v not in BANNER_PLACEMENTS:
            raise ValueError(
                f"Unknown placement '{v}'. Use one of: {', '.join(BANNER_PLACEMENTS)}."
            )
        return v

    @field_validator("media_type")
    @classmethod
    def _known_media(cls, v):
        if v is not None and v not in ("image", "video"):
            raise ValueError("media_type must be 'image' or 'video'.")
        return v

    @field_validator("storage_provider")
    @classmethod
    def _known_provider(cls, v):
        if v is not None and v not in ("local", "s3"):
            raise ValueError("storage_provider must be 'local' or 's3'.")
        return v

    @field_validator("target_url")
    @classmethod
    def _safe_target(cls, v):
        if v is None:
            return v
        if not v.strip():
            return v
        v = v.strip()
        if not v.startswith(ALLOWED_SCHEMES):
            raise ValueError("target_url must be an http(s) URL or a site-relative path.")
        return v


def _as_uuid(value, code, message):
    try:
        return uuid.UUID(str(value))
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(status_code=404, detail={"code": code, "message": message})


def _iso(value):
    return value.isoformat() if value else None


def _decode_jsonb(value):
    """jsonb comes off asyncpg as text. Decode it before re-encoding it."""
    if value is None or isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except (ValueError, TypeError):
        return None


def _row(row, now: datetime | None = None) -> dict:
    d = dict(row)
    d["id"] = str(d["id"])
    d["start_at"] = _iso(d.get("start_at"))
    d["end_at"] = _iso(d.get("end_at"))
    d["created_at"] = _iso(d.get("created_at"))
    d["updated_at"] = _iso(d.get("updated_at"))
    d["is_active"] = bool(d.get("is_active"))

    # Why a scheduled banner is not showing, in one field. `is_active` alone
    # cannot answer that: a banner can be active and out of its window, which
    # is the exact case an admin opens this screen to diagnose.
    #
    # This is a *report*, not the storefront's own predicate -- that lives in
    # content.py and is stricter (it filters in SQL). Computing it in Python
    # here is deliberate so the list can show a banner the storefront is
    # correctly hiding, instead of hiding it from the person who needs to see
    # that it exists.
    reference = now or datetime.now(datetime.now().astimezone().tzinfo)
    # Compared against the raw columns, before _iso() stringifies them above --
    # comparing an ISO string to a datetime is a TypeError, and `live` is the
    # field an admin is actually here to read.
    raw_start = row["start_at"]
    raw_end = row["end_at"]
    d["in_window"] = bool(
        (raw_start is None or raw_start <= reference)
        and (raw_end is None or raw_end >= reference)
    )
    d["live"] = d["is_active"] and d["in_window"]
    return d


async def _validate_window(db, start_at, end_at, exclude_id=None):
    """
    The table has chk_banner_window, but a constraint violation is a 500 and an
    admin who schedules end_at before start_at deserves to be told which field
    is wrong rather than discovering it as an internal error.
    """
    if start_at and end_at and end_at <= start_at:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_WINDOW",
                "message": "end_at must be after start_at.",
                "data": {"start_at": _iso(start_at), "end_at": _iso(end_at)},
            },
        )


# ----------------------------------------------------------------------------
# G1. Banners
# ----------------------------------------------------------------------------
@router.get("/banners")
async def admin_list_banners(
    placement: str = Query(None),
    include_inactive: bool = Query(True),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> dict:
    """
    Every banner, live or not.

    Inactive ones are included by default because the admin's job is mostly to
    look at a schedule and turn things on and off; a list that silently hides
    the disabled rows cannot answer "why is nothing showing".
    """
    where = []
    params: list = []
    if placement:
        if placement not in BANNER_PLACEMENTS:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "UNKNOWN_PLACEMENT",
                    "message": f"Unknown banner slot '{placement}'.",
                    "data": {"allowed": list(BANNER_PLACEMENTS)},
                },
            )
        params.append(placement)
        where.append(f"placement = ${len(params)}")
    if not include_inactive:
        where.append("is_active")

    clause = f"WHERE {' AND '.join(where)}" if where else ""
    total = await db.fetchval(f"SELECT COUNT(*) FROM banners {clause}", *params)
    params_for_page = list(params) + [limit, offset]
    rows = await db.fetch(
        f"""SELECT * FROM banners {clause}
             ORDER BY placement, sort_order, created_at
             LIMIT ${len(params) + 1} OFFSET ${len(params) + 2}""",
        *params_for_page,
    )
    return {
        "success": True,
        "data": [_row(r) for r in rows],
        "pagination": {
            "total": int(total or 0),
            "limit": limit,
            "offset": offset,
        },
    }


@router.post("/banners", status_code=201)
async def admin_create_banner(
    body: BannerBody,
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> dict:
    await _validate_window(db, body.start_at, body.end_at)
    try:
        row = await db.fetchrow(
            """INSERT INTO banners
                 (title, subtitle, placement, media_type, storage_provider, storage_id,
                  url, thumbnail_url, cta_label, target_url, start_at, end_at,
                  is_active, sort_order, created_by)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::uuid)
               RETURNING *""",
            body.title,
            body.subtitle,
            body.placement,
            body.media_type,
            body.storage_provider,
            body.storage_id,
            body.url,
            body.thumbnail_url,
            body.cta_label,
            body.target_url,
            body.start_at,
            body.end_at,
            body.is_active,
            body.sort_order,
            user["id"],
        )
    except _db_integrity_errors() as exc:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "BANNER_REJECTED",
                "message": "The banner could not be saved; the database refused it.",
                "data": {"constraint": getattr(exc, "constraint_name", None)},
            },
        )

    await cache.delete(banner_cache_key(row["placement"]))
    return {
        "success": True,
        "message": "Banner created.",
        "data": _row(row),
    }


@router.put("/banners/{banner_id}")
async def admin_update_banner(
    banner_id: str,
    body: BannerUpdate,
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> dict:
    b_uuid = _as_uuid(banner_id, "BANNER_NOT_FOUND", "Banner not found.")
    current = await db.fetchrow("SELECT * FROM banners WHERE id = $1::uuid", b_uuid)
    if not current:
        raise HTTPException(
            status_code=404, detail={"code": "BANNER_NOT_FOUND", "message": "Banner not found."}
        )

    # Merge so the window check sees the post-update pair, not just the fields
    # that were supplied: sending only end_at must be validated against the
    # stored start_at, or a bad combination can be assembled one field at a
    # time without ever tripping the check.
    start = body.start_at if body.start_at is not None else current["start_at"]
    end = body.end_at if body.end_at is not None else current["end_at"]
    await _validate_window(db, start, end)

    # A banner that moves slots invalidates two cache keys, not one.
    old_placement = current["placement"]
    new_placement = body.placement or old_placement

    # Built from `model_fields_set` rather than from a fixed COALESCE list.
    #
    # The nullable fields cannot use COALESCE, because for them `None` is a
    # real value -- clearing a subtitle is a thing an admin does. The first
    # version of this route wrote `subtitle = $3` for those columns, so omitting
    # a field sent null and *erased* it: renaming a banner's title silently
    # destroyed its subtitle, its thumbnail, its CTA and its target URL, all in
    # one request. `model_fields_set` is the only thing in pydantic that
    # distinguishes "the client did not mention this" from "the client said
    # null", and that distinction is the whole behaviour here.
    supplied = body.model_fields_set
    assignments = ["updated_at = CURRENT_TIMESTAMP"]
    params: list = [b_uuid]

    # No `::type` casts. Every one of these is a bare `column = $n` assignment,
    # so PostgreSQL already knows the target type and asyncpg is told the type
    # it wants when the statement is prepared. Casting by hand is how the first
    # version of this put `::timestamptz` on a `placement` string.
    for field in (
        "title",
        "subtitle",
        "placement",
        "media_type",
        "storage_provider",
        "storage_id",
        "url",
        "thumbnail_url",
        "cta_label",
        "target_url",
        "start_at",
        "end_at",
        "is_active",
        "sort_order",
    ):
        if field in supplied:
            params.append(getattr(body, field))
            assignments.append(f"{field} = ${len(params)}")

    if len(assignments) == 1:
        # An empty edit is not an error, but it must not run a statement that
        # sets nothing, and the response still has to be the current row.
        return {"success": True, "message": "Nothing to change.", "data": _row(current)}

    try:
        row = await db.fetchrow(
            f"UPDATE banners SET {', '.join(assignments)} WHERE id = $1::uuid RETURNING *",
            *params,
        )
    except _db_integrity_errors() as exc:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "BANNER_REJECTED",
                "message": "The banner could not be saved; the database refused it.",
                "data": {"constraint": getattr(exc, "constraint_name", None)},
            },
        )

    await cache.delete(banner_cache_key(old_placement))
    if new_placement != old_placement:
        await cache.delete(banner_cache_key(new_placement))
    return {"success": True, "message": "Banner updated.", "data": _row(row)}


@router.delete("/banners/{banner_id}")
async def admin_delete_banner(
    banner_id: str,
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> dict:
    b_uuid = _as_uuid(banner_id, "BANNER_NOT_FOUND", "Banner not found.")
    row = await db.fetchrow(
        "DELETE FROM banners WHERE id = $1::uuid RETURNING placement", b_uuid
    )
    if not row:
        raise HTTPException(
            status_code=404, detail={"code": "BANNER_NOT_FOUND", "message": "Banner not found."}
        )
    await cache.delete(banner_cache_key(row["placement"]))
    return {"success": True, "message": "Banner deleted."}


# ----------------------------------------------------------------------------
# G3. CMS-lite
# ----------------------------------------------------------------------------
@router.get("/content")
async def admin_list_cms(user: dict = _admin_guard, db=Depends(get_db)) -> dict:
    """Every CMS key with who last changed it and when."""
    rows = await db.fetch(
        """SELECT c.key, c.value, c.updated_at, c.created_at,
                  u.name AS updated_by_name
             FROM cms_content c
             LEFT JOIN users u ON u.id = c.updated_by
            ORDER BY c.key"""
    )
    out = []
    for r in rows:
        d = dict(r)
        d["value"] = _decode_jsonb(d["value"])
        d["updated_at"] = _iso(d.get("updated_at"))
        d["created_at"] = _iso(d.get("created_at"))
        out.append(d)
    return {"success": True, "data": out}


@router.get("/content/{key}")
async def admin_get_cms(key: str, user: dict = _admin_guard, db=Depends(get_db)) -> dict:
    row = await db.fetchrow("SELECT * FROM cms_content WHERE key = $1", key)
    if not row:
        raise HTTPException(
            status_code=404,
            detail={"code": "CMS_KEY_NOT_FOUND", "message": f"No content for key '{key}'."},
        )
    d = dict(row)
    d["value"] = _decode_jsonb(d["value"])
    d["updated_at"] = _iso(d.get("updated_at"))
    d["created_at"] = _iso(d.get("created_at"))
    return {"success": True, "data": d}


@router.put("/content/{key}")
async def admin_put_cms(
    key: str,
    body: CmsUpdateBody,
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> dict:
    """
    Write one CMS key, keeping the previous value as a revision.

    Upsert with a revision captured in the same transaction: a CMS write that
    updates the value and separately tries to record what it replaced can leave
    a history row describing a change that did not happen.
    """
    async with db.transaction():
        previous = await db.fetchval("SELECT value FROM cms_content WHERE key = $1", key)
        # Decode before re-encoding. asyncpg hands back jsonb as text, so
        # `json.dumps(previous)` would store a JSON *string literal* containing
        # the JSON, and every read of the history would give a string where the
        # editor expects an object -- a revision trail that cannot be rendered
        # and cannot be restored from.
        previous = _decode_jsonb(previous)
        await db.execute(
            """INSERT INTO cms_content (key, value, updated_by, updated_at)
               VALUES ($1, $2::jsonb, $3::uuid, CURRENT_TIMESTAMP)
               ON CONFLICT (key) DO UPDATE
                 SET value = EXCLUDED.value,
                     updated_by = EXCLUDED.updated_by,
                     updated_at = CURRENT_TIMESTAMP""",
            key,
            json.dumps(body.value),
            user["id"],
        )
        await db.execute(
            """INSERT INTO cms_content_revisions (key, previous, next, changed_by)
               VALUES ($1, $2::jsonb, $3::jsonb, $4::uuid)""",
            key,
            json.dumps(previous) if previous is not None else None,
            json.dumps(body.value),
            user["id"],
        )

    await cache.delete(cms_cache_key(key))
    return {"success": True, "message": f"Content saved for '{key}'."}


@router.delete("/content/{key}")
async def admin_delete_cms(
    key: str,
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> dict:
    """Remove a key. The storefront then falls back to its compiled-in copy."""
    row = await db.fetchrow("DELETE FROM cms_content WHERE key = $1 RETURNING key", key)
    if not row:
        raise HTTPException(
            status_code=404,
            detail={"code": "CMS_KEY_NOT_FOUND", "message": f"No content for key '{key}'."},
        )
    await cache.delete(cms_cache_key(key))
    return {"success": True, "message": f"Content removed for '{key}'."}


@router.get("/content/{key}/revisions")
async def admin_cms_revisions(
    key: str,
    limit: int = Query(50, ge=1, le=200),
    user: dict = _admin_guard,
    db=Depends(get_db),
) -> dict:
    """The last N values of a key, newest first, so a bad edit is recoverable."""
    rows = await db.fetch(
        """SELECT r.previous, r.next, r.changed_at, u.name AS changed_by_name
             FROM cms_content_revisions r
             LEFT JOIN users u ON u.id = r.changed_by
            WHERE r.key = $1
            ORDER BY r.changed_at DESC
            LIMIT $2""",
        key,
        limit,
    )
    out = []
    for r in rows:
        d = dict(r)
        d["previous"] = _decode_jsonb(d["previous"])
        d["next"] = _decode_jsonb(d["next"])
        d["changed_at"] = _iso(d.get("changed_at"))
        out.append(d)
    return {"success": True, "data": out}
