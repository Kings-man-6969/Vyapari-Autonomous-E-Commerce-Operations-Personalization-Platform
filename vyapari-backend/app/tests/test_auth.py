"""
Vyapari — Auth API Tests
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestCustomerSignup:

    async def test_signup_success(self, client: AsyncClient) -> None:
        resp = await client.post("/api/v1/auth/customer/signup", json={
            "email": "newuser@example.com",
            "password": "SecurePassword123!",
            "full_name": "New User",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    async def test_signup_duplicate_email(self, client: AsyncClient) -> None:
        payload = {"email": "dupe@example.com", "password": "SecurePassword123!", "full_name": "Dupe"}
        await client.post("/api/v1/auth/customer/signup", json=payload)
        resp = await client.post("/api/v1/auth/customer/signup", json=payload)
        assert resp.status_code == 409

    async def test_signup_weak_password(self, client: AsyncClient) -> None:
        resp = await client.post("/api/v1/auth/customer/signup", json={
            "email": "weak@example.com",
            "password": "short",
            "full_name": "Weak",
        })
        assert resp.status_code == 422


@pytest.mark.asyncio
class TestLogin:

    async def test_login_success(self, client: AsyncClient) -> None:
        await client.post("/api/v1/auth/customer/signup", json={
            "email": "loginuser@example.com", "password": "SecurePassword123!", "full_name": "Login User"
        })
        resp = await client.post("/api/v1/auth/login", json={
            "email": "loginuser@example.com", "password": "SecurePassword123!"
        })
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    async def test_login_wrong_password(self, client: AsyncClient) -> None:
        resp = await client.post("/api/v1/auth/login", json={
            "email": "loginuser@example.com", "password": "WrongPassword1!"
        })
        assert resp.status_code == 401

    async def test_refresh_token(self, client: AsyncClient) -> None:
        signup = await client.post("/api/v1/auth/customer/signup", json={
            "email": "refreshuser@example.com", "password": "SecurePassword123!", "full_name": "Refresh"
        })
        refresh_token = signup.json()["refresh_token"]
        resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
        assert resp.status_code == 200
        assert "access_token" in resp.json()


@pytest.mark.asyncio
class TestSellerSignup:

    async def test_seller_signup(self, client: AsyncClient) -> None:
        resp = await client.post("/api/v1/auth/seller/signup", json={
            "email": "newseller@example.com",
            "password": "SellerPassword123!",
            "business_name": "My Store",
        })
        assert resp.status_code == 201
        assert "access_token" in resp.json()

