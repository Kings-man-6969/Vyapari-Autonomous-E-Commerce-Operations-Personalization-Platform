"""
Mock asyncpg pool & connection for end-to-end FastAPI endpoint testing without requiring live Postgres.
"""
from typing import Any


class MockRecord(dict):
    """Dict subclass that allows both key and attribute access like asyncpg Record."""
    def __getitem__(self, key):
        return super().__getitem__(key)


class MockTransaction:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass


class MockConnection:
    def __init__(self, handler=None):
        self.handler = handler

    async def fetch(self, query: str, *args) -> list[MockRecord]:
        if self.handler:
            res = self.handler("fetch", query, *args)
            if res is not None:
                return [MockRecord(r) if isinstance(r, dict) else r for r in res]
        return []

    async def fetchrow(self, query: str, *args) -> MockRecord | None:
        if self.handler:
            res = self.handler("fetchrow", query, *args)
            if res is not None:
                if isinstance(res, dict):
                    return MockRecord(res)
                if isinstance(res, list) and len(res) > 0 and isinstance(res[0], dict):
                    return MockRecord(res[0])
                return res
        return None

    async def fetchval(self, query: str, *args) -> Any:
        if self.handler:
            return self.handler("fetchval", query, *args)
        return None

    async def execute(self, query: str, *args) -> str:
        if self.handler:
            res = self.handler("execute", query, *args)
            if res is not None:
                return str(res)
        return "OK"

    def transaction(self):
        return MockTransaction()


class MockPool:
    def __init__(self, conn: MockConnection):
        self._conn = conn

    class _AcquireContext:
        def __init__(self, conn):
            self.conn = conn

        async def __aenter__(self):
            return self.conn

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    def acquire(self):
        return self._AcquireContext(self._conn)

    async def execute(self, query: str, *args) -> str:
        return await self._conn.execute(query, *args)

    async def fetch(self, query: str, *args) -> list:
        return await self._conn.fetch(query, *args)

    async def fetchrow(self, query: str, *args):
        return await self._conn.fetchrow(query, *args)

    async def fetchval(self, query: str, *args):
        return await self._conn.fetchval(query, *args)
