"""
Telemetry Router — Client-side error reporting for frontend ErrorBoundary

POST /api/telemetry/errors
"""
import logging
from fastapi import APIRouter, Depends, Request, status
from pydantic import BaseModel, ConfigDict, Field

from app.rate_limit import limit_for, rate_limit

logger = logging.getLogger("vyapari-telemetry")
router = APIRouter()


class ClientErrorBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    message: str = Field(..., max_length=500)
    url_path: str = Field(..., max_length=300)
    stack: str | None = Field(default="", max_length=2000)


@router.post("/errors", status_code=status.HTTP_200_OK)
async def report_client_error(
    body: ClientErrorBody,
    request: Request,
    _rl=Depends(rate_limit("telemetry.errors", *limit_for("telemetry.errors"))),
) -> dict:
    """
    Ingests sanitized frontend errors from GlobalErrorBoundary.
    Rate limited and capped at 10 KB per request to prevent telemetry DOS.

    The rate limit was previously only claimed in this docstring — nothing
    enforced it, so a client stuck in a render loop could post errors as fast
    as the network allowed.
    """
    client_ip = request.client.host if request.client else "unknown"
    req_id = getattr(request.state, "request_id", "unknown")

    logger.warning(
        f"[Client Frontend Error] [{req_id}] IP: {client_ip} | Path: {body.url_path} | Message: {body.message}",
        extra={"stack": body.stack[:500]},
    )
    return {"success": True, "status": "recorded"}
