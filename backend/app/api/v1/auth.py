from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie, Header
from sqlalchemy.orm import Session
from typing import Optional
import jwt
from datetime import datetime

from ... import models, schemas
from ...core.security import (
    get_db, verify_password, create_access_token, create_refresh_token,
    set_refresh_cookie, clear_refresh_cookie, JWT_SECRET, JWT_ALGORITHM, REFRESH_COOKIE_NAME,
    get_current_user
)

router = APIRouter()

@router.post("/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginIn, response: Response, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

    access_token = create_access_token(user.user_id, user.account_type)
    refresh_token, refresh_expires = create_refresh_token(user.user_id)

    user.refresh_token = refresh_token
    user.refresh_token_expires_at = refresh_expires
    user.last_login = datetime.utcnow()
    db.commit()

    set_refresh_cookie(response, refresh_token)

    return schemas.TokenResponse(access_token=access_token, role=user.account_type, user_id=user.user_id)

@router.get("/me", response_model=schemas.UserMe)
def me(user: models.User = Depends(get_current_user)):
    return schemas.UserMe(
        user_id=user.user_id,
        email=user.email,
        name=user.name,
        account_type=user.account_type,
        is_active=user.is_active,
    )

@router.post("/refresh", response_model=schemas.TokenResponse)
def refresh(
    response: Response,
    request_refresh_token: Optional[str] = Cookie(default=None, alias=REFRESH_COOKIE_NAME),
    header_refresh_token: Optional[str] = Header(default=None, alias="X-Refresh-Token"),
    db: Session = Depends(get_db),
):
    refresh_token = request_refresh_token or header_refresh_token
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token missing")

    try:
        payload = jwt.decode(refresh_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
        user_id = payload.get("sub")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")

    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not user or user.refresh_token != refresh_token or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token invalid or revoked")

    new_refresh_token, refresh_expires = create_refresh_token(user.user_id)
    user.refresh_token = new_refresh_token
    user.refresh_token_expires_at = refresh_expires
    db.commit()

    set_refresh_cookie(response, new_refresh_token)

    new_access_token = create_access_token(user.user_id, user.account_type)
    return schemas.TokenResponse(access_token=new_access_token, role=user.account_type, user_id=user.user_id)

@router.post("/logout")
def logout(response: Response, request_refresh_token: Optional[str] = Cookie(default=None, alias=REFRESH_COOKIE_NAME), db: Session = Depends(get_db)):
    if request_refresh_token:
        user = db.query(models.User).filter(models.User.refresh_token == request_refresh_token).first()
        if user:
            user.refresh_token = None
            user.refresh_token_expires_at = None
            db.commit()
    clear_refresh_cookie(response)
    return {"status": "logged_out"}

@router.post("/register", response_model=schemas.TokenResponse, status_code=201)
def register(payload: schemas.RegisterIn, response: Response, db: Session = Depends(get_db)):
    """Register a new customer account."""
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    from ...core.security import hash_password
    import uuid
    user_id = f"USR_{uuid.uuid4().hex[:8].upper()}"
    user = models.User(
        user_id=user_id,
        email=payload.email,
        name=payload.name,
        account_type="customer",
        password_hash=hash_password(payload.password),
        is_active=1,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(user.user_id, user.account_type)
    refresh_token, refresh_expires = create_refresh_token(user.user_id)
    user.refresh_token = refresh_token
    user.refresh_token_expires_at = refresh_expires
    db.commit()

    set_refresh_cookie(response, refresh_token)
    return schemas.TokenResponse(access_token=access_token, role=user.account_type, user_id=user.user_id)
