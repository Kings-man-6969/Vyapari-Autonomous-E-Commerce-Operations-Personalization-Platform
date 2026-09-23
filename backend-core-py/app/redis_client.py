"""
Redis Client & High-Frequency Cache Layer for Vyapari.

Architecture:
- Non-critical distributed cache with automatic in-memory fallback.
- Uses official redis.asyncio from redis package (redis-py 5.x).
- Cache failure NEVER bubbles up or causes application failure.
- Detailed cache hit/miss and operation metrics by namespace.
- Supports direct REDIS_URL (TLS rediss:// or redis://) or discrete host/port params.
- Non-blocking pattern deletion via scan_iter and UNLINK.
- Standardized TTL constants tailored for 30MB memory budget.
"""
import json
import logging
import time
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from redis.asyncio import Redis
from app.config import settings

logger = logging.getLogger("vyapari.cache")

# ── Standardized Cache TTLs (seconds) tailored for 30MB Redis budget ───────────
TTL_CATEGORIES = 7200             # 2 hours (1–6 hours)
TTL_PRODUCT_DETAIL = 600          # 10 minutes (5–15 min)
TTL_AUTOCOMPLETE = 300            # 5 minutes (5–10 min)
TTL_POPULAR = 300                 # 5 minutes
TTL_RECOMMENDATIONS = 300         # 5 minutes
TTL_SEARCH = 180                  # 3 minutes (1–5 min)
TTL_FACETS = 1800                 # 30 minutes
TTL_RATE_LIMIT = 60               # 1 minute
TTL_AI_STATUS_PROCESSING = 1200   # 20 minutes (10–30 min)
TTL_AI_STATUS_COMPLETED = 180     # 3 minutes once task completes


def _json_serial(obj: Any) -> Any:
    """JSON serializer for objects not serializable by default json code."""
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, UUID):
        return str(obj)
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Type {type(obj)} not serializable")


def _get_namespace(key: str) -> str:
    """Classifies cache key into tracking namespace."""
    if key.startswith("suggest:"):
        return "autocomplete"
    if key.startswith("product:detail:"):
        return "product_detail"
    if key.startswith("categories:"):
        return "categories"
    if key.startswith("search:"):
        return "search"
    if key.startswith("products:popular:"):
        return "popular"
    if key.startswith("products:similar:"):
        return "similar"
    if key.startswith("recommendations:"):
        return "recommendations"
    if key.startswith("products:facets"):
        return "facets"
    return "other"


class InMemoryCache:
    """Fallback in-memory cache used when Redis is unreachable or during local tests."""

    def __init__(self) -> None:
        self._store: dict[str, dict[str, Any]] = {}

    async def get(self, key: str) -> Optional[str]:
        item = self._store.get(key)
        if item is None:
            return None
        if item["expires_at"] and time.time() > item["expires_at"]:
            del self._store[key]
            return None
        return item["value"]

    async def set(self, key: str, value: str, ex: Optional[int] = None) -> bool:
        expires_at = (time.time() + ex) if ex else None
        self._store[key] = {"value": value, "expires_at": expires_at}
        return True

    async def delete(self, key: str) -> int:
        return 1 if self._store.pop(key, None) is not None else 0

    async def delete_prefix(self, pattern: str) -> int:
        prefix = pattern.rstrip("*")
        keys_to_del = [k for k in self._store if k.startswith(prefix)]
        for k in keys_to_del:
            self._store.pop(k, None)
        return len(keys_to_del)

    async def get_json(self, key: str) -> Optional[Any]:
        val = await self.get(key)
        if val is None:
            return None
        try:
            return json.loads(val)
        except Exception:
            return None

    async def set_json(self, key: str, value: Any, ex: Optional[int] = None) -> bool:
        try:
            serialized = json.dumps(value, default=_json_serial)
            return await self.set(key, serialized, ex=ex)
        except Exception as e:
            logger.warning(f"InMemoryCache set_json serialization error for key {key}: {e}")
            return False


