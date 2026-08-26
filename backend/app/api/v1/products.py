import math
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models import Product, User
from app.schemas import (
    ProductListResponse, ProductOut, ProductDetailOut, ReviewPublic,
    SearchResponse, SearchResult, RecommendationResponse,
    ProductCreate, ProductUpdate,
)
from app.core.auth import get_optional_user, require_seller
from app.services.recommendation import get_recommendations

router = APIRouter()

CATEGORIES = ["Electronics", "Clothing", "Books", "Home & Kitchen", "Sports"]


def _product_out(p: Product) -> dict:
    return {
        "product_id": p.product_id,
        "name": p.name,
        "category": p.category,
        "description": p.description or "",
        "price": p.price,
        "cost": p.cost,
        "stock": p.stock,
        "sku": p.sku,
        "image_url": p.image_url,
        "avg_rating": p.avg_rating or 0.0,
        "review_count": p.review_count or 0,
        "in_stock": p.stock > 0,
        "created_at": p.created_at,
    }


@router.get("/products", response_model=ProductListResponse)
def list_products(
    category: Optional[str] = None,
    sort: Optional[str] = "newest",
    in_stock: Optional[bool] = None,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Product)
    if category and category in CATEGORIES:
        q = q.filter(Product.category == category)
    if in_stock is True:
        q = q.filter(Product.stock > 0)
    if min_price is not None:
        q = q.filter(Product.price >= min_price)
    if max_price is not None:
        q = q.filter(Product.price <= max_price)
    if search:
        term = f"%{search.lower()}%"
        q = q.filter(
            or_(Product.name.ilike(term), Product.description.ilike(term), Product.category.ilike(term))
        )

    sort_map = {
        "price_asc": Product.price.asc(),
        "price_desc": Product.price.desc(),
        "rating": Product.avg_rating.desc(),
        "newest": Product.created_at.desc(),
    }
    q = q.order_by(sort_map.get(sort, Product.created_at.desc()))

    total = q.count()
    total_pages = math.ceil(total / per_page)
    products = q.offset((page - 1) * per_page).limit(per_page).all()

    return ProductListResponse(
        products=[ProductOut(**_product_out(p)) for p in products],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )


@router.get("/products/{product_id}", response_model=ProductDetailOut)
def get_product(product_id: str, db: Session = Depends(get_db)):
    p = db.query(Product).filter(Product.product_id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")

    reviews = []
    for r in p.reviews:
        if r.status == "published" or True:  # show all non-rejected reviews
            if r.status == "rejected":
                continue
            user_name = r.user.name[:1] + "." if r.user else "Customer"
            reviews.append(
                ReviewPublic(
                    review_id=r.review_id,
                    stars=r.stars,
                    text=r.text,
                    sentiment=r.sentiment,
                    agent_response=r.agent_response if r.response_status == "published" else None,
                    response_published_at=r.response_published_at,
                    created_at=r.created_at,
                    user_name=user_name,
                )
            )

    data = _product_out(p)
    return ProductDetailOut(**data, reviews=reviews)


@router.get("/products/{product_id}/reviews")
def get_product_reviews(product_id: str, db: Session = Depends(get_db)):
    p = db.query(Product).filter(Product.product_id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    reviews = []
    for r in p.reviews:
        if r.status == "rejected":
            continue
        user_name = (r.user.name[:1] + ".") if r.user else "Customer"
        reviews.append({
            "review_id": r.review_id,
            "stars": r.stars,
            "text": r.text,
            "sentiment": r.sentiment,
            "agent_response": r.agent_response if r.response_status == "published" else None,
            "response_published_at": r.response_published_at,
            "created_at": r.created_at,
            "user_name": user_name,
        })
    return {"reviews": reviews, "total": len(reviews)}


@router.get("/search", response_model=SearchResponse)
def search_products(
    q: str = Query(..., min_length=1),
    top_n: int = Query(default=8, ge=1, le=50),
    category: Optional[str] = None,
    db: Session = Depends(get_db),
):
    term = f"%{q.lower()}%"
    query = db.query(Product).filter(
        or_(Product.name.ilike(term), Product.description.ilike(term), Product.category.ilike(term))
    )
    if category:
        query = query.filter(Product.category == category)
    query = query.order_by(Product.avg_rating.desc())
    products = query.limit(top_n).all()

    if not products:
        # Fallback: return popular products
        products = db.query(Product).filter(Product.stock > 0).order_by(Product.avg_rating.desc()).limit(top_n).all()
        results = [
            SearchResult(
                product_id=p.product_id,
                name=p.name,
                category=p.category,
                price=p.price,
                avg_rating=p.avg_rating or 0,
                image_url=p.image_url,
                match_reason="Popular item",
                in_stock=p.stock > 0,
                stock=p.stock,
            )
            for p in products
        ]
        return SearchResponse(results=results, total=len(results), query=q)

    def _reason(p: Product) -> str:
        name_match = q.lower() in p.name.lower()
        cat_match = q.lower() in p.category.lower()
        if name_match:
            return f"Name matches '{q}'"
        if cat_match:
            return f"Category '{p.category}' matches"
        return f"Description matches '{q}'"

    results = [
        SearchResult(
            product_id=p.product_id,
            name=p.name,
            category=p.category,
            price=p.price,
            avg_rating=p.avg_rating or 0,
            image_url=p.image_url,
            match_reason=_reason(p),
            in_stock=p.stock > 0,
            stock=p.stock,
        )
        for p in products
    ]
    return SearchResponse(results=results, total=len(results), query=q)


@router.get("/recommendations", response_model=RecommendationResponse)
@router.get("/recommendations/{session_id}", response_model=RecommendationResponse)
def recommendations(
    session_id: Optional[str] = None,
    top_n: int = Query(default=6, ge=1, le=20),
    db: Session = Depends(get_db),
):
    sid = session_id or "guest"
    result = get_recommendations(db, sid, top_n)
    return RecommendationResponse(**result)


# ─── Seller Direct Routes ───────────────────────────────────────────────────

@router.post("/products/seller", response_model=ProductOut, status_code=201)
def create_product_direct(
    body: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_seller),
):
    count = db.query(Product).count()
    product_id = f"PRD_{(count + 1):03d}"
    from datetime import datetime, timezone
    now_str = datetime.now(timezone.utc).isoformat()
    p = Product(
        product_id=product_id,
        seller_id=current_user.user_id,
        name=body.name,
        category=body.category,
        description=body.description or "",
        price=body.price,
        cost=body.cost,
        stock=body.stock,
        sku=body.sku,
        image_url=body.image_url or "📦",
        avg_rating=0.0,
        review_count=0,
        created_at=now_str,
        updated_at=now_str,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return ProductOut(**_product_out(p))


@router.put("/products/{product_id}/seller", response_model=ProductOut)
def update_product_direct(
    product_id: str,
    body: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_seller),
):
    p = db.query(Product).filter(
        Product.product_id == product_id, Product.seller_id == current_user.user_id
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    if body.name is not None:
        p.name = body.name
    if body.category is not None:
        p.category = body.category
    if body.price is not None:
        p.price = body.price
    if body.stock is not None:
        p.stock = body.stock
    from datetime import datetime, timezone
    p.updated_at = datetime.now(timezone.utc).isoformat()
    db.commit()
    db.refresh(p)
    return ProductOut(**_product_out(p))


@router.get("/products/seller/inventory")
def get_seller_inventory_direct(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_seller),
):
    products = db.query(Product).filter(Product.seller_id == current_user.user_id).all()
    return {"products": [_product_out(p) for p in products], "total": len(products)}


