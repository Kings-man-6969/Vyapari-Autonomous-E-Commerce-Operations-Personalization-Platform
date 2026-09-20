"""
JWT token generation and bcrypt hashing.
Mirrors auth.js generateTokens() and bcrypt usage exactly.

python-jose with HS256 produces tokens fully compatible with Node.js
jsonwebtoken — same algorithm, same secret — existing browser sessions
survive the cutover without re-login.
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import jwt

from app.config import settings


def _parse_duration(s: str) -> int:
    """Parse '15m' → 900, '7d' → 604800."""
    if s.endswith("m"):
        return int(s[:-1]) * 60
    if s.endswith("h"):
        return int(s[:-1]) * 3600
    if s.endswith("d"):
        return int(s[:-1]) * 86400
    return int(s)


ACCESS_TTL = _parse_duration(settings.JWT_ACCESS_EXPIRES_IN)
REFRESH_TTL = _parse_duration(settings.JWT_REFRESH_EXPIRES_IN)


def generate_tokens(user: dict) -> tuple[str, str]:
    """
    Mirrors Node.js generateTokens(user):
      access  payload: {id, email, role, name}
      refresh payload: {id}
    """
    now = datetime.now(tz=timezone.utc)

    access_payload = {
        "id": str(user["id"]),
        "email": user["email"],
        "role": user["role"],
        "name": user.get("name", ""),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=ACCESS_TTL)).timestamp()),
    }

    refresh_payload = {
        "id": str(user["id"]),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=REFRESH_TTL)).timestamp()),
    }

    access_token = jwt.encode(access_payload, settings.JWT_ACCESS_SECRET, algorithm="HS256")
    refresh_token = jwt.encode(refresh_payload, settings.JWT_REFRESH_SECRET, algorithm="HS256")

    return access_token, refresh_token


def verify_access_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_ACCESS_SECRET, algorithms=["HS256"])


def verify_refresh_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_REFRESH_SECRET, algorithms=["HS256"])


def generate_opaque_refresh_token() -> str:
    """Generates a 256-bit cryptographically secure opaque token for refresh sessions."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """Cryptographic SHA-256 hash for database token lookup."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def hash_password(password: str) -> str:
    """bcrypt cost factor 10 — same as Node.js bcrypt.genSalt(10)."""
    salt = bcrypt.gensalt(rounds=10)
    return bcrypt.hashpw(password.encode(), salt).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())
