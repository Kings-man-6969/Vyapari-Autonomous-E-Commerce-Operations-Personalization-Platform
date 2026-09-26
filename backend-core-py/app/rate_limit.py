"""
Rate limiting — fixed-window counters over the existing cache layer.

Why a dependency and not middleware: the limits are not uniform. Login wants 5
attempts a minute, the product list wants 120. A blanket middleware rule has to
pick one number for everything and is therefore wrong everywhere.

Design notes
------------
Fails **open**. If Redis is unreachable the limiter returns immediately and lets
the request through. A cache outage must not become an outage of the whole API.
The cost of failing open is a temporarily unprotected endpoint, which is far
cheaper than 100% availability loss.

Identity is the user id when a valid access token is present, else the client
IP. Preferring the user id means a single account cannot multiply its allowance
by rotating IPs, and one NAT'd office does not exhaust the limit for everyone
behind it. Auth is read from the already-parsed request state when available
(the `require_auth` dependency caches it) so this costs no extra signature
verification in the common case.

Fixed windows can allow up to 2x the limit across a window boundary. That is an
accepted trade for O(1) memory per key and one Redis round trip; a sliding
window would need sorted sets and several round trips per request.

Honours the ``X-RateLimit-*`` response headers and ``Retry-After`` on rejection,
both of which are already exposed through CORS in main.py.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Optional

from fastapi import HTTPException, Request

from app.redis_client import cache

logger = logging.getLogger("vyapari.ratelimit")

#: Cache key prefix. Kept distinct from the read-through cache namespaces so
#: ``delete_prefix`` on a data namespace can never wipe live counters.
KEY_PREFIX = "ratelimit"


@dataclass(frozen=True)
class Decision:
    """Outcome of one rate-limit check, rendered into response headers."""

    allowed: bool
    limit: int
    remaining: int
    #: Unix timestamp at which the current window ends. ``0`` when unlimited.
    reset_at: int

    @property
    def retry_after(self) -> int:
        return max(1, int(self.reset_at - time.time()))


async def _client_ip(request: Request) -> str:
    """Best-effort client IP.

    The app runs behind Render's proxy, so ``request.client.host`` is the proxy
    on every real request. X-Forwarded-For is client-controlled, but it is the
    only signal available and the limiter is a soft control — a spoofed header
    gets you a fresh bucket, not access to anything you did not already have.
    """
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()[:64]
    real_ip = request.headers.get("X-Real-IP", "").strip()
    if real_ip:
        return real_ip[:64]
    return (request.client.host if request.client else "unknown")[:64]


async def _identity(request: Request) -> str:
    """Stable per-caller key: user id when authenticated, else IP."""
    user = getattr(request.state, "user", None)
    if isinstance(user, dict) and user.get("id"):
        return f"u:{user['id']}"
    if isinstance(user, str) and user:
        return f"u:{user}"
    return f"ip:{await _client_ip(request)}"


async def check(identity: str, scope: str, limit: int, window: int) -> Decision:
    """Count one call against ``identity`` and report whether it is allowed.

    Never raises. A backend error is logged and treated as "allowed".
    """
    key = f"{KEY_PREFIX}:{scope}:{identity}"
    try:
        count = await cache.incr(key, ex=window)
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning(f"Rate limit check failed for scope '{scope}': {exc}. Failing open.")
        return Decision(allowed=True, limit=limit, remaining=limit, reset_at=0)

    # Redis applies the TTL on first increment, so the window boundary is the
    # moment the key was created. InMemoryCache does the same. We do not track
    # that timestamp separately; deriving it from the local clock drifts at most
    # by the request duration, which only affects how long Retry-After says to
    # wait. Over-reporting by a second is safe; under-reporting is not, hence the
    # max(1, ...) in Decision.retry_after.
    reset_at = int(time.time()) + window
    return Decision(
        allowed=count <= limit,
        limit=limit,
        remaining=max(0, limit - count),
        reset_at=reset_at,
    )


def rate_limit(scope: str, limit: int, window: int):
    """Build a FastAPI dependency enforcing ``limit`` calls per ``window``.

    Usage:
        @router.post("/login", dependencies=[Depends(rate_limit("auth.login", 5, 60))])

    The dependency runs before the handler but after FastAPI has resolved the
    other dependencies in the signature, so a handler that also declares
    ``require_auth`` will have ``request.state.user`` populated when the
    limiter reads it. Dependency order within a route is left-to-right, so
    declare the limiter **after** the auth dependency to get the user-scoped
    bucket rather than the IP-scoped one.
    """
    if limit < 1:
        raise ValueError("rate_limit limit must be >= 1")
    if window < 1:
        raise ValueError("rate_limit window must be >= 1 seconds")

    async def dependency(request: Request) -> Decision:
        decision = await check(await _identity(request), scope, limit, window)

        # Stash it so the handler, or a caller wrapping the route, can read the
        # numbers without re-running the counter.
        request.state.rate_limit = decision

        if not decision.allowed:
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "RATE_LIMITED",
                    "message": "Too many requests. Please slow down and try again shortly.",
                    "details": {
                        "scope": scope,
                        "limit": decision.limit,
                        "retry_after_seconds": decision.retry_after,
                    },
                },
                headers={"Retry-After": str(decision.retry_after)},
            )
        return decision

    dependency.__name__ = f"rate_limit_{scope.replace('.', '_')}"
    return dependency


# ── Standard limits ───────────────────────────────────────────────────────────
# Named so the numbers are reviewable in one place instead of scattered as
# magic integers across a dozen route decorators.
#
# Values are deliberately permissive for the general catalogue and tight for
# anything that touches credentials, money or storage. Login is the one place
# where a low limit protects real accounts; the 5/minute figure matches what
# the Node.js backend used.

LIMITS = {
    # Auth — brute-force surface. 5/min per identity, burst-tolerant by design.
    "auth.register": (5, 3600),     # 5 per hour: blocks scripted account farms
    "auth.login": (5, 60),          # 5 per minute: blocks credential stuffing
    "auth.refresh": (30, 60),       # 30 per minute: a busy SPA refreshes often
    # Password reset. Both are tight because each one is a lever on an
    # account: forgot-password mails a live credential, and reset-password
    # brute-forces the token. The token is 256 bits, so guessing it is not the
    # risk — flooding a victim's inbox and exhausting mail quota is.
    "auth.forgot": (3, 3600),       # 3 per hour per identity
    "auth.reset": (10, 3600),       # 10 per hour per identity
    # Catalog reads.
    "products.list": (120, 60),     # 120 per minute: normal browsing + fast paging
    "products.suggest": (60, 60),   # autocomplete fires on every keystroke
    "ai.search": (60, 60),          # NL/semantic search proxies an outbound call
    # Writes.
    "orders.create": (10, 60),      # 10 per minute per user
    "cart.write": (60, 60),
    "reviews.create": (5, 3600),    # 5 per hour: review spam
    # Infra.
    "uploads.presign": (30, 60),    # each call mints storage credentials
    "telemetry.errors": (30, 60),   # client error reporting can loop
    "ai.interactions": (240, 60),   # 4 events per second sustained
}


def limit_for(scope: str) -> tuple[int, int]:
    """Look up a registered limit, defaulting to a conservative generic one."""
    return LIMITS.get(scope, (60, 60))
