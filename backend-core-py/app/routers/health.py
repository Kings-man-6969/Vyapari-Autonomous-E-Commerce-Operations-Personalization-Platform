"""
Health check — port of backend-core/src/routes/health.js

Route inventory:
  HEAD /health        → lightweight liveness (process alive only, zero I/O)
  HEAD /health/live   → canonical liveness probe for Docker HEALTHCHECK / k8s
  GET  /health/live   → same, with JSON body (curl -i debugging)
  GET  /health        → deep readiness: DB, pgvector, microservices
"""
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter
from fastapi.responses import Response

from app.config import settings
from app.db import get_pool

router = APIRouter(tags=["health"])


# ---------------------------------------------------------------------------
# Lightweight liveness probe — zero external dependencies.
#
# Rule: MUST NOT query PostgreSQL, pgvector, recommendation service, or
# seller-agent service. Only confirms the process + event loop are alive.
#
# Used by:
#   - Docker HEALTHCHECK (HEAD, curl -f --head http://127.0.0.1:8000/health/live)
#   - Kubernetes liveness probes (HEAD /health/live)
#   - AWS ALB / GCP Health Checks (GET /health/live)
# ---------------------------------------------------------------------------

_LIVENESS_HEADERS = {
    "Cache-Control": "no-store",
    "X-Health-Check": "liveness",
}
_LIVENESS_BODY = b'{"status":"ok"}'


@router.head("/live")
@router.get("/live")
async def liveness_probe():
    """
    Canonical lightweight liveness probe at /health/live.

    HEAD returns 200 with empty body.
    GET returns 200 with minimal JSON body for human debugging.
    Both skip all external I/O — no DB, no pgvector, no microservice calls.
    """
    return Response(
        content=_LIVENESS_BODY,
        status_code=200,
        media_type="application/json",
        headers=_LIVENESS_HEADERS,
    )


@router.head("")
@router.head("/")
async def liveness_head_root():
    """
    HEAD /health — lightweight alias for Docker HEALTHCHECK probes.

    curl -f --head http://127.0.0.1:8000/health
    Keeps backward compat with infra expecting HEAD at the root health path.
    No body returned (HEAD semantics). Zero external I/O.
    """
    return Response(
        status_code=200,
        media_type="application/json",
        headers=_LIVENESS_HEADERS,
    )


# ---------------------------------------------------------------------------
# Deep readiness / observability check.
#
# Polls ALL external dependencies: PostgreSQL, pgvector, recommendation
# service, and seller-agent service. Intended for:
#   - Observability dashboards and admin health pages
#   - Kubernetes readiness probes (GET — NOT liveness)
#   - Manual curl checks during deployment
#
# NOT suitable for Docker HEALTHCHECK — too slow, has external dependencies
# that may be temporarily unavailable without the process being unhealthy.
# ---------------------------------------------------------------------------

@router.get("")
@router.get("/")
@router.get("/health")
async def health_check() -> dict:
    db_status = "disconnected"
    pgvector_status = "unknown"
    reco_service_status = "unknown"
    seller_agent_status = "unknown"

    # DB + pgvector check
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
