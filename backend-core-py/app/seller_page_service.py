"""
Seller Showcase Pages — shared service layer.

Holds the logic that both the owner router (app/routers/seller_pages.py) and the
public router (app/routers/public_pages.py) need:

  * handle normalisation and validation
  * premium tier definitions and quota enforcement
  * entitlement lookup, cached in Redis because it gates every public render
  * get-or-create bootstrap for the 1:1 seller_pages row

Tier model (db/migrations/V7__seller_pages.sql -> seller_subscriptions)
---------------------------------------------------------------------
Every seller gets a page on the free tier -- that page is the upsell surface.
Pro and elite unlock capability. Billing is intentionally not wired here: a
plan is granted by the gateway or an admin, and Razorpay Subscriptions is
attached to the existing entitlement row later.
"""
import json
import re
from typing import Any

from fastapi import HTTPException

from app.redis_client import cache

# ---------------------------------------------------------------------------
# Shared SELECT for a seller_pages row.
#
# seller_pages stores avatar_media_id / cover_media_id, not URLs, so both the
# owner editor and the public render have to join seller_media to resolve them.
# Keeping the fragment here stops the two routers drifting apart -- an earlier
# revision had the join only on one side, which made avatar_url come back null
# everywhere and silently dropped every seller's profile picture.
# ---------------------------------------------------------------------------
PAGE_SELECT = """
    SELECT sp.*,
           prof.store_name,
           prof.description AS store_description,
           prof.business_info,
           prof.is_verified,
           prof.rating_avg AS seller_rating_avg,
           avatar.url       AS avatar_url,
           avatar.thumbnail_url AS avatar_thumbnail_url,
           cover.url        AS cover_url
      FROM seller_pages sp
      LEFT JOIN seller_profiles prof ON prof.user_id = sp.seller_id
      LEFT JOIN seller_media avatar
             ON avatar.id = sp.avatar_media_id AND avatar.is_active
      LEFT JOIN seller_media cover
             ON cover.id = sp.cover_media_id AND cover.is_active
"""

# ── Handle rules ──────────────────────────────────────────────────────────────

HANDLE_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{2,29}$")

RESERVED_HANDLES = {
    "admin", "api", "about", "account", "cart", "checkout", "explore", "help",
    "login", "logout", "orders", "privacy", "products", "register", "search",
    "seller", "sellers", "store", "stores", "support", "terms", "wishlist",
    "www", "helpdesk", "returns", "notifications", "settings", "payments",
}


def normalize_handle(raw: str) -> str:
    """
    Lowercase, strip decoration, and validate a public page handle.

    Raises 400 with a specific reason so the seller console can show inline
    guidance rather than a generic failure.
    """
    if not raw or not isinstance(raw, str):
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_HANDLE", "message": "A page handle is required."},
        )

    # Accept "Aura Living" and "@aura_living" as input, normalise to "aura-living".
    cleaned = raw.strip().lstrip("@").lower()
    cleaned = re.sub(r"[\s_]+", "-", cleaned)
    cleaned = re.sub(r"-{2,}", "-", cleaned).strip("-")

    if not cleaned:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_HANDLE", "message": "A page handle is required."},
        )
    if len(cleaned) < 3:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_HANDLE",
                "message": "Handle must be at least 3 characters long.",
            },
        )
    if len(cleaned) > 30:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_HANDLE",
                "message": "Handle must be 30 characters or fewer.",
            },
        )
    if not re.match(r"^[a-z0-9][a-z0-9-]*$", cleaned):
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_HANDLE",
                "message": "Handle may only use lowercase letters, numbers and hyphens.",
            },
        )
    if not HANDLE_RE.match(cleaned):
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_HANDLE",
                "message": "Handle must be 3-30 characters, start with a letter or number.",
            },
        )
    if cleaned in RESERVED_HANDLES:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_HANDLE",
                "message": f"'{cleaned}' is a reserved word. Please choose another handle.",
            },
        )
    return cleaned


# ── Tier definitions ──────────────────────────────────────────────────────────

TIERS: dict[str, dict[str, Any]] = {
    "free": {
        "label": "Starter",
        "max_media": 12,
        "max_highlights": 0,
        "max_blocks": 2,
        "allows_video": False,
        "allows_highlights": False,
        "allows_custom_theme": False,
        "allows_reels": False,
        "allows_announcement": False,
        "allows_analytics": False,
    },
    "pro": {
        "label": "Pro",
        "max_media": 120,
        "max_highlights": 8,
        "max_blocks": 8,
        "allows_video": True,
        "allows_highlights": True,
        "allows_custom_theme": True,
        "allows_reels": True,
        "allows_announcement": True,
        "allows_analytics": True,
    },
    "elite": {
        "label": "Elite",
        "max_media": 600,
        "max_highlights": 20,
        "max_blocks": 20,
        "allows_video": True,
        "allows_highlights": True,
        "allows_custom_theme": True,
        "allows_reels": True,
        "allows_announcement": True,
        "allows_analytics": True,
    },
}

