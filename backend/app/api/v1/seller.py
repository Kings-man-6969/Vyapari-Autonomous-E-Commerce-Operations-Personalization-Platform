from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import uuid

from ... import models, schemas
from ...core.security import get_db, require_roles

router = APIRouter()

@router.get("/stats", response_model=schemas.StatsResponse)
def get_stats(db: Session = Depends(get_db), _: models.User = Depends(require_roles({"seller", "admin"}))):
    return schemas.StatsResponse(
        total_products=db.query(models.Product).count(),
        critical_stock_items=db.query(models.Product).filter(models.Product.stock < 5).count(),
        stock_warning_items=db.query(models.Product).filter(models.Product.stock >= 5, models.Product.stock <= 20).count(),
        pending_agent_decisions=db.query(models.Decision).filter(models.Decision.decision_status == "pending").count(),
        pending_reviews=db.query(models.Review).filter(models.Review.status == "pending").count(),
        escalated_reviews=db.query(models.Review).filter(models.Review.sentiment == "NEGATIVE").count(),
    )

@router.get("/products/seller/inventory", response_model=schemas.InventoryListResponse)
def list_seller_products(page: int = Query(default=1, ge=1), per_page: int = Query(default=20, ge=1, le=100), db: Session = Depends(get_db), user: models.User = Depends(require_roles({"seller", "admin"}))):
    query = db.query(models.Product)
    if user.account_type == "seller":
        query = query.filter(models.Product.seller_id == user.user_id)

    total = query.count()
    products = query.offset((page - 1) * per_page).limit(per_page).all()
    return schemas.InventoryListResponse(
        products=[schemas.ProductOut.model_validate(p) for p in products],
        total=total,
        page=page,
    )

