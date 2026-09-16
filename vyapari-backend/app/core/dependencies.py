"""
Vyapari Backend — FastAPI Dependencies
Dependency injection for DB sessions, current user, and RBAC guards.
"""
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.session import get_async_session

# ── Database ──────────────────────────────────────────────────────────────────

AsyncSessionDep = Annotated[AsyncSession, Depends(get_async_session)]

# ── Bearer token extraction ───────────────────────────────────────────────────

_bearer = HTTPBearer(auto_error=False)


def _extract_bearer(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Security(_bearer)
    ] = None,
) -> str:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return credentials.credentials


# ── Current-user payload (decoded JWT) ───────────────────────────────────────

def get_current_user_payload(
    token: Annotated[str, Depends(_extract_bearer)],
) -> dict:
    """
    Decodes the access token and returns the raw JWT payload dict.
    Does NOT hit the database — fast guard for most endpoints.
    """
    try:
        payload = decode_access_token(token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


CurrentUserPayload = Annotated[dict, Depends(get_current_user_payload)]


def get_current_user_id(
    payload: CurrentUserPayload,
) -> UUID:
    """Extract and return the user's UUID from the token payload."""
    return UUID(payload["sub"])


CurrentUserIdDep = Annotated[UUID, Depends(get_current_user_id)]


# ── RBAC guards ───────────────────────────────────────────────────────────────

def require_role(*allowed_roles: str):
    """
    Dependency factory. Returns a FastAPI dependency that enforces role-based
    access control.

    Usage::

        @router.get("/seller/products")
        async def list_products(
            _=Depends(require_role("seller", "admin")),
        ): ...
    """

    def _guard(payload: CurrentUserPayload) -> dict:
        role: str = payload.get("role", "")
        if role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of roles: {allowed_roles}",
            )
        return payload

    return _guard


CustomerDep = Annotated[dict, Depends(require_role("customer", "admin"))]
SellerDep = Annotated[dict, Depends(require_role("seller", "admin"))]
AdminDep = Annotated[dict, Depends(require_role("admin"))]

