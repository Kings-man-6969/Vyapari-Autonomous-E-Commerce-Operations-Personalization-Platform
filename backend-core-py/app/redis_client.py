"""
In-memory cache fallback — mirrors the Node.js config/redis.js InMemoryCache.
Drop-in replacement so the app starts even without Redis available.
"""
import time
from typing import Optional


class InMemoryCache:
    def __init__(self) -> None:
        self._store: dict = {}

    async def get(self, key: str) -> Optional[str]:
        item = self._store.get(key)
        if item is None:
            return None
        if item["expires_at"] and time.time() > item["expires_at"]:
            del self._store[key]
            return None
        return item["value"]

    async def set(self, key: str, value: str, ex: Optional[int] = None) -> str:
        expires_at = (time.time() + ex) if ex else None
        self._store[key] = {"value": value, "expires_at": expires_at}
        return "OK"

    async def delete(self, key: str) -> int:
        return 1 if self._store.pop(key, None) is not None else 0


# Singleton — same pattern as Node.js module-level `fallbackCache`
cache = InMemoryCache()
is_fallback = True
