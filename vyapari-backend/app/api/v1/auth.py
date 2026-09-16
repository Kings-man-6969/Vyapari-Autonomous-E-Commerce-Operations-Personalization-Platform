"""
Vyapari — Auth Router
POST /api/v1/auth/customer/signup
POST /api/v1/auth/seller/signup
POST /api/v1/auth/login
POST /api/v1/auth/refresh
GET  /api/v1/auth/oauth/google          → redirect to Google
GET  /api/v1/auth/oauth/google/callback → exchange code
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.responses import RedirectResponse

from app.core.dependencies import AsyncSessionDep
from app.models.user import UserRole
from app.schemas.user import (
    CustomerSignupRequest,
    LoginRequest,
    RefreshRequest,
    SellerSignupRequest,
    TokenResponse,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


def _auth_service(db: AsyncSessionDep) -> AuthService:
    return AuthService(db)


@router.post("/customer/signup", response_model=TokenResponse, status_code=201)
async def customer_signup(
    data: CustomerSignupRequest,
    svc: AuthService = Depends(_auth_service),
) -> TokenResponse:
    """Register a new customer account."""
    return await svc.customer_signup(data)


@router.post("/seller/signup", response_model=TokenResponse, status_code=201)
async def seller_signup(
    data: SellerSignupRequest,
    svc: AuthService = Depends(_auth_service),
) -> TokenResponse:
    """Register a new seller account (KYC pending after signup)."""
    return await svc.seller_signup(data)


@router.post("/login", response_model=TokenResponse)
async def login(
    data: LoginRequest,
    svc: AuthService = Depends(_auth_service),
) -> TokenResponse:
    """Authenticate with email + password."""
    return await svc.login(data)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    data: RefreshRequest,
    svc: AuthService = Depends(_auth_service),
) -> TokenResponse:
    """Exchange a refresh token for a new access + refresh token pair."""
    return await svc.refresh_tokens(data.refresh_token)


@router.get("/oauth/google")
async def google_oauth_redirect(
    role: UserRole = Query(default=UserRole.customer, description="customer | seller"),
    svc: AuthService = Depends(_auth_service),
) -> RedirectResponse:
    """Initiates Google OAuth2 flow. Redirects user to Google consent screen."""
    url = svc.get_google_auth_url()
    return RedirectResponse(url=url)


@router.get("/oauth/google/callback", response_model=TokenResponse)
async def google_oauth_callback(
    code: str = Query(...),
    role: UserRole = Query(default=UserRole.customer),
    svc: AuthService = Depends(_auth_service),
) -> TokenResponse:
    """Google OAuth2 callback — exchanges code for Vyapari tokens."""
    return await svc.google_callback(code=code, role=role)
