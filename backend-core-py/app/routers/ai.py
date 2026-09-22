import json
import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.auth.dependencies import require_role
from app.config import settings
from app.db import get_db
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
    # 1. Attempt call to Team A recommendation microservice
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(
                f"{settings.RECOMMENDATION_SERVICE_URL}/similar/{product_id}?limit={limit}"
            )
            if not resp.is_error and resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list) and len(data) > 0:
                    return {"success": True, "data": {"similar": data}}
    except Exception as exc:
        logger.warning(f"Recommendation service /similar error: {exc}. Falling back to DB.")

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
                return {"success": True, "data": {"similar": [dict(r) for r in rows]}}

        fallback_rows = await db.fetch(
            """SELECT p.id, p.title, p.price, p.compare_at_price, p.images, p.stock_qty, p.status,
                      0.75 AS similarity, 'popular_fallback' AS reason
               FROM products p
               WHERE p.status = 'active'
               ORDER BY p.created_at DESC LIMIT $1""",
            limit,
        )
        return {"success": True, "data": {"similar": [dict(r) for r in fallback_rows]}}
    except Exception as exc:
        logger.error(f"Fallback similar query failed: {exc}")
        return {"success": True, "data": {"similar": []}}


@router.get("/popular")
async def get_popular_products(
    limit: int = Query(8),
    db=Depends(get_db),
) -> dict:
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(
                f"{settings.RECOMMENDATION_SERVICE_URL}/popular?limit={limit}"
            )
            if not resp.is_error and resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list) and len(data) > 0:
                    return {"success": True, "data": {"popular": data}}
    except Exception as exc:
        logger.warning(f"Recommendation service /popular error: {exc}. Falling back to DB.")

    try:
        rows = await db.fetch(
            """SELECT p.id, p.title, p.price, p.compare_at_price, p.images, p.stock_qty, p.status,
                      1.0 AS similarity, 'popular_db_fallback' AS reason
               FROM products p
               WHERE p.status = 'active' AND p.stock_qty > 0
               ORDER BY p.created_at DESC LIMIT $1""",
            limit,
        )
        return {"success": True, "data": {"popular": [dict(r) for r in rows]}}
    except Exception as exc:
        logger.error(f"Fallback popular query failed: {exc}")
        return {"success": True, "data": {"popular": []}}


@router.get("/search")
async def semantic_search(
    q: str = Query(None),
    limit: int = Query(12),
    db=Depends(get_db),
) -> dict:
    if not q or not q.strip():
        raise HTTPException(
            status_code=400,
            detail={"code": "QUERY_REQUIRED", "message": "Search query q is required."},
        )
    term = q.strip()
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(
                f"{settings.RECOMMENDATION_SERVICE_URL}/search",
                params={"q": term, "limit": limit},
            )
            if not resp.is_error and resp.status_code == 200:
                return {"success": True, "data": {"results": resp.json()}}
    except Exception as exc:
        logger.warning(f"Recommendation service /search error: {exc}. Falling back to DB keyword search.")

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
        return {"success": True, "data": {"results": [dict(r) for r in rows]}}
    except Exception as exc:
        logger.error(f"Fallback search query failed: {exc}")
        return {"success": True, "data": {"results": []}}


@router.get("/recommendations/home/{user_id}")
async def get_home_recommendations(
    user_id: str,
    limit: int = Query(10),
    db=Depends(get_db),
) -> dict:
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(
                f"{settings.RECOMMENDATION_SERVICE_URL}/recommendations/home/{user_id}?limit={limit}"
            )
            if not resp.is_error and resp.status_code == 200:
                return {"success": True, "data": {"recommendations": resp.json()}}
    except Exception as exc:
        logger.warning(f"Recommendation service /recommendations/home error: {exc}. Falling back to DB.")

    try:
        rows = await db.fetch(
            """SELECT p.id, p.title, p.price, p.compare_at_price, p.images, p.stock_qty, p.status,
                      1.0 AS similarity, 'home_fallback' AS reason
               FROM products p
               WHERE p.status = 'active' AND p.stock_qty > 0
               ORDER BY p.created_at DESC LIMIT $1""",
            limit,
        )
        return {"success": True, "data": {"recommendations": [dict(r) for r in rows]}}
    except Exception as exc:
        logger.error(f"Fallback home recommendations failed: {exc}")
        return {"success": True, "data": {"recommendations": []}}


class InteractionBody(BaseModel):
    user_id: str | None = None
    session_id: str | None = None
    product_id: str
    event_type: str
    metadata: dict | None = None


@router.post("/interactions")
async def record_interaction(body: InteractionBody, db=Depends(get_db)) -> dict:
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.post(
                f"{settings.RECOMMENDATION_SERVICE_URL}/interactions",
                json=body.dict()
            )
            if not resp.is_error:
                return {"success": True, "data": resp.json()}
    except Exception:
        pass

    try:
        p_uuid = to_valid_uuid(body.product_id)
        u_uuid = to_valid_uuid(body.user_id) if body.user_id else None
        if p_uuid:
            await db.execute(
                """INSERT INTO user_interactions (user_id, session_id, product_id, event_type, metadata)
                   VALUES ($1, $2, $3, $4, $5::jsonb)""",
                u_uuid, body.session_id, p_uuid, body.event_type, json.dumps(body.metadata or {})
            )
    except Exception:
        pass
    return {"success": True, "data": {"logged": True}}


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
