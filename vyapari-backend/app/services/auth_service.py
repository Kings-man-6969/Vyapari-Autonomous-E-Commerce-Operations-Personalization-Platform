"""
Vyapari — Auth Service
Handles user creation, login, Google OAuth2, and token management.
"""
from __future__ import annotations

from uuid import UUID

from authlib.integrations.httpx_client import AsyncOAuth2Client
from fastapi import HTTPException, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import get_logger
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_password,
    verify_password,
)
from app.models.customer_profile import CustomerProfile
from app.models.seller_profile import KYCStatus, SellerProfile
from app.models.user import User, UserRole
from app.schemas.user import (
    CustomerSignupRequest,
    LoginRequest,
    SellerSignupRequest,
    TokenResponse,
)

logger = get_logger(__name__)

_ACCESS_EXPIRE = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60  # in seconds


class AuthService:

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Helpers ───────────────────────────────────────────────────────────────

    async def _get_user_by_email(self, email: str) -> User | None:
        result = await self.db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def _get_user_by_id(self, user_id: UUID) -> User | None:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    def _build_token_response(self, user: User) -> TokenResponse:
        access = create_access_token(user.id, user.role.value)
        refresh = create_refresh_token(user.id)
        return TokenResponse(
            access_token=access,
            refresh_token=refresh,
            token_type="bearer",
            expires_in=_ACCESS_EXPIRE,
            role=user.role.value,
            user_id=str(user.id),
            email=user.email,
        )

    # ── Customer Signup ───────────────────────────────────────────────────────

    async def customer_signup(self, data: CustomerSignupRequest) -> TokenResponse:
        if await self._get_user_by_email(data.email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists.",
            )

        user = User(
            email=data.email,
            password_hash=hash_password(data.password),
            role=UserRole.customer,
            is_verified=False,
        )
        self.db.add(user)
        await self.db.flush()  # Assigns user.id

        profile = CustomerProfile(
            user_id=user.id,
            full_name=data.full_name,
        )
        self.db.add(profile)
        await self.db.flush()

        logger.info("customer_signup", user_id=str(user.id), email=user.email)
        return self._build_token_response(user)

    # ── Seller Signup ─────────────────────────────────────────────────────────

    async def seller_signup(self, data: SellerSignupRequest) -> TokenResponse:
        if await self._get_user_by_email(data.email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists.",
            )

        user = User(
            email=data.email,
            password_hash=hash_password(data.password),
            role=UserRole.seller,
            is_verified=False,
        )
        self.db.add(user)
        await self.db.flush()

        seller_profile = SellerProfile(
            user_id=user.id,
            business_name=data.business_name,
            gstin=data.gstin,
            pan=data.pan,
            kyc_status=KYCStatus.pending,
        )
        self.db.add(seller_profile)
        await self.db.flush()

        logger.info("seller_signup", user_id=str(user.id), business=data.business_name)
        return self._build_token_response(user)

    # ── Login ─────────────────────────────────────────────────────────────────

    async def login(self, data: LoginRequest) -> TokenResponse:
        user = await self._get_user_by_email(data.email)
        if not user or not user.password_hash:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )
        if not verify_password(data.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated.",
            )
        logger.info("login", user_id=str(user.id), role=user.role)
        return self._build_token_response(user)

    # ── Token Refresh ─────────────────────────────────────────────────────────

    async def refresh_tokens(self, refresh_token: str) -> TokenResponse:
        try:
            payload = decode_refresh_token(refresh_token)
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token.",
            )
        user = await self._get_user_by_id(UUID(payload["sub"]))
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or deactivated.",
            )
        return self._build_token_response(user)

    # ── Google OAuth2 ─────────────────────────────────────────────────────────

    def get_google_auth_url(self) -> str:
        """Returns the Google OAuth2 redirect URL."""
        client = AsyncOAuth2Client(
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            redirect_uri=settings.GOOGLE_REDIRECT_URI,
        )
        url, _ = client.create_authorization_url(
            "https://accounts.google.com/o/oauth2/v2/auth",
            scope="openid email profile",
        )
        return url

    async def google_callback(self, code: str, role: UserRole) -> TokenResponse:
        """
        Exchanges Google auth code for user info, upserts the user,
        and returns Vyapari tokens.
        """
        async with AsyncOAuth2Client(
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            redirect_uri=settings.GOOGLE_REDIRECT_URI,
        ) as client:
            token = await client.fetch_token(
                "https://oauth2.googleapis.com/token", code=code
            )
            userinfo = await client.get("https://www.googleapis.com/oauth2/v3/userinfo")
            userinfo = userinfo.json()

        google_sub: str = userinfo["sub"]
        email: str = userinfo.get("email", "")
        full_name: str = userinfo.get("name", "")

        # Check if user exists by google_sub
        result = await self.db.execute(
            select(User).where(User.google_sub == google_sub)
        )
        user = result.scalar_one_or_none()

        if not user:
            # Try to find by email (link existing account)
            user = await self._get_user_by_email(email)

        if not user:
            # Create new user
            user = User(
                email=email,
                google_sub=google_sub,
                role=role,
                is_verified=True,  # Google-verified email
            )
            self.db.add(user)
            await self.db.flush()

            if role == UserRole.customer:
                self.db.add(CustomerProfile(user_id=user.id, full_name=full_name))
            elif role == UserRole.seller:
                self.db.add(SellerProfile(
                    user_id=user.id,
                    business_name=full_name or email,
                    kyc_status=KYCStatus.pending,
                ))
            await self.db.flush()
        else:
            # Patch google_sub if missing
            if not user.google_sub:
                user.google_sub = google_sub

        logger.info("google_oauth_login", user_id=str(user.id), email=email)
        return self._build_token_response(user)
