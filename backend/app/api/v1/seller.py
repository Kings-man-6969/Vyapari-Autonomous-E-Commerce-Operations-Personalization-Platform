import uuid
import json
import math
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import Product, Order, OrderItem, Review, Decision, User, StoreSettings, PriceHistory
from app.schemas import (
    ProductCreate, ProductUpdate, ProductOut,
    SellerStatsResponse, InventoryProductOut, InventoryListResponse,
    PricingProductOut, PricingListResponse, ScanResponse,
    AnalyticsResponse, CategoryRevenue, TopProduct, DailyRevenue,
    ReviewOut, ReviewListResponse, RespondRequest,
    OrderOut, OrderDetailOut, OrderItemOut, OrderStatusUpdate,
    StoreSettingsIn, StoreSettingsOut, PriceHistoryItem, PriceHistoryResponse,
    FinanceResponse, FinanceTransaction,
)
from app.core.auth import require_seller
from app.services.inventory_agent import run_inventory_scan
from app.services.pricing_agent import run_pricing_scan
from app.services.sentiment import classify_sentiment
from app.services.review_response import generate_response

router = APIRouter()

CATEGORIES = ["Electronics", "Clothing", "Books", "Home & Kitchen", "Sports"]


def _now():
    return datetime.now(timezone.utc).isoformat()


def _today_start():
    now = datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()


def _days_ago_str(n: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=n)).isoformat()


def _next_product_id(db: Session) -> str:
    count = db.query(Product).count()
    return f"PRD_{(count + 1):03d}"


def _inv_status(stock: int, avg_daily: float) -> tuple[str, float]:
    if avg_daily <= 0:
        return ("CRITICAL" if stock < 5 else "OK"), (9999.0)
    days = stock / avg_daily
    if days < 7:
        return "CRITICAL", round(days, 1)
    if days < 30:
        return "WARNING", round(days, 1)
    return "OK", round(days, 1)


# ─── Stats ────────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=SellerStatsResponse)
def get_stats(db: Session = Depends(get_db), current_user: User = Depends(require_seller)):
    cutoff_30 = _days_ago_str(30)
    today = _today_start()

    products = db.query(Product).filter(Product.seller_id == current_user.user_id).all()
    total_products = len(products)

    critical = 0
    warning = 0
    for p in products:
        sold = (
            db.query(func.sum(OrderItem.qty))
            .join(Order, OrderItem.order_id == Order.order_id)
            .filter(OrderItem.product_id == p.product_id, Order.created_at >= cutoff_30)
            .scalar() or 0
        )
        avg_daily = sold / 30
        status, _ = _inv_status(p.stock, avg_daily)
        if status == "CRITICAL":
            critical += 1
        elif status == "WARNING":
            warning += 1

    # Product IDs for this seller
    product_ids = [p.product_id for p in products]

    # Today's orders (orders containing seller's products)
    today_orders = (
        db.query(Order)
        .join(OrderItem, Order.order_id == OrderItem.order_id)
        .filter(OrderItem.product_id.in_(product_ids), Order.created_at >= today)
        .distinct(Order.order_id)
        .all()
    )
    orders_today = len(today_orders)
    revenue_today = sum(o.total_amount for o in today_orders)

    month_start = _days_ago_str(30)
    month_orders = (
        db.query(Order)
        .join(OrderItem, Order.order_id == OrderItem.order_id)
        .filter(OrderItem.product_id.in_(product_ids), Order.created_at >= month_start)
        .distinct(Order.order_id)
        .all()
    )
    revenue_month = sum(o.total_amount for o in month_orders)

    pending_dec = db.query(Decision).filter(Decision.decision_status == "pending").count()

    pending_rev = (
        db.query(Review)
        .filter(Review.product_id.in_(product_ids), Review.response_status.is_(None))
        .count()
    )
    escalated_rev = (
        db.query(Review)
        .filter(Review.product_id.in_(product_ids), Review.sentiment == "NEGATIVE", Review.stars == 1)
        .count()
    )

    approved = db.query(Decision).filter(Decision.decision_status == "approved").count()
    rejected = db.query(Decision).filter(Decision.decision_status == "rejected").count()
    approval_rate = approved / (approved + rejected) if (approved + rejected) > 0 else 0.85

    return SellerStatsResponse(
        total_products=total_products,
        critical_stock=critical,
        warning_stock=warning,
        total_orders_today=orders_today,
        revenue_today=round(revenue_today, 2),
        revenue_this_month=round(revenue_month, 2),
        pending_decisions=pending_dec,
        pending_reviews=pending_rev,
        escalated_reviews=escalated_rev,
        approval_rate=round(approval_rate, 3),
    )


