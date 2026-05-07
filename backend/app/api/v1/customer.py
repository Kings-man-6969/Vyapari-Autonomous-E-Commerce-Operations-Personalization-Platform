from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
import uuid
from datetime import datetime
from pydantic import BaseModel

from ... import models, schemas
from ...core.security import get_db, get_current_user

router = APIRouter()

# MVP Cart storage
SESSION_CARTS: dict[str, dict[str, int]] = {}

@router.get("/products", response_model=schemas.ProductsResponse)
def list_products(
    category: Optional[str] = None,
    sort: Optional[str] = None,
    in_stock: bool = False,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(models.Product)
    if category:
        query = query.filter(models.Product.category == category)
    if in_stock:
        query = query.filter(models.Product.stock > 0)

    if sort == "price_asc":
        query = query.order_by(models.Product.price.asc())
    elif sort == "price_desc":
        query = query.order_by(models.Product.price.desc())
    elif sort == "newest":
        query = query.order_by(models.Product.created_at.desc())

    total = query.count()
    products = query.offset((page - 1) * per_page).limit(per_page).all()
    return schemas.ProductsResponse(
        products=[schemas.ProductOut.model_validate(p) for p in products],
        total=total,
        page=page,
        per_page=per_page,
    )

@router.get("/search", response_model=schemas.ProductsResponse)
def search_products(
    q: str = Query(min_length=2, max_length=100, description="Search query"),
    top_n: int = Query(default=10, ge=1, le=20),
    db: Session = Depends(get_db),
):
    """Live search endpoint for search-as-you-type dropdown suggestions."""
    like = f"%{q}%"
    query = db.query(models.Product).filter(
        (models.Product.name.ilike(like)) |
        (models.Product.category.ilike(like)) |
        (models.Product.description.ilike(like))
    ).filter(models.Product.stock > 0)
    total = query.count()
    products = query.limit(top_n).all()
    return schemas.ProductsResponse(
        products=[schemas.ProductOut.model_validate(p) for p in products],
        total=total,
        page=1,
        per_page=top_n,
    )

@router.get("/products/{product_id}", response_model=schemas.ProductOut)
def get_product(product_id: str, db: Session = Depends(get_db)):
    p = db.query(models.Product).filter(models.Product.product_id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return schemas.ProductOut.model_validate(p)

@router.get("/products/{product_id}/reviews")
def get_product_reviews(product_id: str, db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(models.Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    reviews = (
        db.query(models.Review)
        .filter(models.Review.product_id == product_id)
        .order_by(models.Review.created_at.desc())
        .limit(50)
        .all()
    )
    return {
        "reviews": [
            {
                "review_id": r.review_id,
                "user_id": r.user_id,
                "stars": r.stars,
                "text": r.text,
                "sentiment": r.sentiment,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in reviews
        ],
        "total": len(reviews),
        "avg_stars": round(sum(r.stars for r in reviews) / len(reviews), 1) if reviews else 0,
    }

@router.post("/reviews", response_model=schemas.ReviewOut, status_code=201)
def create_review(review: schemas.ReviewIn, db: Session = Depends(get_db)):
    product_exists = db.query(models.Product).filter(models.Product.product_id == review.product_id).first()
    if not product_exists:
        raise HTTPException(status_code=404, detail="Product not found")

    review_id = f"REV_{uuid.uuid4().hex[:8]}"
    r = models.Review(review_id=review_id, product_id=review.product_id, user_id=review.user_id, stars=review.stars, text=review.text, status="pending")
    db.add(r)
    db.commit()
    db.refresh(r)
    return schemas.ReviewOut(review_id=r.review_id, product_id=r.product_id, user_id=r.user_id, stars=r.stars, text=r.text, status=r.status)




@router.get("/recommendations/{session_id}", response_model=schemas.RecommendationResponse)
def get_recommendations(session_id: str, top_n: int = 6, db: Session = Depends(get_db)):
    if top_n < 1 or top_n > 20:
        raise HTTPException(status_code=400, detail="top_n must be between 1 and 20")

    rating_rows = (
        db.query(
            models.Product,
            func.avg(models.Review.stars).label("avg_stars"),
            func.count(models.Review.id).label("review_count"),
        )
        .outerjoin(models.Review, models.Product.product_id == models.Review.product_id)
        .group_by(models.Product.id)
        .order_by(func.avg(models.Review.stars).desc().nullslast(), func.count(models.Review.id).desc())
        .limit(top_n)
        .all()
    )

    recommendations = []
    for product, avg_stars, review_count in rating_rows:
        avg_value = float(avg_stars) if avg_stars is not None else 0.0
        count_value = int(review_count or 0)
        confidence = min(0.95, 0.55 + (avg_value / 10.0) + (min(count_value, 20) / 100.0))
        recommendations.append(
            schemas.RecommendationItem(
                product_id=product.product_id,
                name=product.name,
                price=product.price,
                source="Popular",
                confidence=round(confidence, 2),
            )
        )

    return schemas.RecommendationResponse(
        recommendations=recommendations,
        generated_at=datetime.utcnow().isoformat() + "Z",
    )

@router.get("/cart", response_model=schemas.CartResponse)
def get_cart(session_id: str = Query(default="guest"), db: Session = Depends(get_db)):
    cart = SESSION_CARTS.get(session_id, {})
    items = []
    total = 0.0
    for product_id, qty in cart.items():
        product = db.query(models.Product).filter(models.Product.product_id == product_id).first()
        if not product:
            continue
        line_total = round(product.price * qty, 2)
        total += line_total
        items.append(
            schemas.CartItem(
                product_id=product.product_id,
                name=product.name,
                qty=qty,
                unit_price=product.price,
                line_total=line_total,
            )
        )
    return schemas.CartResponse(items=items, total=round(total, 2))

@router.post("/cart/add", response_model=schemas.CartResponse)
def add_to_cart(payload: schemas.CartAddIn, session_id: str = Query(default="guest"), db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(models.Product.product_id == payload.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    cart = SESSION_CARTS.setdefault(session_id, {})
    new_qty = cart.get(payload.product_id, 0) + payload.qty
    if new_qty > product.stock:
        raise HTTPException(status_code=400, detail=f"Only {product.stock} units in stock")
    cart[payload.product_id] = new_qty
    return get_cart(session_id=session_id, db=db)

@router.put("/cart/update", response_model=schemas.CartResponse)
def update_cart_item(payload: schemas.CartAddIn, session_id: str = Query(default="guest"), db: Session = Depends(get_db)):
    """Explicitly set a cart item's quantity. Use qty=0 to remove."""
    product = db.query(models.Product).filter(models.Product.product_id == payload.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    cart = SESSION_CARTS.setdefault(session_id, {})
    if payload.qty == 0:
        cart.pop(payload.product_id, None)
    else:
        if payload.qty > product.stock:
            raise HTTPException(status_code=400, detail=f"Only {product.stock} units available")
        cart[payload.product_id] = payload.qty
    return get_cart(session_id=session_id, db=db)

@router.delete("/cart/remove", response_model=schemas.CartResponse)
def remove_from_cart(product_id: str = Query(...), session_id: str = Query(default="guest"), db: Session = Depends(get_db)):
    """Remove a specific product entirely from the cart."""
    cart = SESSION_CARTS.get(session_id, {})
    cart.pop(product_id, None)
    return get_cart(session_id=session_id, db=db)

@router.delete("/cart/clear")
def clear_cart(session_id: str = Query(default="guest")):
    """Clear entire cart for a session."""
    SESSION_CARTS.pop(session_id, None)
    return {"status": "ok", "message": "Cart cleared"}


@router.post("/orders", response_model=schemas.OrderOut, status_code=201)
def create_order(payload: schemas.OrderCreateIn, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    order_id = f"ORD_{uuid.uuid4().hex[:8].upper()}"
    total_amount = 0.0
    order_items = []
    
    for item in payload.items:
        product = db.query(models.Product).filter(models.Product.product_id == item.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
        if product.stock < item.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for product {product.name}")
        
        line_total = product.price * item.quantity
        total_amount += line_total
        
        order_item_id = f"OI_{uuid.uuid4().hex[:8].upper()}"
        order_items.append(
            models.OrderItem(
                order_item_id=order_item_id,
                order_id=order_id,
                product_id=product.product_id,
                seller_id=product.seller_id,
                quantity=item.quantity,
                unit_price=product.price,
                line_total=line_total
            )
        )
        # Deduct stock
        product.stock -= item.quantity
    
    order = models.Order(
        order_id=order_id,
        user_id=user.user_id,
        total_amount=total_amount,
        status="pending",
        shipping_address=payload.shipping_address
    )
    
    db.add(order)
    db.add_all(order_items)
    
    # Create seller transactions
    for oi in order_items:
        t = models.Transaction(
            transaction_id=f"TXN_{uuid.uuid4().hex[:8].upper()}",
            seller_id=oi.seller_id,
            order_id=order_id,
            amount=oi.line_total,
            transaction_type="sale",
            description=f"Sale of {oi.quantity}x {oi.product_id}"
        )
        db.add(t)

    db.commit()
    db.refresh(order)
    
    items_out = [schemas.OrderItemOut.model_validate(oi) for oi in order_items]
    return schemas.OrderOut.model_validate(order).model_copy(update={"items": items_out})

@router.get("/orders", response_model=list[schemas.OrderOut])
def get_orders(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    orders = db.query(models.Order).filter(models.Order.user_id == user.user_id).order_by(models.Order.created_at.desc()).all()
    out = []
    for o in orders:
        items = db.query(models.OrderItem).filter(models.OrderItem.order_id == o.order_id).all()
        items_out = [schemas.OrderItemOut.model_validate(i) for i in items]
        out.append(schemas.OrderOut.model_validate(o).model_copy(update={"items": items_out}))
    return out

# Wishlist Endpoints
@router.get("/wishlist", response_model=list[schemas.WishlistItemOut])
def get_wishlist(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    items = db.query(models.WishlistItem).filter(models.WishlistItem.user_id == user.user_id).order_by(models.WishlistItem.created_at.desc()).all()
    out = []
    for item in items:
        product = db.query(models.Product).filter(models.Product.product_id == item.product_id).first()
        if product:
            out.append({
                "product_id": product.product_id,
                "name": product.name,
                "price": product.price,
                "added_at": item.created_at
            })
    return out

@router.post("/wishlist", status_code=201)
def add_to_wishlist(payload: schemas.WishlistAddIn, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    existing = db.query(models.WishlistItem).filter(models.WishlistItem.user_id == user.user_id, models.WishlistItem.product_id == payload.product_id).first()
    if not existing:
        db.add(models.WishlistItem(user_id=user.user_id, product_id=payload.product_id))
        db.commit()
    return {"status": "ok"}

@router.delete("/wishlist/{product_id}")
def remove_from_wishlist(product_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    db.query(models.WishlistItem).filter(models.WishlistItem.user_id == user.user_id, models.WishlistItem.product_id == product_id).delete()
    db.commit()
    return {"status": "ok"}

# Profile Endpoints
class UserProfileUpdateIn(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None

@router.put("/profile", response_model=schemas.UserMe)
def update_profile(payload: UserProfileUpdateIn, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if payload.name:
        user.name = payload.name
    if payload.email:
        # Simple check, obviously not full validation
        existing = db.query(models.User).filter(models.User.email == payload.email).first()
        if existing and existing.user_id != user.user_id:
            raise HTTPException(status_code=400, detail="Email already registered")
        user.email = payload.email
    db.commit()
    db.refresh(user)
    return schemas.UserMe(
        user_id=user.user_id,
        email=user.email,
        name=user.name,
        account_type=user.account_type
    )



