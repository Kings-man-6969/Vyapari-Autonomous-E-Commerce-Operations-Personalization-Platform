import hashlib
import json
import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.auth.dependencies import optional_auth, require_role
from app.config import settings
from app.db import get_db
from app.rate_limit import limit_for, rate_limit
from app.redis_client import (
    TTL_POPULAR,
    TTL_RECOMMENDATIONS,
    TTL_SEARCH,
    cache,
)
from app.utils import to_valid_uuid

logger = logging.getLogger("vyapari.ai")
router = APIRouter(tags=["ai"])
_seller_or_admin = Depends(require_role(["seller", "admin"]))


# ----------------------------------------------------------------------------
# Public AI Endpoints (Team A: Recommendations & Semantic Search)
# Resilient design: Gracefully falls back to primary database if AI microservice
# is starting up, cold, downloading weights, or unavailable. NEVER throws 500.
# ----------------------------------------------------------------------------


@router.get("/similar/{product_id}")
async def get_similar_products(
    product_id: str,
    limit: int = Query(6),
    db=Depends(get_db),
) -> dict:
    cache_key = f"products:similar:{product_id.strip().lower()}:{limit}"
    cached = await cache.get_json(cache_key)
    if cached:
        return cached

    result: dict | None = None

    # 1. Attempt call to Team A recommendation microservice
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(
                f"{settings.RECOMMENDATION_SERVICE_URL}/similar/{product_id}?limit={limit}"
            )
            if not resp.is_error and resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list) and len(data) > 0:
                    result = {"success": True, "data": {"similar": data}}
    except Exception as exc:
        logger.warning(f"Recommendation service /similar error: {exc}. Falling back to DB.")

    if not result:
        # 2. Resilient Database Fallback:
        # Query products in the same category or general active products
        try:
            p_uuid = to_valid_uuid(product_id)
            if p_uuid:
                rows = await db.fetch(
                    """SELECT p.id, p.title, p.price, p.compare_at_price, p.images, p.stock_qty, p.status,
                              0.85 AS similarity, 'category_fallback' AS reason
                       FROM products p
                       WHERE p.status = 'active' AND p.id != $1::uuid
                         AND p.category_id = (SELECT category_id FROM products WHERE id = $1::uuid)
                       ORDER BY p.created_at DESC LIMIT $2""",
                    p_uuid, limit,
                )
                if rows:
                    result = {"success": True, "data": {"similar": [dict(r) for r in rows]}}

            if not result:
                fallback_rows = await db.fetch(
                    """SELECT p.id, p.title, p.price, p.compare_at_price, p.images, p.stock_qty, p.status,
                              0.75 AS similarity, 'newest_fallback' AS reason
                       FROM products p
                       WHERE p.status = 'active'
                       ORDER BY p.created_at DESC LIMIT $1""",
                    limit,
                )
                result = {"success": True, "data": {"similar": [dict(r) for r in fallback_rows]}}
        except Exception as exc:
            logger.error(f"Fallback similar query failed: {exc}")
            result = {"success": True, "data": {"similar": []}}

    await cache.set_json(cache_key, result, ex=TTL_POPULAR)
    return result