# ─── Inventory ────────────────────────────────────────────────────────────────

@router.get("/inventory", response_model=InventoryListResponse)
def get_inventory(
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_seller),
):
    cutoff_30 = _days_ago_str(30)
    products = db.query(Product).filter(Product.seller_id == current_user.user_id).all()

    items = []
    critical_count = warning_count = ok_count = 0

    for p in products:
        sold = (
            db.query(func.sum(OrderItem.qty))
            .join(Order, OrderItem.order_id == Order.order_id)
            .filter(OrderItem.product_id == p.product_id, Order.created_at >= cutoff_30)
            .scalar() or 0
        )
        avg_daily = round(sold / 30, 2)
        inv_status, days_rem = _inv_status(p.stock, avg_daily)

        if inv_status == "CRITICAL":
            critical_count += 1
        elif inv_status == "WARNING":
            warning_count += 1
        else:
            ok_count += 1

        if status and status.upper() != "ALL" and inv_status != status.upper():
            continue
        if search and search.lower() not in p.name.lower():
            continue

        items.append(InventoryProductOut(
            product_id=p.product_id,
            name=p.name,
            category=p.category,
            price=p.price,
            cost=p.cost,
            stock=p.stock,
            sku=p.sku,
            image_url=p.image_url,
            avg_rating=p.avg_rating or 0,
            review_count=p.review_count or 0,
            avg_daily_sales=avg_daily,
            days_remaining=days_rem if days_rem < 9999 else 9999,
            status=inv_status,
        ))

    total = len(items)
    paginated = items[(page - 1) * per_page: page * per_page]

    return InventoryListResponse(
        products=paginated,
        total=total,
        critical_count=critical_count,
        warning_count=warning_count,
        ok_count=ok_count,
    )


@router.patch("/products/{product_id}", response_model=ProductOut)
def update_product(
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
    if body.description is not None:
        p.description = body.description
    if body.image_url is not None:
        p.image_url = body.image_url
    if body.stock is not None:
        if body.stock < 0:
            raise HTTPException(status_code=422, detail="Stock cannot be negative")
        p.stock = body.stock
    if body.price is not None:
        new_price = body.price
        cost = body.cost if body.cost is not None else p.cost
        if new_price < cost * 1.10:
            raise HTTPException(
                status_code=422,
                detail=f"Price must be at least cost × 1.10 (₹{cost * 1.10:.2f})"
            )
        p.price = new_price
    if body.cost is not None:
        p.cost = body.cost

    p.updated_at = _now()
    db.commit()
    db.refresh(p)
    return ProductOut(
        product_id=p.product_id, name=p.name, category=p.category,
        description=p.description, price=p.price, cost=p.cost, stock=p.stock,
        sku=p.sku, image_url=p.image_url, avg_rating=p.avg_rating or 0,
        review_count=p.review_count or 0, in_stock=p.stock > 0, created_at=p.created_at,
    )


@router.post("/products", response_model=ProductOut, status_code=201)
def create_product(
    body: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_seller),
):
    if body.price < body.cost * 1.10:
        raise HTTPException(status_code=422, detail=f"Price must be ≥ cost × 1.10 (₹{body.cost * 1.10:.2f})")

    product_id = _next_product_id(db)
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
        created_at=_now(),
        updated_at=_now(),
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return ProductOut(
        product_id=p.product_id, name=p.name, category=p.category,
        description=p.description, price=p.price, cost=p.cost, stock=p.stock,
        sku=p.sku, image_url=p.image_url, avg_rating=0, review_count=0,
        in_stock=p.stock > 0, created_at=p.created_at,
    )


