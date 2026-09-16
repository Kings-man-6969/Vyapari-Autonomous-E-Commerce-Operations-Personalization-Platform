"""
Vyapari — Pytest Configuration & Fixtures
"""
from __future__ import annotations

import os
from typing import AsyncGenerator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.base import Base
from app.db.session import get_async_session
from app.main import app

# Shared in-memory SQLite database for test session
TEST_DATABASE_URL = "sqlite+aiosqlite:///file:test_db?mode=memory&cache=shared&uri=true"


@pytest_asyncio.fixture(scope="session")
async def test_engine():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def client(test_engine) -> AsyncGenerator[AsyncClient, None]:
    session_factory = async_sessionmaker(test_engine, expire_on_commit=False)

    async def _get_test_session() -> AsyncGenerator[AsyncSession, None]:
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_async_session] = _get_test_session

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as c:
        yield c

    app.dependency_overrides.clear()


# ── Helper fixtures ───────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def customer_token(client: AsyncClient) -> str:
    """Register a test customer and return an access token."""
    resp = await client.post("/api/v1/auth/customer/signup", json={
        "email": "testcustomer@example.com",
        "password": "TestPassword123!",
        "full_name": "Test Customer",
    })
    assert resp.status_code == 201
    return resp.json()["access_token"]


@pytest_asyncio.fixture
async def seller_token(client: AsyncClient) -> str:
    """Register a test seller and return an access token."""
    resp = await client.post("/api/v1/auth/seller/signup", json={
        "email": "testseller@example.com",
        "password": "TestPassword123!",
        "business_name": "Test Store",
    })
    assert resp.status_code == 201
    return resp.json()["access_token"]

