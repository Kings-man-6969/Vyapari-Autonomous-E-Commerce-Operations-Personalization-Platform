import asyncpg
from fastapi import Request
from app.config import settings

_pool: asyncpg.Pool | None = None


async def init_pool() -> None:
    global _pool
    _pool = await asyncpg.create_pool(
        dsn=settings.DATABASE_URL,
        min_size=2,
        max_size=20,
        command_timeout=5,
    )


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


def set_pool(pool) -> None:
    global _pool
    _pool = pool


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("Database pool not initialised")
    return _pool


# ---------------------------------------------------------------------------
# FastAPI dependency — yields a single *connection* from the pool.
# Use this for simple queries. For multi-statement transactions acquire
# the pool directly and call pool.acquire() / conn.transaction().
# ---------------------------------------------------------------------------
async def get_db(request: Request) -> asyncpg.Connection:
    pool = get_pool()
    async with pool.acquire() as conn:
        yield conn
