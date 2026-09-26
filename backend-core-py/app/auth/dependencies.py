"""
FastAPI dependency equivalents for Node.js middleware/auth.js:
  requireAuth   → require_auth()
  optionalAuth  → optional_auth()
  requireRole   → require_role([...])

Token extraction order preserved:
  1. Authorization: Bearer <token>
  2. Cookie: access_token=<token>

Both authenticated dependencies publish the decoded payload on
``request.state.user``. That is not decoration: the rate limiter reads it to
decide between a per-user bucket and a per-IP one, and it used to find nothing
there, so every authenticated limit silently fell through to the IP. See the
note on _publish below for why that mattered.
"""
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import ExpiredSignatureError, JWTError, jwt

from app.config import settings
from app.db import get_db

bearer_scheme = HTTPBearer(auto_error=False)


def _publish(request: Request, payload: dict) -> dict:
    """
    Make the authenticated identity visible to later dependencies.

    The rate limiter's documented rule is "user id when authenticated, else the
    client IP", and _identity() implements it by reading request.state.user. If
    nothing ever writes that attribute the rule degrades silently: the
    authenticated branch is dead code, every bucket is keyed by IP, and nothing
    fails -- there is no way to tell from the outside.

    Two concrete consequences of that, which is why it is worth the two lines:

      * A carrier-grade NAT or a shared office puts many unrelated customers in
        one bucket, so one busy caller gets everybody else 429'd. Authenticated
        routes -- order placement, cart writes, checkout -- are exactly the ones
        where that hurts most.

      * X-Forwarded-For is client-controlled. Keyed by IP, rotating that one
        header buys an unlimited allowance. Keyed by user id, it buys nothing,
        which is the entire reason the user branch exists.
    """
    request.state.user = payload
    return payload


async def require_auth(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict:
    token: str | None = None
    if credentials:
        token = credentials.credentials
    elif cookie := request.cookies.get("access_token"):
        token = cookie

    if not token:
        raise HTTPException(
            status_code=401,
            detail={
                "code": "UNAUTHORIZED",
                "message": "Authentication token is required to access this resource.",
            },
        )

    try:
        payload = jwt.decode(token, settings.JWT_ACCESS_SECRET, algorithms=["HS256"])
        return _publish(request, payload)
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail={
                "code": "TOKEN_EXPIRED",
                "message": "Session has expired. Please refresh your token.",
            },
        )
    except JWTError:
        raise HTTPException(
            status_code=401,
            detail={
                "code": "INVALID_TOKEN",
                "message": "Invalid authentication token.",
            },
        )


async def optional_auth(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict | None:
    """Returns decoded user payload or None — never raises."""
    token: str | None = None
    if credentials:
        token = credentials.credentials
    elif cookie := request.cookies.get("access_token"):
        token = cookie

    if not token:
        return None

    try:
        return _publish(request, jwt.decode(token, settings.JWT_ACCESS_SECRET, algorithms=["HS256"]))
    except (JWTError, ExpiredSignatureError):
        return None


def require_role(allowed_roles: list[str]):
    """
    Mirrors Node.js requireRole() including the DB re-check fallback:
    If the JWT role doesn't match, one SELECT against the DB is attempted
    before rejecting — this handles stale tokens after role promotion.
    """

    async def _check(user: dict = Depends(require_auth), db=Depends(get_db)) -> dict:
        if user.get("role") not in allowed_roles:
            # DB re-check (exact mirror of Node.js requireRole behaviour)
            row = await db.fetchrow(
                "SELECT role FROM users WHERE id=$1", user["id"]
            )
            if row and row["role"] in allowed_roles:
                user = dict(user)
                user["role"] = row["role"]
                return user
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "FORBIDDEN",
                    "message": f"Access denied. Requires one of roles: [{', '.join(allowed_roles)}]",
                },
            )
        return user

    return _check
