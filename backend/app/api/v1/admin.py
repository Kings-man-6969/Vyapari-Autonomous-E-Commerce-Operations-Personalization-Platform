from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import UserMe
from app.core.auth import require_admin

router = APIRouter()


@router.get("/users", response_model=List[UserMe])
def get_all_users(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        UserMe(
            user_id=u.user_id,
            email=u.email,
            name=u.name,
            account_type=u.account_type,
            is_active=bool(u.is_active),
            created_at=u.created_at,
        )
        for u in users
    ]