# Expired subscriptions fall back to the free tier at read time.
LIVE_SUB_STATUSES = ("trialing", "active")

ENTITLEMENT_TTL_SECONDS = 300


def entitlement_cache_key(seller_id: str) -> str:
    return f"sellerpage:entitlement:{seller_id}"


async def invalidate_entitlement_cache(seller_id: str) -> None:
    """Called whenever a plan or subscription changes so the next read is fresh."""
    try:
        await cache.delete(entitlement_cache_key(seller_id))
    except Exception:
        # The cache layer never raises by contract; belt and braces here anyway.
        pass


async def get_entitlement(db, seller_id: str, *, use_cache: bool = True) -> dict[str, Any]:
    """
    Resolve a seller's current plan, falling back to 'free'.

    Cached in Redis because this gates every public page render and every
    seller-console write. 5-minute TTL means a lapsed subscription can still
    serve premium content for up to 5 minutes, which is the right trade.
    """
    if use_cache:
        cached = await cache.get_json(entitlement_cache_key(seller_id))
        if cached:
            return cached

    row = await db.fetchrow(
        f"""SELECT plan, status, ends_at
            FROM seller_subscriptions
            WHERE seller_id = $1 AND status = ANY($2::varchar[])
            LIMIT 1""",
        seller_id,
        list(LIVE_SUB_STATUSES),
    )

    # A lapsed subscription is treated as no subscription at all.
    if row and row["ends_at"] is not None:
        if await db.fetchval("SELECT NOW() > $1::timestamptz", row["ends_at"]):
            row = None

    plan = row["plan"] if row and row["plan"] in TIERS else "free"
    limits = TIERS[plan]
    payload = {
        "plan": plan,
        "status": row["status"] if row else "none",
        "ends_at": row["ends_at"].isoformat() if row and row["ends_at"] else None,
        **limits,
    }

    await cache.set_json(entitlement_cache_key(seller_id), payload, ex=ENTITLEMENT_TTL_SECONDS)
    return payload


def require_feature(entitlement: dict[str, Any], feature: str, feature_label: str) -> None:
    """Raise 402 Payment Required naming the plan that unlocks the feature."""
    if entitlement.get(feature):
        return
    raise HTTPException(
        status_code=402,
        detail={
            "code": "PLAN_UPGRADE_REQUIRED",
            "message": (
                f"{feature_label} is available on a paid plan. "
                f"Upgrade your seller page to unlock it."
            ),
            "details": {"feature": feature, "current_plan": entitlement.get("plan", "free")},
        },
    )


def require_capacity(
    entitlement: dict[str, Any], current_count: int, adding: int, limit_key: str, noun: str
) -> None:
    """Enforce a per-plan row-count ceiling before an insert."""
    cap = int(entitlement.get(limit_key, 0) or 0)
    if current_count + adding <= cap:
        return
    upgrade_to = "Pro" if entitlement.get("plan") == "free" else "Elite"
    raise HTTPException(
        status_code=402,
        detail={
            "code": "PLAN_LIMIT_REACHED",
            "message": (
                f"Your {TIERS[entitlement.get('plan', 'free')]['label']} plan allows "
                f"{cap} {noun}. You have {current_count}. Upgrade to {upgrade_to} for more."
            ),
            "details": {
                "limit": cap,
                "current": current_count,
                "resource": noun,
                "current_plan": entitlement.get("plan", "free"),
            },
        },
    )


# ── Page bootstrap ────────────────────────────────────────────────────────────