@router.get("/popular")
async def get_popular_products(
    limit: int = Query(8),
    days: int = Query(30, ge=1, le=365),
    db=Depends(get_db),
) -> dict:
    """
    Most-viewed, most-bought products in the window, from our own rollup.

    This used to call the recommendation service and, when that was unreachable
    -- which is always, since it is not deployed -- fall back to
    `ORDER BY created_at DESC` and label the result `popular_db_fallback`. It was
    a newest-first list wearing the word "popular", and the label was the only
    thing that said so.

    Now it reads `product_stats_daily`, which section I1 writes. When the window
    genuinely has no stats -- a fresh install, or a rollup that has never run --
    the response says `basis: "newest"` rather than pretending. A client can tell
    the two apart, which it could not before.
    """
    cache_key = f"products:popular:{limit}:{days}"
    cached = await cache.get_json(cache_key)
    if cached:
        return cached

    rows = await db.fetch(
        """
        SELECT p.id, p.title, p.slug, p.price, p.compare_at_price, p.images,
               p.stock_qty, p.status,
               COALESCE(SUM(s.views), 0)     AS views,
               COALESCE(SUM(s.purchases), 0) AS purchases,
               COALESCE(SUM(s.revenue), 0)   AS revenue
          FROM products p
          JOIN product_stats_daily s ON s.product_id = p.id
         WHERE p.status = 'active'
           AND s.stat_date >= CURRENT_DATE - ($2::int - 1) * INTERVAL '1 day'
         GROUP BY p.id
        HAVING COALESCE(SUM(s.views), 0) > 0 OR COALESCE(SUM(s.purchases), 0) > 0
         -- Purchases first, then views: a sale is a stronger signal than a look,
         -- and a product viewed 10,000 times and bought twice should not outrank
         -- one bought forty times.
         ORDER BY COALESCE(SUM(s.purchases), 0) DESC, COALESCE(SUM(s.views), 0) DESC
         LIMIT $1
        """,
        limit,
        days,
    )

    if rows:
        result = {
            "success": True,
            "data": {
                "popular": [_product_row(r, "popular") for r in rows],
                "basis": "stats",
                "window_days": days,
            },
        }
    else:
        newest = await db.fetch(
            """SELECT p.id, p.title, p.slug, p.price, p.compare_at_price, p.images,
                      p.stock_qty, p.status,
                      0 AS views, 0 AS purchases, 0 AS revenue
                 FROM products p
                WHERE p.status = 'active'
                ORDER BY p.created_at DESC LIMIT $1""",
            limit,
        )
        result = {
            "success": True,
            "data": {
                "popular": [_product_row(r, "newest") for r in newest],
                # Said out loud. The frontend renders this list either way, and
                # an operator reading the payload can see the ranking has no
                # activity behind it.
                "basis": "newest",
                "window_days": days,
            },
        }

    await cache.set_json(cache_key, result, ex=TTL_POPULAR)
    return result


def _product_row(row, reason: str) -> dict:
    d = dict(row)
    d["id"] = str(d["id"])
    d["price"] = float(d["price"]) if d["price"] is not None else None
    d["compare_at_price"] = (
        float(d["compare_at_price"]) if d.get("compare_at_price") is not None else None
    )
    d["views"] = int(d.get("views") or 0)
    d["purchases"] = int(d.get("purchases") or 0)
    d["revenue"] = float(d.get("revenue") or 0)
    d["reason"] = reason
    return d


@router.get("/search")
async def semantic_search(
    q: str = Query(None),
    limit: int = Query(12),
    _rl=Depends(rate_limit("ai.search", *limit_for("ai.search"))),
    db=Depends(get_db),
) -> dict:
    if not q or not q.strip():
        raise HTTPException(
            status_code=400,
            detail={"code": "QUERY_REQUIRED", "message": "Search query q is required."},
        )
    term = q.strip()
    term_hash = hashlib.md5(f"{term.lower()}:{limit}".encode("utf-8")).hexdigest()
    cache_key = f"search:semantic:{term_hash}"
    cached = await cache.get_json(cache_key)
    if cached:
        return cached

    result: dict | None = None

    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(
                f"{settings.RECOMMENDATION_SERVICE_URL}/search",
                params={"q": term, "limit": limit},
            )
            if not resp.is_error and resp.status_code == 200:
                result = {"success": True, "data": {"results": resp.json()}}
    except Exception as exc:
        logger.warning(f"Recommendation service /search error: {exc}. Falling back to DB keyword search.")

    if not result:
        try:
            term_like = f"%{term}%"
            rows = await db.fetch(
                """SELECT p.id, p.title, p.description, p.price, p.compare_at_price, p.stock_qty,
                          p.images, p.attributes, 0.90 AS similarity
                   FROM products p
                   WHERE p.status = 'active' AND (p.title ILIKE $1 OR p.description ILIKE $1)
                   ORDER BY p.created_at DESC LIMIT $2""",
                term_like, limit,
            )
            result = {"success": True, "data": {"results": [dict(r) for r in rows]}}
        except Exception as exc:
            logger.error(f"Fallback search query failed: {exc}")
            result = {"success": True, "data": {"results": []}}

    await cache.set_json(cache_key, result, ex=TTL_SEARCH)
    return result


