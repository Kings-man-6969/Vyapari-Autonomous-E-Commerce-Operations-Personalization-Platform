"""
Health check — port of backend-core/src/routes/health.js
GET /health
"""
from datetime import datetime, timezone
import httpx
from fastapi import APIRouter
from app.config import settings
from app.db import get_pool

router = APIRouter(tags=["health"])


@router.get("")
@router.get("/")
@router.get("/health")
async def health_check() -> dict:
    db_status = "disconnected"
    pgvector_status = "unknown"
    reco_service_status = "unknown"
    seller_agent_status = "unknown"

    # DB check
    try:
        pool = get_pool()
        async with pool.acquire() as conn:
            await conn.fetchrow("SELECT 1 AS alive")
            db_status = "healthy"
            vec_row = await conn.fetchrow(
                "SELECT extversion FROM pg_extension WHERE extname = 'vector'"
            )
            pgvector_status = (
                f"enabled (v{vec_row['extversion']})" if vec_row else "not installed"
            )
    except Exception as exc:
        db_status = f"error: {exc}"

    # Recommendation service check
    try:
        async with httpx.AsyncClient(timeout=1.5) as client:
            r = await client.get(f"{settings.RECOMMENDATION_SERVICE_URL}/health")
            reco_service_status = r.json().get("status", "healthy")
    except Exception:
        reco_service_status = "offline/unreachable"

    # Seller agent service check
    try:
        async with httpx.AsyncClient(timeout=1.5) as client:
            r = await client.get(f"{settings.SELLER_AGENT_SERVICE_URL}/health")
            seller_agent_status = r.json().get("status", "healthy")
    except Exception:
        seller_agent_status = "offline/unreachable"

    return {
        "success": True,
        "platform": "Vyapari E-Commerce Operations Platform",
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "services": {
            "backend_core": "healthy",
            "database": db_status,
            "pgvector": pgvector_status,
            "recommendation_service": reco_service_status,
            "seller_agent_service": seller_agent_status,
        },
    }
