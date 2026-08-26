import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import WishlistItem, Product, User
from app.schemas import WishlistResponse, WishlistItemOut
from app.core.auth import get_current_user

router = APIRouter()


def _now():
    return datetime.now(timezone.utc).isoformat()


def _build_wishlist(user_id: str, db: Session) -> WishlistResponse:
    items = db.query(WishlistItem).filter(WishlistItem.user_id == user_id).all()
    out = [
        WishlistItemOut(
            product_id=wi.product.product_id,
            name=wi.product.name,
            price=wi.product.price,
            image_url=wi.product.image_url,
            in_stock=wi.product.stock > 0,
            added_at=wi.added_at,
        )
        for wi in items
        if wi.product
    ]
    return WishlistResponse(items=out, total=len(out))


@router.get("", response_model=WishlistResponse)
def get_wishlist(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _build_wishlist(current_user.user_id, db)


@router.post("/{product_id}")
def add_to_wishlist(
    product_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    existing = db.query(WishlistItem).filter(
        WishlistItem.user_id == current_user.user_id,
        WishlistItem.product_id == product_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already in wishlist")

    db.add(WishlistItem(
        wishlist_id=str(uuid.uuid4()),
        user_id=current_user.user_id,
        product_id=product_id,
        added_at=_now(),
    ))
    db.commit()
    wishlist = _build_wishlist(current_user.user_id, db)
    return {"message": "Added to wishlist", "total": wishlist.total}


@router.delete("/{product_id}")
def remove_from_wishlist(
    product_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    wi = db.query(WishlistItem).filter(
        WishlistItem.user_id == current_user.user_id,
        WishlistItem.product_id == product_id,
    ).first()
    if not wi:
        raise HTTPException(status_code=404, detail="Not in wishlist")
    db.delete(wi)
    db.commit()
    wishlist = _build_wishlist(current_user.user_id, db)
    return {"message": "Removed from wishlist", "total": wishlist.total}
