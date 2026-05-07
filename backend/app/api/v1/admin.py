from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ... import models, schemas
from ...core.security import get_db, require_roles

router = APIRouter()

@router.get("/users", response_model=List[schemas.UserMe])
def get_all_users(db: Session = Depends(get_db), user: models.User = Depends(require_roles({"admin"}))):
    users = db.query(models.User).order_by(models.User.created_at.desc()).all()
    return users