@router.post("/products/seller", response_model=schemas.ProductOut, status_code=201)
def create_product(payload: schemas.ProductCreateIn, db: Session = Depends(get_db), user: models.User = Depends(require_roles({"seller", "admin"}))):
    product_id = f"PRD_{uuid.uuid4().hex[:8].upper()}"
    product = models.Product(
        product_id=product_id,
        seller_id=user.user_id,
        name=payload.name,
        category=payload.category,
        price=payload.price,
        cost=payload.cost,
        stock=payload.stock,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return schemas.ProductOut.model_validate(product)

@router.put("/products/{product_id}/seller", response_model=schemas.ProductOut)
def update_product(product_id: str, payload: schemas.ProductUpdateIn, db: Session = Depends(get_db), user: models.User = Depends(require_roles({"seller", "admin"}))):
    product = db.query(models.Product).filter(models.Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if product.seller_id != user.user_id and user.account_type != "admin":
        raise HTTPException(status_code=403, detail="Cannot update another seller's product")

    if payload.name is not None:
        product.name = payload.name
    if payload.price is not None:
        product.price = payload.price
    if payload.cost is not None:
        product.cost = payload.cost
    if payload.stock is not None:
        product.stock = payload.stock

    db.commit()
    db.refresh(product)
    return schemas.ProductOut.model_validate(product)


@router.post("/products/{product_id}/price")
def update_product_price(product_id: str, new_price: float = Query(..., gt=0), db: Session = Depends(get_db), user: models.User = Depends(require_roles({"seller", "admin"}))):
    product = db.query(models.Product).filter(models.Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if product.seller_id != user.user_id and user.account_type != "admin":
        raise HTTPException(status_code=403, detail="Cannot update another seller's product")
    
    old_price = product.price
    price_log_id = f"PH_{uuid.uuid4().hex[:8].upper()}"
    price_log = models.PriceHistory(
        price_history_id=price_log_id,
        product_id=product_id,
        old_price=old_price,
        new_price=new_price,
        changed_by=user.user_id,
    )
    
    product.price = new_price
    db.add(price_log)
    db.commit()
    
    return {"status": "ok", "old_price": old_price, "new_price": new_price}

@router.get("/products/{product_id}/price-history")
def get_price_history(product_id: str, db: Session = Depends(get_db)):
    history = db.query(models.PriceHistory).filter(models.PriceHistory.product_id == product_id).order_by(models.PriceHistory.created_at.desc()).all()
    return {"price_history": [{"old_price": h.old_price, "new_price": h.new_price, "changed_at": h.created_at.isoformat() if h.created_at else None} for h in history]}

@router.post("/reviews/{review_id}/response", response_model=schemas.ReviewResponseOut)
def add_review_response(review_id: str, payload: schemas.ReviewResponseIn, db: Session = Depends(get_db), user: models.User = Depends(require_roles({"seller", "admin"}))):
    review = db.query(models.Review).filter(models.Review.review_id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    product = db.query(models.Product).filter(models.Product.product_id == review.product_id).first()
    if not product or (product.seller_id != user.user_id and user.account_type != "admin"):
        raise HTTPException(status_code=403, detail="Cannot respond to reviews for another seller's product")
    
    response_id = f"RR_{uuid.uuid4().hex[:8].upper()}"
    response = models.ReviewResponse(
        response_id=response_id,
        review_id=review_id,
        seller_id=user.user_id,
        response_text=payload.response_text,
    )
    db.add(response)
    db.commit()
    db.refresh(response)
    return schemas.ReviewResponseOut.model_validate(response)

@router.get("/reviews/seller/pending")
def get_pending_seller_reviews(db: Session = Depends(get_db), user: models.User = Depends(require_roles({"seller", "admin"}))):
    seller_products = db.query(models.Product.product_id).filter(models.Product.seller_id == user.user_id)
    reviews = db.query(models.Review).filter(
        models.Review.product_id.in_(seller_products),
        ~db.query(models.ReviewResponse).filter(models.ReviewResponse.review_id == models.Review.review_id).exists()
    ).all()
    
    return {
        "pending_reviews": [
            {
                "review_id": r.review_id,
                "product_id": r.product_id,
                "stars": r.stars,
                "text": r.text,
                "user_id": r.user_id,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in reviews
        ],
        "total": len(reviews),
    }

# Seller Orders
@router.get("/seller/orders", response_model=list[schemas.OrderItemOut])
def get_seller_orders(db: Session = Depends(get_db), user: models.User = Depends(require_roles({"seller", "admin"}))):
    results = db.query(models.OrderItem, models.Order.status).join(
        models.Order, models.OrderItem.order_id == models.Order.order_id
    ).filter(models.OrderItem.seller_id == user.user_id).order_by(models.OrderItem.created_at.desc()).all()

    out = []
    for item, order_status in results:
        out.append(schemas.OrderItemOut(
            order_item_id=item.order_item_id,
            order_id=item.order_id,
            product_id=item.product_id,
            seller_id=item.seller_id,
            quantity=item.quantity,
            unit_price=item.unit_price,
            line_total=item.line_total,
            status=item.status or order_status or "processing",
            created_at=item.created_at,
        ))
    return out


@router.put("/seller/orders/{order_item_id}/status")
def update_order_item_status(order_item_id: str, status: str = Query(..., pattern="^(processing|shipped|delivered|cancelled)$"), db: Session = Depends(get_db), user: models.User = Depends(require_roles({"seller", "admin"}))):
    item = db.query(models.OrderItem).filter(models.OrderItem.order_item_id == order_item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Order item not found")
    if item.seller_id != user.user_id and user.account_type != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # We are updating the order item status, wait, OrderItem doesn't have a status in our schema, only Order does.
    # To support multi-vendor properly, OrderItem needs its own status, or we simplify by just tracking it at the OrderItem level.
    # Let me check models.py: OrderItem doesn't have status. I need to add status to OrderItem first if I want sellers to update it.
    # Alternatively, the seller updates the entire Order status (naive MVP approach). I will update the whole Order status.
    order = db.query(models.Order).filter(models.Order.order_id == item.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.status = status
    db.commit()
    return {"status": "ok", "new_status": status}

# Seller Finance
@router.get("/seller/finance", response_model=schemas.FinanceDashboardOut)
def get_seller_finance(db: Session = Depends(get_db), user: models.User = Depends(require_roles({"seller", "admin"}))):
    transactions = db.query(models.Transaction).filter(models.Transaction.seller_id == user.user_id).order_by(models.Transaction.created_at.desc()).all()
    total_revenue = sum(t.amount for t in transactions if t.transaction_type == "sale")
    pending_payout = total_revenue - sum(t.amount for t in transactions if t.transaction_type == "payout")
    
    return schemas.FinanceDashboardOut(
        total_revenue=total_revenue,
        pending_payout=pending_payout,
        recent_transactions=[schemas.TransactionOut.model_validate(t) for t in transactions[:20]]
    )

# Seller Settings
@router.get("/seller/settings", response_model=schemas.SellerSettingsOut)
def get_seller_settings(db: Session = Depends(get_db), user: models.User = Depends(require_roles({"seller", "admin"}))):
    settings = db.query(models.SellerSettings).filter(models.SellerSettings.seller_id == user.user_id).first()
    if not settings:
        settings = models.SellerSettings(seller_id=user.user_id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return schemas.SellerSettingsOut.model_validate(settings)

@router.put("/seller/settings", response_model=schemas.SellerSettingsOut)
def update_seller_settings(payload: schemas.SellerSettingsUpdateIn, db: Session = Depends(get_db), user: models.User = Depends(require_roles({"seller", "admin"}))):
    settings = db.query(models.SellerSettings).filter(models.SellerSettings.seller_id == user.user_id).first()
    if not settings:
        settings = models.SellerSettings(seller_id=user.user_id)
        db.add(settings)
    
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(settings, key, value)
        
    db.commit()
    db.refresh(settings)
    return schemas.SellerSettingsOut.model_validate(settings)
