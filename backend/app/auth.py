from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Literal

import jwt
from fastapi import Depends, Header, HTTPException, status
from jwt import PyJWKClient

from app.db.database import AuthAccount, db_session

Role = Literal["seller", "customer"]
DEMO_AUTH_ENABLED = os.getenv("DEMO_AUTH_ENABLED", "false").lower() not in {"0", "false", "no"}
CLERK_ISSUER = os.getenv("CLERK_ISSUER", "").strip().rstrip("/")
CLERK_AUDIENCE = os.getenv("CLERK_AUDIENCE", "").strip()
DEMO_AUTH_DISABLED_DETAIL = "demo auth is disabled; configure Clerk JWT verification"


@dataclass(frozen=True)
class AuthContext:
    clerk_id: str
    role: Role


def create_demo_token(clerk_id: str, role: Role) -> str:
    require_demo_auth_enabled()
    return f"vyapari-demo-jwt.{clerk_id}.{role}.0"


def parse_demo_token(token: str) -> tuple[str, Role]:
    require_demo_auth_enabled()
    parts = token.split('.')
    if len(parts) < 4 or parts[0] != 'vyapari-demo-jwt':
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='invalid token')

    clerk_id = parts[1].strip()
    role = parts[2].strip()
    if role not in {"seller", "customer"}:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='invalid token role')
    if not clerk_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='missing clerk id')
    return clerk_id, role  # type: ignore[return-value]


def require_demo_auth_enabled() -> None:
    if not DEMO_AUTH_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=DEMO_AUTH_DISABLED_DETAIL,
        )


@lru_cache(maxsize=8)
def _jwks_client_for(issuer: str) -> PyJWKClient:
    return PyJWKClient(f"{issuer}/.well-known/jwks.json")


def _extract_issuer(token: str) -> str:
    try:
        payload = jwt.decode(token, options={"verify_signature": False, "verify_exp": False})
    except Exception as exc:  # pragma: no cover - handled as auth failure
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid JWT payload") from exc

    issuer = str(payload.get("iss") or "").strip().rstrip("/")
    if not issuer.startswith("https://"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid JWT issuer")
    return issuer


def verify_clerk_token(token: str) -> str:
    issuer = CLERK_ISSUER or _extract_issuer(token)
    try:
        signing_key = _jwks_client_for(issuer).get_signing_key_from_jwt(token).key
    except Exception as exc:  # pragma: no cover - handled as auth failure
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="unable to resolve JWT signing key") from exc

    decode_kwargs: dict[str, object] = {
        "algorithms": ["RS256"],
        "issuer": issuer,
        "options": {
            "require": ["exp", "iat", "sub", "iss"],
            "verify_aud": bool(CLERK_AUDIENCE),
        },
    }
    if CLERK_AUDIENCE:
        decode_kwargs["audience"] = CLERK_AUDIENCE

    try:
        payload = jwt.decode(token, signing_key, **decode_kwargs)
    except Exception as exc:  # pragma: no cover - handled as auth failure
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid Clerk JWT") from exc

    clerk_id = str(payload.get("sub") or "").strip()
    if not clerk_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing Clerk subject")
    return clerk_id


def _parse_bearer_header(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='missing authorization header')

    scheme, _, token = authorization.partition(' ')
    if scheme.lower() != 'bearer' or not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='invalid authorization header')
    return token


def get_clerk_subject_from_auth_header(authorization: str | None) -> str:
    token = _parse_bearer_header(authorization)
    if token.startswith("vyapari-demo-jwt."):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="demo bearer token is not allowed for this route",
        )
    return verify_clerk_token(token)


def get_auth_context(authorization: str | None = Header(default=None)) -> AuthContext:
    token = _parse_bearer_header(authorization)

    if token.startswith("vyapari-demo-jwt."):
        clerk_id, token_role = parse_demo_token(token)
    else:
        clerk_id = verify_clerk_token(token)
        token_role = None

    with db_session() as session:
        account = session.get(AuthAccount, clerk_id)
        if not account:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='account not registered')
        if token_role and account.role != token_role:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='role mismatch')
        return AuthContext(clerk_id=account.clerk_id, role=account.role)  # type: ignore[arg-type]


def require_seller(auth: AuthContext = Depends(get_auth_context)) -> AuthContext:
    if auth.role != 'seller':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='seller role required')
    return auth


def require_customer(auth: AuthContext = Depends(get_auth_context)) -> AuthContext:
    if auth.role != 'customer':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='customer role required')
    return auth
