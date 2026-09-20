import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.auth.dependencies import require_role
from app.config import settings

router = APIRouter(tags=["ai"])
_seller_or_admin = Depends(require_role(["seller", "admin"]))


# ----------------------------------------------------------------------------
# Public AI Endpoints (Team A: Recommendations & Semantic Search)
# ----------------------------------------------------------------------------


@router.get("/similar/{product_id}")
async def get_similar_products(product_id: str, limit: int = Query(6)) -> dict:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{settings.RECOMMENDATION_SERVICE_URL}/similar/{product_id}?limit={limit}"
            )
            if resp.is_error:
                return JSONResponse(status_code=resp.status_code, content=resp.json())
            return {"success": True, "data": {"similar": resp.json()}}
    except httpx.HTTPStatusError as exc:
        return JSONResponse(status_code=exc.response.status_code, content=exc.response.json())
    except Exception as e:
        raise HTTPException(status_code=500, detail={"code": "AI_SERVICE_ERROR", "message": str(e)})


@router.get("/popular")
async def get_popular_products(limit: int = Query(8)) -> dict:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{settings.RECOMMENDATION_SERVICE_URL}/popular?limit={limit}"
            )
            if resp.is_error:
                return JSONResponse(status_code=resp.status_code, content=resp.json())
            return {"success": True, "data": {"popular": resp.json()}}
    except httpx.HTTPStatusError as exc:
        return JSONResponse(status_code=exc.response.status_code, content=exc.response.json())
    except Exception as e:
        raise HTTPException(status_code=500, detail={"code": "AI_SERVICE_ERROR", "message": str(e)})


@router.get("/search")
async def semantic_search(q: str = Query(None), limit: int = Query(12)) -> dict:
    if not q:
        raise HTTPException(
            status_code=400,
            detail={"code": "QUERY_REQUIRED", "message": "Search query q is required."},
        )
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{settings.RECOMMENDATION_SERVICE_URL}/search",
                params={"q": q, "limit": limit},
            )
            if resp.is_error:
                return JSONResponse(status_code=resp.status_code, content=resp.json())
            return {"success": True, "data": {"results": resp.json()}}
    except httpx.HTTPStatusError as exc:
        return JSONResponse(status_code=exc.response.status_code, content=exc.response.json())
    except Exception as e:
        raise HTTPException(status_code=500, detail={"code": "AI_SERVICE_ERROR", "message": str(e)})


@router.get("/recommendations/home/{user_id}")
async def get_home_recommendations(user_id: str, limit: int = Query(10)) -> dict:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{settings.RECOMMENDATION_SERVICE_URL}/recommendations/home/{user_id}?limit={limit}"
            )
            if resp.is_error:
                return JSONResponse(status_code=resp.status_code, content=resp.json())
            return {"success": True, "data": {"recommendations": resp.json()}}
    except httpx.HTTPStatusError as exc:
        return JSONResponse(status_code=exc.response.status_code, content=exc.response.json())
    except Exception as e:
        raise HTTPException(status_code=500, detail={"code": "AI_SERVICE_ERROR", "message": str(e)})


class InteractionBody(BaseModel):
    user_id: str | None = None
    session_id: str | None = None
    product_id: str
    event_type: str
    metadata: dict | None = None


@router.post("/interactions")
async def record_interaction(body: InteractionBody) -> dict:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                f"{settings.RECOMMENDATION_SERVICE_URL}/interactions",
                json=body.dict()
            )
            if resp.is_error:
                return JSONResponse(status_code=resp.status_code, content=resp.json())
            return {"success": True, "data": resp.json()}
    except httpx.HTTPStatusError as exc:
        return JSONResponse(status_code=exc.response.status_code, content=exc.response.json())
    except Exception as e:
        raise HTTPException(status_code=500, detail={"code": "AI_SERVICE_ERROR", "message": str(e)})


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