class AsyncRedisClient:
    """Production asynchronous Redis client with resilient fallback and observability metrics."""

    def __init__(self) -> None:
        self._redis: Optional[Redis] = None
        self._fallback = InMemoryCache()
        self.is_fallback: bool = True

        # Observability metrics
        self._metrics = {
            "hits": 0,
            "misses": 0,
            "sets": 0,
            "deletes": 0,
            "errors": 0,
        }
        self._namespace_metrics = {
            "autocomplete": {"hits": 0, "misses": 0},
            "product_detail": {"hits": 0, "misses": 0},
            "categories": {"hits": 0, "misses": 0},
            "search": {"hits": 0, "misses": 0},
            "popular": {"hits": 0, "misses": 0},
            "similar": {"hits": 0, "misses": 0},
            "recommendations": {"hits": 0, "misses": 0},
            "facets": {"hits": 0, "misses": 0},
            "other": {"hits": 0, "misses": 0},
        }

    async def init(self) -> None:
        """Initialize Redis connection pool and test connectivity."""
        url = settings.redis_connection_url
        try:
            safe_url = url
            if "@" in url:
                proto, rest = url.split("://", 1)
                safe_url = f"{proto}://***@{rest.split('@', 1)[1]}"

            logger.info(f"Connecting to Redis at {safe_url}...")
            client = Redis.from_url(
                url,
                decode_responses=True,
                socket_connect_timeout=2.0,
                socket_timeout=2.0,
                max_connections=20,
            )
            await client.ping()
            self._redis = client
            self.is_fallback = False
            logger.info("Redis connection established successfully. Cache active.")
        except Exception as exc:
            logger.warning(
                f"Could not connect to Redis ({exc}). Falling back to InMemoryCache safely."
            )
            self._redis = None
            self.is_fallback = True

    async def close(self) -> None:
        """Gracefully close Redis connection pool."""
        if self._redis:
            try:
                await self._redis.aclose()
                logger.info("Redis connection pool closed.")
            except Exception as e:
                logger.warning(f"Error closing Redis client: {e}")
            finally:
                self._redis = None
                self.is_fallback = True

    async def ping(self) -> bool:
        if self._redis and not self.is_fallback:
            try:
                return bool(await self._redis.ping())
            except Exception:
                return False
        return True

    async def get(self, key: str) -> Optional[str]:
        ns = _get_namespace(key)
        val = None

        if self._redis and not self.is_fallback:
            try:
                val = await self._redis.get(key)
            except Exception as e:
                self._metrics["errors"] += 1
                logger.warning(f"Redis GET error on key '{key}': {e}. Falling back to memory.")
                val = await self._fallback.get(key)
        else:
            val = await self._fallback.get(key)

        # Track hit / miss metrics
        if val is not None:
            self._metrics["hits"] += 1
            self._namespace_metrics[ns]["hits"] += 1
        else:
            self._metrics["misses"] += 1
            self._namespace_metrics[ns]["misses"] += 1

        return val

    async def set(self, key: str, value: str, ex: Optional[int] = None) -> bool:
        self._metrics["sets"] += 1
        if self._redis and not self.is_fallback:
            try:
                return bool(await self._redis.set(key, value, ex=ex))
            except Exception as e:
                self._metrics["errors"] += 1
                logger.warning(f"Redis SET error on key '{key}': {e}. Setting in fallback cache.")
                return await self._fallback.set(key, value, ex=ex)
        return await self._fallback.set(key, value, ex=ex)

    async def delete(self, key: str) -> int:
        self._metrics["deletes"] += 1
        count = 0
        if self._redis and not self.is_fallback:
            try:
                count = await self._redis.delete(key)
            except Exception as e:
                self._metrics["errors"] += 1
                logger.warning(f"Redis DELETE error on key '{key}': {e}")
        fallback_count = await self._fallback.delete(key)
        return count or fallback_count

    async def delete_prefix(self, pattern: str) -> int:
        """Non-blocking deletion of keys matching prefix using scan_iter and UNLINK."""
        self._metrics["deletes"] += 1
        total = 0
        match_pattern = pattern if pattern.endswith("*") else f"{pattern}*"
        if self._redis and not self.is_fallback:
            try:
                keys = []
                async for key in self._redis.scan_iter(match=match_pattern, count=100):
                    keys.append(key)
                    if len(keys) >= 100:
                        total += await self._redis.unlink(*keys)
                        keys = []
                if keys:
                    total += await self._redis.unlink(*keys)
            except Exception as e:
                self._metrics["errors"] += 1
                logger.warning(f"Redis delete_prefix error for pattern '{match_pattern}': {e}")
        fallback_total = await self._fallback.delete_prefix(match_pattern)
        return total or fallback_total

    async def get_json(self, key: str) -> Optional[Any]:
        raw = await self.get(key)
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except Exception as e:
            logger.warning(f"Cache JSON decode error on key '{key}': {e}")
            return None

    async def set_json(self, key: str, value: Any, ex: Optional[int] = None) -> bool:
        try:
            serialized = json.dumps(value, default=_json_serial)
            return await self.set(key, serialized, ex=ex)
        except Exception as e:
            logger.warning(f"Cache JSON encode error on key '{key}': {e}")
            return False

    def get_metrics(self) -> dict[str, Any]:
        """Returns cache telemetry: hit ratio, counts, and breakdown by namespace."""
        total_ops = self._metrics["hits"] + self._metrics["misses"]
        hit_ratio = round((self._metrics["hits"] / total_ops) * 100, 2) if total_ops > 0 else 0.0
        return {
            "hits_total": self._metrics["hits"],
            "misses_total": self._metrics["misses"],
            "sets_total": self._metrics["sets"],
            "deletes_total": self._metrics["deletes"],
            "errors_total": self._metrics["errors"],
            "hit_ratio_percent": hit_ratio,
            "by_namespace": self._namespace_metrics,
        }

    async def health_check(self) -> dict[str, Any]:
        """Provides status and observability metrics for health and admin dashboard."""
        metrics = self.get_metrics()
        if not self._redis or self.is_fallback:
            return {
                "status": "degraded (in_memory_fallback)",
                "is_redis_connected": False,
                "latency_ms": 0.0,
                "engine": "InMemoryCache",
                "metrics": metrics,
            }

        start = time.perf_counter()
        try:
            await self._redis.ping()
            latency = round((time.perf_counter() - start) * 1000, 2)
            info = await self._redis.info(section="memory")
            clients_info = await self._redis.info(section="clients")
            server_info = await self._redis.info(section="server")

            return {
                "status": "connected",
                "is_redis_connected": True,
                "latency_ms": latency,
                "engine": "Redis",
                "used_memory_human": info.get("used_memory_human", "N/A"),
                "maxmemory_human": info.get("maxmemory_human", "provider_managed"),
                "connected_clients": clients_info.get("connected_clients", 0),
                "uptime_in_seconds": server_info.get("uptime_in_seconds", 0),
                "metrics": metrics,
            }
        except Exception as exc:
            return {
                "status": "degraded (in_memory_fallback)",
                "is_redis_connected": False,
                "error": str(exc),
                "engine": "Redis (offline)",
                "metrics": metrics,
            }


# Global singleton instance
cache = AsyncRedisClient()


async def init_redis() -> None:
    await cache.init()


async def close_redis() -> None:
    await cache.close()