@router.get("/recommendations/home/{user_id}")
async def get_home_recommendations(
    user_id: str,
    limit: int = Query(10),
    db=Depends(get_db),
) -> dict:
    cache_key = f"recommendations:home:{user_id.strip()}:{limit}"
    cached = await cache.get_json(cache_key)
    if cached:
        return cached

    result: dict | None = None

    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(
                f"{settings.RECOMMENDATION_SERVICE_URL}/recommendations/home/{user_id}?limit={limit}"
            )
            if not resp.is_error and resp.status_code == 200:
                result = {"success": True, "data": {"recommendations": resp.json()}}
    except Exception as exc:
        logger.warning(f"Recommendation service /recommendations/home error: {exc}. Falling back to DB.")

    if not result:
        try:
            rows = await db.fetch(
                """SELECT p.id, p.title, p.price, p.compare_at_price, p.images, p.stock_qty, p.status,
                          1.0 AS similarity, 'home_fallback' AS reason
                   FROM products p
                   WHERE p.status = 'active' AND p.stock_qty > 0
                   ORDER BY p.created_at DESC LIMIT $1""",
                limit,
            )
            result = {"success": True, "data": {"recommendations": [dict(r) for r in rows]}}
        except Exception as exc:
            logger.error(f"Fallback home recommendations failed: {exc}")
            result = {"success": True, "data": {"recommendations": []}}

    await cache.set_json(cache_key, result, ex=TTL_RECOMMENDATIONS)
    return result


class InteractionBody(BaseModel):
    # `user_id` is deliberately absent. It used to be taken from the body, which
    # let any caller attribute an interaction to any account -- and the
    # recommender's notion of what a person likes is built from exactly this
    # table. The identity now comes from the access token when there is one.
    session_id: str | None = None
    product_id: str
    event_type: str
    metadata: dict | None = None


#: The `user_interactions.event_type` CHECK constraint.
ALL_EVENT_TYPES = ("view", "click", "add_to_cart", "purchase", "wishlist")

#: What a client may report. `purchase` is excluded: a purchase is something the
#: platform knows from `order_items`, and a client that can post one can inflate
#: its own product's numbers. The rollup reads sales from the order, not from
#: here, so this closes a hole rather than changing a figure.
CLIENT_EVENT_TYPES = ("view", "click", "add_to_cart", "wishlist")


@router.post("/interactions")
async def record_interaction(
    body: InteractionBody,
    request: Request,
    user: dict | None = Depends(optional_auth),
    _rl=Depends(rate_limit("ai.interactions", *limit_for("ai.interactions"))),
    db=Depends(get_db),
) -> dict:
    """
    Record one product interaction.

    Three things the previous version got wrong, all of which made this endpoint
    worse than useless in a way nothing could detect:

      * **It returned early on a successful forward.** The platform's own table
        was written only when the recommendation service was unreachable -- which
        is always, since it is not deployed. So the one copy of this data we own
        was the fallback for a service that never answered. The local write now
        always happens; the forward is a side effect that is reported, not a
        gate.

      * **Every failure was swallowed.** A `product_id` that was not a UUID took
        the `if p_uuid:` branch and wrote nothing; an `event_type` outside the
        CHECK constraint raised and was caught; both returned `{"logged": true}`.
        The caller, and anyone reading the frontend's network tab, saw success.

      * **The subject was whatever the client said.** See `InteractionBody`.
    """
    if body.event_type not in CLIENT_EVENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "UNKNOWN_EVENT_TYPE",
                "message": f"event_type must be one of: {', '.join(CLIENT_EVENT_TYPES)}.",
                "data": {"allowed": list(CLIENT_EVENT_TYPES)},
            },
        )

    product_id = to_valid_uuid(body.product_id)
    if not product_id:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "VALIDATION_ERROR",
                "message": "'product_id' must be a valid UUID.",
                "data": {"field": "product_id"},
            },
        )

    user_id = user.get("id") if isinstance(user, dict) else None

    # An interaction with no subject cannot personalise anything. Anonymous
    # traffic is the majority, so this is why `session_id` exists -- but a row
    # with neither is unattributable and is not worth the write.
    if not user_id and not (body.session_id or "").strip():
        raise HTTPException(
            status_code=400,
            detail={
                "code": "SESSION_REQUIRED",
                "message": "A session_id is required when not signed in.",
                "data": {"field": "session_id"},
            },
        )

    exists = await db.fetchval(
        "SELECT 1 FROM products WHERE id = $1::uuid", product_id
    )
    if not exists:
        raise HTTPException(
            status_code=404,
            detail={"code": "PRODUCT_NOT_FOUND", "message": "That product does not exist."},
        )

    await db.execute(
        """INSERT INTO user_interactions (user_id, session_id, product_id, event_type, metadata)
           VALUES ($1::uuid, $2, $3::uuid, $4, $5::jsonb)""",
        user_id,
        (body.session_id or "").strip() or None,
        product_id,
        body.event_type,
        json.dumps(body.metadata or {}),
    )

    # Best effort, and reported rather than assumed. The local row is already
    # written, so a cold or absent recommender costs nothing but the flag.
    forwarded = False
    try:
        async with httpx.AsyncClient(timeout=1.5) as client:
            resp = await client.post(
                f"{settings.RECOMMENDATION_SERVICE_URL}/interactions",
                json={
                    "user_id": user_id,
                    "session_id": body.session_id,
                    "product_id": product_id,
                    "event_type": body.event_type,
                    "metadata": body.metadata or {},
                },
            )
            forwarded = not resp.is_error
    except Exception as exc:  # noqa: BLE001 - the local write already succeeded
        logger.debug(f"Interaction forward skipped: {exc}")

    return {"success": True, "data": {"logged": True, "user_id": user_id, "forwarded": forwarded}}