async def get_or_create_page(db, seller_id: str, display_name: str = "") -> dict[str, Any]:
    """
    Fetch the seller's page, creating one on first access.

    The auto-generated handle is derived from the store name and de-duplicated
    with a numeric suffix, because two sellers can easily normalise to the same
    slug (e.g. "Aura Living" and "Aura-Living").
    """
    row = await db.fetchrow("SELECT * FROM seller_pages WHERE seller_id = $1", seller_id)
    if row:
        return dict(row)

    if not display_name:
        # Derive from the store name so the seller's default handle is
        # recognisable ("aura-living") rather than an opaque "store-1a2b3c4d".
        display_name = await db.fetchval(
            "SELECT store_name FROM seller_profiles WHERE user_id = $1::uuid", seller_id
        ) or ""

    base = _slugify_seed(display_name) or f"store-{seller_id[:8]}"
    handle = base
    suffix = 1
    while await db.fetchval("SELECT 1 FROM seller_pages WHERE handle = $1", handle):
        suffix += 1
        handle = f"{base}-{suffix}"
        if suffix > 50:  # pathological; fall back to something guaranteed unique
            handle = f"{base}-{seller_id[:8]}"
            break

    created = await db.fetchrow(
        """INSERT INTO seller_pages (seller_id, handle, tagline, is_published)
           VALUES ($1, $2, $3, FALSE)
           ON CONFLICT (seller_id) DO UPDATE SET updated_at = NOW()
           RETURNING *""",
        seller_id,
        handle,
        (display_name[:140] if display_name else None),
    )
    return dict(created)


def _slugify_seed(name: str) -> str:
    """Best-effort handle seed. Deliberately lenient; normalize_handle validates."""
    if not name:
        return ""
    slug = re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-")
    return slug[:30]


# ── Media URL safety ──────────────────────────────────────────────────────────

ALLOWED_MEDIA_HOST_SUFFIXES = (
    ".appwrite.io",
    ".amazonaws.com",
    ".cloudfront.net",
    ".r2.dev",
    "cdn.vyapari.com",
)

BLOCKED_URL_SCHEMES = ("javascript:", "data:", "vbscript:", "file:")


def validate_media_url(url: str, field: str = "url") -> str:
    """
    Reject anything that is not an https URL on a known media CDN.

    seller_media.url is rendered into <img>/<video src> and into Appwrite-style
    transform URLs, so a javascript: or data: value here is a stored-XSS vector.
    """
    if not url or not isinstance(url, str):
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_MEDIA_URL", "message": f"{field} is required."},
        )

    candidate = url.strip()
    lowered = candidate.lower()

    for scheme in BLOCKED_URL_SCHEMES:
        if lowered.startswith(scheme):
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "INVALID_MEDIA_URL",
                    "message": f"{field} must be an https CDN URL.",
                },
            )

    if not lowered.startswith("https://"):
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_MEDIA_URL",
                "message": f"{field} must use https.",
            },
        )

    host = lowered.split("://", 1)[1].split("/", 1)[0]
    if not any(host == s.lstrip(".") or host.endswith(s) for s in ALLOWED_MEDIA_HOST_SUFFIXES):
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_MEDIA_URL",
                "message": (
                    f"{field} must point at an approved media host "
                    f"({', '.join(s.lstrip('.') for s in ALLOWED_MEDIA_HOST_SUFFIXES)})."
                ),
            },
        )
    return candidate


def jsonb_object(value: Any) -> dict[str, Any]:
    """
    Coerce a jsonb column to a dict.

    The pool sets no jsonb codec, so asyncpg hands jsonb back as raw text. The
    seller-page block API declares ``config`` as a dict on write, so returning
    the text on read made the contract asymmetric: the editor saved an object and
    the public page received a string, and every config-driven block silently
    fell back to defaults. Callers that already hold a dict pass through.
    """
    if isinstance(value, dict):
        return value
    if isinstance(value, (bytes, bytearray)):
        value = value.decode("utf-8", "replace")
    if isinstance(value, str):
        try:
            parsed = json.loads(value or "{}")
        except (TypeError, ValueError):
            return {}
        # jsonb accepts any scalar; only an object is a usable block config.
        return parsed if isinstance(parsed, dict) else {}
    return {}


def serialize_page(row: dict, entitlement: dict[str, Any], follower_count: int = 0) -> dict[str, Any]:
    """Shape a seller_pages row for the API, dropping internal columns."""
    return {
        "id": str(row["id"]),
        "seller_id": str(row["seller_id"]),
        "handle": row["handle"],
        "tagline": row.get("tagline"),
        "bio": row.get("bio"),
        "avatar_url": row.get("avatar_media_id") and row.get("avatar_url"),
        "avatar_media_id": str(row["avatar_media_id"]) if row.get("avatar_media_id") else None,
        "cover_media_id": str(row["cover_media_id"]) if row.get("cover_media_id") else None,
        "cover_url": row.get("cover_url"),
        "theme_accent": row.get("theme_accent"),
        "is_published": bool(row.get("is_published")),
        "seo_title": row.get("seo_title"),
        "seo_description": row.get("seo_description"),
        "view_count": int(row.get("view_count") or 0),
        "follower_count": int(follower_count),
        "launched_at": row["launched_at"].isoformat() if row.get("launched_at") else None,
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
        "plan": entitlement.get("plan", "free"),
        "entitlement": entitlement,
    }
