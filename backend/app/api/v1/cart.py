import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import CartItem, Product
from app.schemas import CartItemAdd, CartItemUpdate, CartResponse, CartItemOut

router = APIRouter()


def _now():
    return datetime.now(timezone.utc).isoformat()


def _build_cart_response(session_id: str, db: Session) -> CartResponse:
    items = db.query(CartItem).filter(CartItem.session_id == session_id).all()
    out = []
    total = 0.0
    for ci in items:
        p = ci.product
        if not p:
            continue
        subtotal = round(p.price * ci.qty, 2)
        total += subtotal
        out.append(CartItemOut(
            cart_item_id=ci.cart_item_id,
            product_id=p.product_id,
            name=p.name,
            price=p.price,
            qty=ci.qty,
            image_url=p.image_url,
            subtotal=subtotal,
            in_stock=p.stock > 0,
            available_stock=p.stock,
        ))
    return CartResponse(items=out, item_count=len(out), total=round(total, 2))


@router.get("", response_model=CartResponse)
def get_cart(session_id: str = Query(...), db: Session = Depends(get_db)):
    return _build_cart_response(session_id, db)


@router.post("/add", response_model=CartResponse)
def add_to_cart(
    body: CartItemAdd,
    session_id: str = Query(...),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.product_id == body.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    existing = (
        db.query(CartItem)
        .filter(CartItem.session_id == session_id, CartItem.product_id == body.product_id)
        .first()
    )
    new_qty = (existing.qty if existing else 0) + body.qty
    if new_qty > product.stock:
        raise HTTPException(status_code=400, detail=f"Only {product.stock} units available")

    if existing:
        existing.qty = new_qty
    else:
        db.add(CartItem(
            cart_item_id=str(uuid.uuid4()),
            session_id=session_id,
            product_id=body.product_id,
            qty=body.qty,
            added_at=_now(),
        ))
    db.commit()
    return _build_cart_response(session_id, db)


@router.patch("/item/{cart_item_id}", response_model=CartResponse)
def update_cart_item(
    cart_item_id: str,
    body: CartItemUpdate,
    session_id: str = Query(...),
    db: Session = Depends(get_db),
):
    ci = db.query(CartItem).filter(
        CartItem.cart_item_id == cart_item_id, CartItem.session_id == session_id
    ).first()
    if not ci:
        raise HTTPException(status_code=404, detail="Cart item not found")
    if body.qty > ci.product.stock:
        raise HTTPException(status_code=400, detail=f"Only {ci.product.stock} units available")
    ci.qty = body.qty
    db.commit()
    return _build_cart_response(session_id, db)


@router.delete("/item/{cart_item_id}", response_model=CartResponse)
def remove_cart_item(
    cart_item_id: str,
    session_id: str = Query(...),
    db: Session = Depends(get_db),
):
    ci = db.query(CartItem).filter(
        CartItem.cart_item_id == cart_item_id, CartItem.session_id == session_id
    ).first()
    if not ci:
        raise HTTPException(status_code=404, detail="Cart item not found")
    db.delete(ci)
    db.commit()
    return _build_cart_response(session_id, db)


@router.delete("", )
def clear_cart(session_id: str = Query(...), db: Session = Depends(get_db)):
    db.query(CartItem).filter(CartItem.session_id == session_id).delete()
    db.commit()
    return {"message": "Cart cleared"}