# ----------------------------------------------------------------------------
# Seller-Protected AI Endpoints (Team B: Agentic Operations)
# ----------------------------------------------------------------------------


class GenerateListingBody(BaseModel):
    prompt: str | None = None
    category_id: str | None = None
    image_urls: list[str] | None = None
    notes: str | None = None


@router.post("/generate-listing")
async def generate_listing(
    body: GenerateListingBody,
    user: dict = _seller_or_admin,
):
    if not body.prompt:
        raise HTTPException(
            status_code=400,
            detail={"code": "PROMPT_REQUIRED", "message": "Product prompt is required for AI generation."},
        )

    payload = {
        "seller_id": user["id"],
        "prompt": body.prompt,
        "category_id": body.category_id,
        "image_urls": body.image_urls or [],
        "notes": body.notes,
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{settings.SELLER_AGENT_SERVICE_URL}/agents/generate-listing",
                json=payload,
            )
            return JSONResponse(status_code=resp.status_code, content=resp.json())
    except httpx.HTTPStatusError as exc:
        return JSONResponse(status_code=exc.response.status_code, content=exc.response.json())
    except Exception as e:
        raise HTTPException(status_code=500, detail={"code": "AGENT_SERVICE_ERROR", "message": str(e)})


class InventoryAdvisoryBody(BaseModel):
    product_id: str | None = None
    current_stock: int | None = None
    sales_velocity_7d: int | None = None


@router.post("/inventory-advisory")
async def inventory_advisory(
    body: InventoryAdvisoryBody,
    user: dict = _seller_or_admin,
):
    if not body.product_id or body.current_stock is None:
        raise HTTPException(
            status_code=400,
            detail={"code": "VALIDATION_ERROR", "message": "product_id and current_stock are required."},
        )

    payload = {
        "seller_id": user["id"],
        "product_id": body.product_id,
        "current_stock": int(body.current_stock),
        "sales_velocity_7d": int(body.sales_velocity_7d or 5),
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{settings.SELLER_AGENT_SERVICE_URL}/agents/inventory-advisory",
                json=payload,
            )
            return JSONResponse(status_code=resp.status_code, content=resp.json())
    except httpx.HTTPStatusError as exc:
        return JSONResponse(status_code=exc.response.status_code, content=exc.response.json())
    except Exception as e:
        raise HTTPException(status_code=500, detail={"code": "AGENT_SERVICE_ERROR", "message": str(e)})


class SupportReplyBody(BaseModel):
    source_type: str | None = "order_query"
    source_id: str | None = None
    customer_query: str | None = None


@router.post("/support-reply")
async def support_reply(
    body: SupportReplyBody,
    user: dict = _seller_or_admin,
):
    if not body.customer_query:
        raise HTTPException(
            status_code=400,
            detail={"code": "QUERY_REQUIRED", "message": "customer_query is required."},
        )

    payload = {
        "seller_id": user["id"],
        "source_type": body.source_type or "order_query",
        "source_id": body.source_id,
        "customer_query": body.customer_query,
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{settings.SELLER_AGENT_SERVICE_URL}/agents/support-reply",
                json=payload,
            )
            return JSONResponse(status_code=resp.status_code, content=resp.json())
    except httpx.HTTPStatusError as exc:
        return JSONResponse(status_code=exc.response.status_code, content=exc.response.json())
    except Exception as e:
        raise HTTPException(status_code=500, detail={"code": "AGENT_SERVICE_ERROR", "message": str(e)})