@router.delete("/products/{product_id}")
def delete_product(
    product_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_seller),
):
    p = db.query(Product).filter(
        Product.product_id == product_id, Product.seller_id == current_user.user_id
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(p)
    db.commit()
    return {"message": "Product deleted"}


@router.post("/inventory/scan", response_model=ScanResponse)
def inventory_scan(
    db: Session = Depends(get_db), current_user: User = Depends(require_seller)
):
    result = run_inventory_scan(db, current_user.user_id)
    return ScanResponse(**result)


# ─── Pricing ─────────────────────────────────────────────────────────────────

@router.get("/pricing", response_model=PricingListResponse)
def get_pricing(
    db: Session = Depends(get_db), current_user: User = Depends(require_seller)
):
    products = db.query(Product).filter(Product.seller_id == current_user.user_id).all()
    items = []
    for p in products:
        cp = p.competitor_price
        if not cp:
            continue
        min_comp = min(cp.competitor_a, cp.competitor_b, cp.competitor_c)
        diff = round((p.price - min_comp) / min_comp * 100, 2)
        suggested = round(max(p.cost * 1.10, min_comp * 1.03), 2)
        if diff > 5:
            pstatus = "OVERPRICED"
        elif diff < -5:
            pstatus = "UNDERPRICED"
        else:
            pstatus = "COMPETITIVE"

        items.append(PricingProductOut(
            product_id=p.product_id,
            name=p.name,
            our_price=p.price,
            competitor_a=cp.competitor_a,
            competitor_b=cp.competitor_b,
            competitor_c=cp.competitor_c,
            min_competitor=round(min_comp, 2),
            price_diff_pct=diff,
            suggested_price=suggested,
            status=pstatus,
            last_updated=cp.last_updated,
        ))
    return PricingListResponse(products=items, total=len(items))


@router.post("/pricing/scan", response_model=ScanResponse)
def pricing_scan(
    db: Session = Depends(get_db), current_user: User = Depends(require_seller)
):
    result = run_pricing_scan(db, current_user.user_id)
    return ScanResponse(**result)


# ─── Analytics ───────────────────────────────────────────────────────────────

@router.get("/analytics", response_model=AnalyticsResponse)
def get_analytics(
    period: str = Query(default="30d"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_seller),
):
    days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 30)
    cutoff = _days_ago_str(days)

    product_ids = [
        p.product_id
        for p in db.query(Product).filter(Product.seller_id == current_user.user_id).all()
    ]

    orders = (
        db.query(Order)
        .join(OrderItem, Order.order_id == OrderItem.order_id)
        .filter(OrderItem.product_id.in_(product_ids), Order.created_at >= cutoff)
        .distinct(Order.order_id)
        .all()
    )

    total_revenue = sum(o.total_amount for o in orders)
    total_orders = len(orders)
    avg_ov = total_revenue / total_orders if total_orders > 0 else 0

    # Top products
    product_revenue: dict = {}
    product_units: dict = {}
    product_names: dict = {}
    for order in orders:
        for item in order.items:
            if item.product_id in product_ids:
                rev = item.unit_price * item.qty
                product_revenue[item.product_id] = product_revenue.get(item.product_id, 0) + rev
                product_units[item.product_id] = product_units.get(item.product_id, 0) + item.qty
                product_names[item.product_id] = item.product_name

    sorted_prods = sorted(product_revenue.items(), key=lambda x: x[1], reverse=True)[:5]
    top_products = [
        TopProduct(
            product_id=pid,
            name=product_names.get(pid, pid),
            revenue=round(rev, 2),
            units_sold=product_units.get(pid, 0),
        )
        for pid, rev in sorted_prods
    ]

    # Revenue by category
    cat_revenue: dict = {}
    for order in orders:
        for item in order.items:
            if item.product_id in product_ids and item.product:
                cat = item.product.category
                rev = item.unit_price * item.qty
                cat_revenue[cat] = cat_revenue.get(cat, 0) + rev

    rev_by_cat = [
        CategoryRevenue(
            category=cat,
            revenue=round(rev, 2),
            pct=round(rev / total_revenue * 100, 1) if total_revenue > 0 else 0,
        )
        for cat, rev in sorted(cat_revenue.items(), key=lambda x: x[1], reverse=True)
    ]

    # Daily revenue
    daily: dict = {}
    for order in orders:
        date_str = order.created_at[:10]  # YYYY-MM-DD
        daily[date_str] = daily.get(date_str, {"revenue": 0, "orders": 0})
        daily[date_str]["revenue"] += order.total_amount
        daily[date_str]["orders"] += 1

    daily_revenue = [
        DailyRevenue(date=d, revenue=round(v["revenue"], 2), orders=v["orders"])
        for d, v in sorted(daily.items())
    ]

    return AnalyticsResponse(
        period=period,
        total_revenue=round(total_revenue, 2),
        total_orders=total_orders,
        avg_order_value=round(avg_ov, 2),
        top_products=top_products,
        revenue_by_category=rev_by_cat,
        daily_revenue=daily_revenue,
    )


# ─── Reviews (Seller) ─────────────────────────────────────────────────────────

