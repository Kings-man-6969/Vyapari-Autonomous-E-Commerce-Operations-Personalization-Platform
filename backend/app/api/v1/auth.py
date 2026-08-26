import uuid
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from app.database import get_db
from app.models import User
from app.schemas import RegisterRequest, LoginRequest, TokenResponse, UserResponse
from app.core.auth import create_access_token, get_current_user, get_optional_user

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

REVOKED_TOKENS = set()


def _now():
    return datetime.now(timezone.utc).isoformat()


@router.post("/register", response_model=UserResponse, status_code=201)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        user_id=str(uuid.uuid4()),
        email=req.email.lower().strip(),
        name=req.name.strip(),
        password_hash=pwd_context.hash(req.password),
        account_type=req.account_type,
        created_at=_now(),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserResponse(
        user_id=user.user_id,
        email=user.email,
        name=user.name,
        account_type=user.account_type,
        created_at=user.created_at,
    )


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if not user or not pwd_context.verify(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is inactive")
    user.last_login = _now()
    db.commit()
    token = create_access_token({"sub": user.user_id, "role": user.account_type})
    response.set_cookie(key="vyapari_refresh", value=token, httponly=True)
    return TokenResponse(
        access_token=token,
        role=user.account_type,
        user_id=user.user_id,
        name=user.name,
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(request: Request, db: Session = Depends(get_db)):
    cookie_token = request.cookies.get("vyapari_refresh")
    auth_header = request.headers.get("Authorization", "")
    token = cookie_token or (auth_header.replace("Bearer ", "") if auth_header.startswith("Bearer ") else None)

    if not token or token in REVOKED_TOKENS:
        raise HTTPException(status_code=401, detail="Refresh token revoked or missing")

    from app.core.auth import decode_token
    payload = decode_token(token)
    user_id = payload.get("sub")
    user = db.query(User).filter(User.user_id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    new_token = create_access_token({"sub": user.user_id, "role": user.account_type})
    return TokenResponse(
        access_token=new_token,
        role=user.account_type,
        user_id=user.user_id,
        name=user.name,
    )


@router.post("/logout")
def logout(request: Request, response: Response):
    cookie_token = request.cookies.get("vyapari_refresh")
    if cookie_token:
        REVOKED_TOKENS.add(cookie_token)
    response.delete_cookie("vyapari_refresh")
    return {"message": "Logged out", "status": "logged_out"}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        user_id=current_user.user_id,
        email=current_user.email,
        name=current_user.name,
        account_type=current_user.account_type,
        created_at=current_user.created_at,
    )


class ProfileUpdateIn(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None


@router.put("/me", response_model=UserResponse)
@router.put("/profile", response_model=UserResponse)
def update_profile(
    payload: ProfileUpdateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.name:
        current_user.name = payload.name.strip()
    if payload.email:
        new_email = payload.email.lower().strip()
        existing = db.query(User).filter(User.email == new_email).first()
        if existing and existing.user_id != current_user.user_id:
            raise HTTPException(status_code=400, detail="Email already in use")
        current_user.email = new_email
    db.commit()
    db.refresh(current_user)
    return UserResponse(
        user_id=current_user.user_id,
        email=current_user.email,
        name=current_user.name,
        account_type=current_user.account_type,
        created_at=current_user.created_at,
    )