@router.get("/reviews", response_model=ReviewListResponse)
def get_reviews(
    status: Optional[str] = None,
    sentiment: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_seller),
):
    product_ids = [
        p.product_id
        for p in db.query(Product).filter(Product.seller_id == current_user.user_id).all()
    ]
    q = db.query(Review).filter(Review.product_id.in_(product_ids))
    if status and status != "all":
        q = q.filter(Review.status == status)
    if sentiment and sentiment != "all":
        q = q.filter(Review.sentiment == sentiment)

    total = q.count()
    reviews = q.order_by(Review.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    # Count stats
    all_reviews = db.query(Review).filter(Review.product_id.in_(product_ids)).all()
    pending_count = sum(1 for r in all_reviews if r.response_status is None and r.status != "rejected")
    pos = sum(1 for r in all_reviews if r.sentiment == "POSITIVE")
    neg = sum(1 for r in all_reviews if r.sentiment == "NEGATIVE")
    neu = sum(1 for r in all_reviews if r.sentiment == "NEUTRAL")

    out = []
    for r in reviews:
        product_name = r.product.name if r.product else "Unknown"
        user_name = (r.user.name[:1] + ".") if r.user else "Customer"
        out.append(ReviewOut(
            review_id=r.review_id,
            product_id=r.product_id,
            product_name=product_name,
            user_name=user_name,
            stars=r.stars,
            text=r.text,
            sentiment=r.sentiment,
            status=r.status,
            agent_response=r.agent_response,
            response_status=r.response_status,
            response_published_at=r.response_published_at,
            created_at=r.created_at,
            processed_at=r.processed_at,
        ))

    return ReviewListResponse(
        reviews=out,
        total=total,
        pending_count=pending_count,
        positive_count=pos,
        negative_count=neg,
        neutral_count=neu,
    )


@router.post("/reviews/{review_id}/respond")
def respond_to_review(
    review_id: str,
    body: RespondRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_seller),
):
    review = db.query(Review).filter(Review.review_id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    review.agent_response = body.response
    review.response_status = "published"
    review.response_published_at = _now()
    review.status = "published"
    db.commit()
    return {"message": "Response published", "review_id": review_id}


@router.post("/reviews/{review_id}/reject")
def reject_review(
    review_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_seller),
):
    review = db.query(Review).filter(Review.review_id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    review.status = "rejected"
    db.commit()
    return {"message": "Review rejected", "review_id": review_id}


@router.post("/reviews/process")
def process_reviews(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_seller),
):
    product_ids = [
        p.product_id
        for p in db.query(Product).filter(Product.seller_id == current_user.user_id).all()
    ]
    unprocessed = db.query(Review).filter(
        Review.product_id.in_(product_ids),
        Review.sentiment.is_(None),
    ).all()

    processed = 0
    drafted = 0
    escalated = 0

    for r in unprocessed:
        sentiment, _ = classify_sentiment(r.text)
        r.sentiment = sentiment
        r.processed_at = _now()
        response_text, confidence, risk = generate_response(
            r.text, sentiment, r.stars,
            r.product.name if r.product else "Product",
            r.product.category if r.product else "General",
        )
        if risk == "LOW" and response_text:
            r.agent_response = response_text
            r.response_status = "published"
            r.response_published_at = _now()
        elif risk == "HIGH":
            escalated += 1
        else:
            r.agent_response = response_text
            r.response_status = "draft"
            drafted += 1
        processed += 1

    db.commit()
    return {
        "message": "Reviews processed",
        "processed": processed,
        "responses_drafted": drafted,
        "escalated": escalated,
    }


# ─── Orders (Seller) ─────────────────────────────────────────────────────────

@router.get("/orders")
def get_seller_orders(
    status: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_seller),
):
    product_ids = [
        p.product_id
        for p in db.query(Product).filter(Product.seller_id == current_user.user_id).all()
    ]
    q = (
        db.query(Order)
        .join(OrderItem, Order.order_id == OrderItem.order_id)
        .filter(OrderItem.product_id.in_(product_ids))
        .distinct(Order.order_id)
    )
    if status and status != "all":
        q = q.filter(Order.status == status)

    total = q.count()
    orders = q.order_by(Order.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    return {
        "orders": [
            {
                "order_id": o.order_id,
                "customer_name": o.customer.name if o.customer else "Customer",
                "status": o.status,
                "total_amount": o.total_amount,
                "item_count": len(o.items),
                "created_at": o.created_at,
            }
            for o in orders
        ],
        "total": total,
    }


@router.patch("/orders/{order_id}/status")
@router.put("/orders/{order_id}/status")
def update_order_status(
    order_id: str,
    body: Optional[OrderStatusUpdate] = None,
    status: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_seller),
):
    order = db.query(Order).filter(Order.order_id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    new_status = (body.status if body else None) or status
    if not new_status:
        raise HTTPException(status_code=422, detail="Status must be provided")
    order.status = new_status
    order.updated_at = _now()
    db.commit()
    return {"order_id": order_id, "status": order.status, "updated_at": order.updated_at}


# ─── Finance ─────────────────────────────────────────────────────────────────

@router.get("/finance", response_model=FinanceResponse)
def get_seller_finance(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_seller),
):
    products = db.query(Product).filter(Product.seller_id == current_user.user_id).all()
    product_ids = [p.product_id for p in products]

    orders = (
        db.query(Order)
        .join(OrderItem, Order.order_id == OrderItem.order_id)
        .filter(OrderItem.product_id.in_(product_ids))
        .distinct(Order.order_id)
        .all()
    )

    total_revenue = sum(o.total_amount for o in orders)
    pending_payout = total_revenue * 0.95  # 5% platform fee deduction

    transactions = []
    for o in orders[:20]:
        transactions.append(
            FinanceTransaction(
                transaction_id=f"TXN_{o.order_id.replace('ORD_', '')}",
                transaction_type="sale",
                amount=o.total_amount,
                order_id=o.order_id,
                created_at=o.created_at,
                description=f"Settlement for order {o.order_id}",
            )
        )

    return FinanceResponse(
        total_revenue=round(total_revenue, 2),
        pending_payout=round(pending_payout, 2),
        recent_transactions=transactions,
    )


# ─── Settings ────────────────────────────────────────────────────────────────

@router.get("/settings", response_model=StoreSettingsOut)
def get_store_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_seller),
):
    st = db.query(StoreSettings).filter(StoreSettings.seller_id == current_user.user_id).first()
    if not st:
        st = StoreSettings(
            seller_id=current_user.user_id,
            store_name=f"{current_user.name}'s Store",
            store_description="Official merchant storefront on Vyapari Autonomous Platform.",
            return_policy="30-day money-back guarantee on verified returns.",
            contact_email=current_user.email,
            updated_at=_now(),
        )
        db.add(st)
        db.commit()
        db.refresh(st)
    return StoreSettingsOut(
        store_name=st.store_name,
        store_description=st.store_description,
        return_policy=st.return_policy,
        contact_email=st.contact_email,
    )


@router.put("/settings", response_model=StoreSettingsOut)
def update_store_settings(
    body: StoreSettingsIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_seller),
):
    st = db.query(StoreSettings).filter(StoreSettings.seller_id == current_user.user_id).first()
    if not st:
        st = StoreSettings(seller_id=current_user.user_id)
        db.add(st)
    if body.store_name is not None:
        st.store_name = body.store_name
    if body.store_description is not None:
        st.store_description = body.store_description
    if body.return_policy is not None:
        st.return_policy = body.return_policy
    if body.contact_email is not None:
        st.contact_email = body.contact_email
    st.updated_at = _now()
    db.commit()
    db.refresh(st)
    return StoreSettingsOut(
        store_name=st.store_name,
        store_description=st.store_description,
        return_policy=st.return_policy,
        contact_email=st.contact_email,
    )


# ─── Price Update & History ──────────────────────────────────────────────────

@router.post("/products/{product_id}/price")
def update_product_price(
    product_id: str,
    new_price: float = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_seller),
):
    p = db.query(Product).filter(Product.product_id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    old_p = p.price
    p.price = new_price
    p.updated_at = _now()

    ph = PriceHistory(
        product_id=product_id,
        old_price=old_p,
        new_price=new_price,
        changed_at=_now(),
    )
    db.add(ph)
    db.commit()
    return {"message": "Price updated", "product_id": product_id, "old_price": old_p, "new_price": new_price}


@router.get("/products/{product_id}/price-history", response_model=PriceHistoryResponse)
def get_price_history(
    product_id: str,
    db: Session = Depends(get_db),
):
    history = (
        db.query(PriceHistory)
        .filter(PriceHistory.product_id == product_id)
        .order_by(PriceHistory.changed_at.desc())
        .limit(50)
        .all()
    )
    return PriceHistoryResponse(
        product_id=product_id,
        price_history=[
            PriceHistoryItem(old_price=h.old_price, new_price=h.new_price, changed_at=h.changed_at)
            for h in history
        ],
    )

