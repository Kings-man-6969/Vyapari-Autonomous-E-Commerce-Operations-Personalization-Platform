from __future__ import annotations

import os
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from svix import Webhook
from svix.webhooks import WebhookVerificationError

from app.auth import AuthContext, DEMO_AUTH_ENABLED, create_demo_token, get_auth_context, get_clerk_subject_from_auth_header, require_customer, require_seller
from app.db.database import (
    AgentSetting,
    AuthAccount,
    CustomerCartItem,
    CustomerOrder,
    Decision,
    Product,
    Review,
    WishlistItem,
    db_session,
)
from app.models import (
    AgentSettingsUpdateRequest,
    ApiResponse,
    AuthRegisterRequest,
    CartAddRequest,
    DecisionResolveRequest,
    ProductCreateRequest,
    ProductPatchRequest,
    ProductUpdateRequest,
    ReviewCreateRequest,
    WishlistAddRequest,
)
from app.services.inventory import days_of_stock, generate_inventory_decisions, resolve_decision
from app.services.reviews import process_pending_reviews

router = APIRouter()


@router.post("/auth/register", response_model=ApiResponse)
def register_auth(request: AuthRegisterRequest, authorization: str | None = Header(default=None)) -> ApiResponse:
    clerk_subject = get_clerk_subject_from_auth_header(authorization)
    with db_session() as session:
        existing = session.get(AuthAccount, clerk_subject)
        if existing and existing.role != request.role:
            raise HTTPException(status_code=409, detail="role already registered for this clerk id")

        if not existing:
            account = AuthAccount(clerk_id=clerk_subject, role=request.role)
            session.add(account)

        token = create_demo_token(clerk_subject, request.role) if DEMO_AUTH_ENABLED else ""
        return ApiResponse(data={"clerk_id": clerk_subject, "role": request.role, "token": token})


@router.post("/webhooks/clerk", response_model=ApiResponse)
async def clerk_webhook(
    request: Request,
    svix_id: str | None = Header(default=None, alias="svix-id"),
    svix_timestamp: str | None = Header(default=None, alias="svix-timestamp"),
    svix_signature: str | None = Header(default=None, alias="svix-signature"),
) -> ApiResponse:
    webhook_secret = os.getenv("CLERK_WEBHOOK_SECRET", "").strip()
    if not webhook_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CLERK_WEBHOOK_SECRET is not configured",
        )

    payload = await request.body()
    headers = {
        "svix-id": svix_id or "",
        "svix-timestamp": svix_timestamp or "",
        "svix-signature": svix_signature or "",
    }

    try:
        event = Webhook(webhook_secret).verify(payload, headers)
    except WebhookVerificationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid webhook signature") from exc

    if not isinstance(event, dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid webhook payload")

    event_type = str(event.get("type") or "")
    event_data = event.get("data")
    if not isinstance(event_data, dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid webhook data")

    clerk_id = str(event_data.get("id") or "").strip()

    if event_type == "user.deleted" and clerk_id:
        with db_session() as session:
            account = session.get(AuthAccount, clerk_id)
            if account:
                session.delete(account)
        return ApiResponse(data={"ok": True, "event": event_type, "clerk_id": clerk_id})

    if event_type in {"user.created", "user.updated"} and clerk_id:
        role = None
        public_metadata = event_data.get("public_metadata")
        if isinstance(public_metadata, dict):
            role_value = public_metadata.get("role")
            if role_value in {"customer", "seller"}:
                role = role_value

        if role:
            with db_session() as session:
                account = session.get(AuthAccount, clerk_id)
                if not account:
                    session.add(AuthAccount(clerk_id=clerk_id, role=role))

        return ApiResponse(data={"ok": True, "event": event_type, "clerk_id": clerk_id})

    return ApiResponse(data={"ok": True, "event": event_type})


@router.get("/auth/me", response_model=ApiResponse)
def auth_me(auth: AuthContext = Depends(get_auth_context)) -> ApiResponse:
    return ApiResponse(data={"clerk_id": auth.clerk_id, "role": auth.role})


@router.get("/me/profile", response_model=ApiResponse)
def me_profile(auth: AuthContext = Depends(require_customer)) -> ApiResponse:
    return ApiResponse(
        data={
            "clerk_id": auth.clerk_id,
            "role": auth.role,
            "display_name": auth.clerk_id.replace("_", " ").title(),
            "preferences": {
                "currency": "INR",
                "language": "en-IN",
            },
        }
    )


@router.get("/me/orders", response_model=ApiResponse)
def me_orders(auth: AuthContext = Depends(require_customer)) -> ApiResponse:
    with db_session() as session:
        orders = (
            session.query(CustomerOrder)
            .filter(CustomerOrder.clerk_id == auth.clerk_id)
            .order_by(CustomerOrder.created_at.desc())
            .all()
        )
        return ApiResponse(
            data=[
                {
                    "id": order.id,
                    "status": order.status,
                    "total_amount": order.total_amount,
                    "items": order.items,
                    "created_at": order.created_at.isoformat(),
                }
                for order in orders
            ]
        )


@router.get("/me/orders/{order_id}", response_model=ApiResponse)
def me_order_detail(order_id: str, auth: AuthContext = Depends(require_customer)) -> ApiResponse:
    with db_session() as session:
        order = (
            session.query(CustomerOrder)
            .filter(CustomerOrder.id == order_id, CustomerOrder.clerk_id == auth.clerk_id)
            .one_or_none()
        )
        if not order:
            raise HTTPException(status_code=404, detail="order not found")

        return ApiResponse(
            data={
                "id": order.id,
                "status": order.status,
                "total_amount": order.total_amount,
                "items": order.items,
                "created_at": order.created_at.isoformat(),
            }
        )


@router.get("/wishlist", response_model=ApiResponse)
def get_wishlist(auth: AuthContext = Depends(require_customer)) -> ApiResponse:
    with db_session() as session:
        items = session.query(WishlistItem).filter(WishlistItem.clerk_id == auth.clerk_id).all()
        data = []
        for item in items:
            product = session.query(Product).filter(Product.id == item.product_id).one_or_none()
            if not product:
                continue
            data.append(
                {
                    "id": item.id,
                    "product_id": product.id,
                    "name": product.name,
                    "category": product.category,
                    "price": product.price,
                    "stock": product.stock,
                    "description": product.description,
                    "created_at": item.created_at.isoformat(),
                }
            )
        return ApiResponse(data=data)


@router.post("/wishlist", response_model=ApiResponse)
def add_wishlist(request: WishlistAddRequest, auth: AuthContext = Depends(require_customer)) -> ApiResponse:
    with db_session() as session:
        product = session.query(Product).filter(Product.id == request.product_id).one_or_none()
        if not product:
            raise HTTPException(status_code=404, detail="product not found")

        existing = (
            session.query(WishlistItem)
            .filter(WishlistItem.clerk_id == auth.clerk_id, WishlistItem.product_id == request.product_id)
            .one_or_none()
        )
        if not existing:
            session.add(WishlistItem(clerk_id=auth.clerk_id, product_id=request.product_id))

    return get_wishlist(auth)


@router.delete("/wishlist/{product_id}", response_model=ApiResponse)
def remove_wishlist(product_id: str, auth: AuthContext = Depends(require_customer)) -> ApiResponse:
    with db_session() as session:
        item = (
            session.query(WishlistItem)
            .filter(WishlistItem.clerk_id == auth.clerk_id, WishlistItem.product_id == product_id)
            .one_or_none()
        )
        if item:
            session.delete(item)

    return get_wishlist(auth)


@router.get("/cart", response_model=ApiResponse)
def get_cart(auth: AuthContext = Depends(require_customer)) -> ApiResponse:
    with db_session() as session:
        cart_items = session.query(CustomerCartItem).filter(CustomerCartItem.clerk_id == auth.clerk_id).all()

        data = []
        for item in cart_items:
            product = session.query(Product).filter(Product.id == item.product_id).one_or_none()
            if not product:
                continue
            data.append(
                {
                    "id": item.id,
                    "product_id": product.id,
                    "name": product.name,
                    "price": product.price,
                    "qty": item.qty,
                    "subtotal": round(product.price * item.qty, 2),
                }
            )

        return ApiResponse(data=data)


@router.post("/cart/add", response_model=ApiResponse)
def add_cart(request: CartAddRequest, auth: AuthContext = Depends(require_customer)) -> ApiResponse:
    with db_session() as session:
        product = session.query(Product).filter(Product.id == request.product_id).one_or_none()
        if not product:
            raise HTTPException(status_code=404, detail="product not found")

        existing = (
            session.query(CustomerCartItem)
            .filter(CustomerCartItem.clerk_id == auth.clerk_id, CustomerCartItem.product_id == request.product_id)
            .one_or_none()
        )
        if existing:
            existing.qty += request.qty
        else:
            session.add(CustomerCartItem(clerk_id=auth.clerk_id, product_id=request.product_id, qty=request.qty))

        return get_cart(auth)


@router.delete("/cart/{item_id}", response_model=ApiResponse)
def remove_cart_item(item_id: int, auth: AuthContext = Depends(require_customer)) -> ApiResponse:
    with db_session() as session:
        item = (
            session.query(CustomerCartItem)
            .filter(CustomerCartItem.id == item_id, CustomerCartItem.clerk_id == auth.clerk_id)
            .one_or_none()
        )
        if not item:
            raise HTTPException(status_code=404, detail="cart item not found")

        session.delete(item)
        return get_cart(auth)


@router.post("/cart/checkout", response_model=ApiResponse)
def checkout_cart(auth: AuthContext = Depends(require_customer)) -> ApiResponse:
    with db_session() as session:
        cart_items = session.query(CustomerCartItem).filter(CustomerCartItem.clerk_id == auth.clerk_id).all()
        if not cart_items:
            raise HTTPException(status_code=400, detail="cart is empty")

        total = 0.0
        items_data = []

        for item in cart_items:
            product = session.query(Product).filter(Product.id == item.product_id).one_or_none()
            if not product or product.stock < item.qty:
                raise HTTPException(status_code=400, detail=f"not enough stock for product {item.product_id}")
            
            subtotal = product.price * item.qty
            total += subtotal
            product.stock -= item.qty
            
            items_data.append({
                "product_id": product.id,
                "name": product.name,
                "price": product.price,
                "qty": item.qty,
                "subtotal": subtotal
            })
            
            session.delete(item)

        total_with_tax = float(total * 1.18)
        order_count = session.query(CustomerOrder).count()
        order_id = f"ORD-{order_count + 1000}"
        
        order = CustomerOrder(
            id=order_id,
            clerk_id=auth.clerk_id,
            status="placed",
            total_amount=round(total_with_tax, 2),
            items=items_data
        )
        session.add(order)
        
        return ApiResponse(data={"order_id": order.id, "total": round(total_with_tax, 2)})

@router.get("/health", response_model=ApiResponse)
def health() -> ApiResponse:
    return ApiResponse(data={"ok": True})


@router.get("/products", response_model=ApiResponse)
def list_products(
    category: str | None = None,
    sort: str | None = Query(default=None, pattern="^(relevance|price_asc|price_desc|newest|top_rated)?$"),
    in_stock: bool | None = None,
) -> ApiResponse:
    with db_session() as session:
        query = session.query(Product)
        if category:
            query = query.filter(Product.category == category)
        if in_stock:
            query = query.filter(Product.stock > 0)

        products = query.all()
        if sort == "price_asc":
            products.sort(key=lambda p: p.price)
        elif sort == "price_desc":
            products.sort(key=lambda p: p.price, reverse=True)
        elif sort == "newest":
            products.sort(key=lambda p: p.created_at, reverse=True)

        data = [
            {
                "id": p.id,
                "name": p.name,
                "category": p.category,
                "price": p.price,
                "cost": p.cost,
                "stock": p.stock,
                "description": p.description,
            }
            for p in products
        ]
        return ApiResponse(data=data)


@router.get("/products/{product_id}", response_model=ApiResponse)
def get_product(product_id: str) -> ApiResponse:
    with db_session() as session:
        product = session.query(Product).filter(Product.id == product_id).one_or_none()
        if not product:
            raise HTTPException(status_code=404, detail="product not found")

        reviews = session.query(Review).filter(Review.product_id == product_id).all()
        return ApiResponse(
            data={
                "id": product.id,
                "name": product.name,
                "category": product.category,
                "price": product.price,
                "cost": product.cost,
                "stock": product.stock,
                "description": product.description,
                "reviews": [
                    {
                        "id": r.id,
                        "stars": r.stars,
                        "text": r.text,
                        "sentiment": r.sentiment,
                        "sentiment_confidence": r.sentiment_confidence,
                        "status": r.status,
                        "published_response": r.draft_response if r.status == "published" else None,
                    }
                    for r in reviews
                ],
            }
        )


@router.post("/products", response_model=ApiResponse)
def create_product(request: ProductCreateRequest, _: AuthContext = Depends(require_seller)) -> ApiResponse:
    with db_session() as session:
        if request.price < request.cost * 1.10:
            raise HTTPException(status_code=400, detail="price violates minimum margin rule")

        current_count = session.query(Product).count()
        product_id = f"P{current_count + 1:03d}"
        product = Product(
            id=product_id,
            name=request.name,
            category=request.category,
            price=round(request.price, 2),
            cost=round(request.cost, 2),
            stock=request.stock,
            description=request.description,
        )
        session.add(product)
        return ApiResponse(data={"id": product_id})


@router.put("/products/{product_id}", response_model=ApiResponse)
def update_product(product_id: str, request: ProductUpdateRequest, _: AuthContext = Depends(require_seller)) -> ApiResponse:
    with db_session() as session:
        product = session.query(Product).filter(Product.id == product_id).one_or_none()
        if not product:
            raise HTTPException(status_code=404, detail="product not found")

        updates = request.model_dump(exclude_unset=True)
        proposed_price = float(updates.get("price", product.price))
        proposed_cost = float(updates.get("cost", product.cost))
        if proposed_price < proposed_cost * 1.10:
            raise HTTPException(status_code=400, detail="price violates minimum margin rule")

        for field, value in updates.items():
            setattr(product, field, value)

        product.updated_at = datetime.utcnow()
        return ApiResponse(
            data={
                "id": product.id,
                "name": product.name,
                "category": product.category,
                "price": product.price,
                "cost": product.cost,
                "stock": product.stock,
                "description": product.description,
            }
        )


@router.delete("/products/{product_id}", response_model=ApiResponse)
def delete_product(product_id: str, _: AuthContext = Depends(require_seller)) -> ApiResponse:
    with db_session() as session:
        product = session.query(Product).filter(Product.id == product_id).one_or_none()
        if not product:
            raise HTTPException(status_code=404, detail="product not found")

        session.delete(product)
        return ApiResponse(data={"ok": True})


@router.patch("/products/{product_id}", response_model=ApiResponse)
def patch_product(product_id: str, request: ProductPatchRequest, _: AuthContext = Depends(require_seller)) -> ApiResponse:
    with db_session() as session:
        product = session.query(Product).filter(Product.id == product_id).one_or_none()
        if not product:
            raise HTTPException(status_code=404, detail="product not found")

        if request.field == "stock":
            stock_value = int(request.value)
            if stock_value < 0:
                raise HTTPException(status_code=400, detail="stock cannot be negative")
            product.stock = stock_value
        elif request.field == "price":
            price = float(request.value)
            minimum = product.cost * 1.10
            if price < minimum:
                raise HTTPException(status_code=400, detail=f"price must be >= {minimum:.2f}")
            product.price = round(price, 2)
        elif request.field == "cost":
            cost = float(request.value)
            if cost <= 0:
                raise HTTPException(status_code=400, detail="cost must be > 0")
            if product.price < cost * 1.10:
                raise HTTPException(status_code=400, detail="existing price violates minimum margin rule")
            product.cost = round(cost, 2)
        else:
            setattr(product, request.field, request.value)

        product.updated_at = datetime.utcnow()
        return ApiResponse(
            data={
                "id": product.id,
                "name": product.name,
                "category": product.category,
                "price": product.price,
                "cost": product.cost,
                "stock": product.stock,
                "description": product.description,
            }
        )


@router.get("/search", response_model=ApiResponse)
def search(q: str = Query(min_length=2), top_n: int = 8) -> ApiResponse:
    with db_session() as session:
        products = session.query(Product).all()
        lower = q.lower()
        matches = [
            p
            for p in products
            if lower in p.name.lower() or lower in p.description.lower() or lower in p.category.lower()
        ]
        if not matches:
            matches = sorted(products, key=lambda p: p.stock, reverse=True)

        data = [
            {
                "id": p.id,
                "name": p.name,
                "category": p.category,
                "price": p.price,
                "match": "keyword match" if lower in p.name.lower() else "popular fallback",
            }
            for p in matches[:top_n]
        ]
        return ApiResponse(data=data)


@router.get("/recommendations/{user_id}", response_model=ApiResponse)
def recommendations(user_id: str, top_n: int = 6) -> ApiResponse:
    with db_session() as session:
        products = session.query(Product).all()
        seed = sum(ord(c) for c in user_id) % 5
        ranked = sorted(products, key=lambda p: ((p.stock + seed) % 11, -p.price), reverse=True)
        data = []
        for idx, p in enumerate(ranked[:top_n]):
            data.append(
                {
                    "id": p.id,
                    "name": p.name,
                    "category": p.category,
                    "price": p.price,
                    "stock": p.stock,
                    "source": "For You" if idx < 3 else "Popular",
                }
            )
        return ApiResponse(data=data)


@router.post("/reviews", response_model=ApiResponse)
def create_review(request: ReviewCreateRequest, _: AuthContext = Depends(require_customer)) -> ApiResponse:
    with db_session() as session:
        product = session.query(Product).filter(Product.id == request.product_id).one_or_none()
        if not product:
            raise HTTPException(status_code=404, detail="product not found")

        review_id = f"R{session.query(Review).count() + 1:03d}"
        review = Review(
            id=review_id,
            product_id=request.product_id,
            user=request.user_id,
            stars=request.stars,
            text=request.text,
            status="pending",
        )
        session.add(review)
        return ApiResponse(data={"id": review_id, "status": "pending"})


@router.get("/reviews", response_model=ApiResponse)
def list_reviews(status: str | None = None, _: AuthContext = Depends(require_seller)) -> ApiResponse:
    with db_session() as session:
        query = session.query(Review)
        if status:
            query = query.filter(Review.status == status)
        reviews = query.order_by(Review.id.desc()).all()

        return ApiResponse(
            data=[
                {
                    "id": r.id,
                    "product_id": r.product_id,
                    "stars": r.stars,
                    "text": r.text,
                    "sentiment": r.sentiment,
                    "sentiment_confidence": r.sentiment_confidence,
                    "sentiment_source": r.sentiment_source,
                    "escalated": r.escalated,
                    "escalation_reason": r.escalation_reason,
                    "draft_response": r.draft_response,
                    "status": r.status,
                }
                for r in reviews
            ]
        )


@router.post("/reviews/process", response_model=ApiResponse)
def process_reviews(_: AuthContext = Depends(require_seller)) -> ApiResponse:
    with db_session() as session:
        processed = process_pending_reviews(session)
        return ApiResponse(data={"processed": processed})


@router.post("/reviews/{review_id}/approve", response_model=ApiResponse)
def approve_review(review_id: str, response: dict, _: AuthContext = Depends(require_seller)) -> ApiResponse:
    with db_session() as session:
        review = session.query(Review).filter(Review.id == review_id).one_or_none()
        if not review:
            raise HTTPException(status_code=404, detail="review not found")

        review.draft_response = str(response.get("response", review.draft_response or ""))
        review.status = "published"
        review.published_at = datetime.utcnow()
        return ApiResponse(data={"ok": True, "status": "published"})


@router.post("/reviews/{review_id}/reject", response_model=ApiResponse)
def reject_review(review_id: str, _: AuthContext = Depends(require_seller)) -> ApiResponse:
    with db_session() as session:
        review = session.query(Review).filter(Review.id == review_id).one_or_none()
        if not review:
            raise HTTPException(status_code=404, detail="review not found")

        review.status = "rejected"
        return ApiResponse(data={"ok": True, "status": "rejected"})


@router.get("/stats", response_model=ApiResponse)
def get_stats(_: AuthContext = Depends(require_seller)) -> ApiResponse:
    with db_session() as session:
        products = session.query(Product).all()
        decisions = session.query(Decision).filter(Decision.status == "pending").all()
        reviews = session.query(Review).all()
        orders = session.query(CustomerOrder).all()

        critical = 0
        warning = 0
        for product in products:
            dos = days_of_stock(product)
            if dos < 3:
                critical += 1
            elif dos < 7:
                warning += 1

        total_revenue = sum((o.total_amount for o in orders if o.status != "cancelled"), 0.0)

        data = {
            "total_products": len(products),
            "critical_stock_items": critical,
            "stock_warning_items": warning,
            "pending_agent_decisions": len(decisions),
            "pending_reviews": sum(1 for r in reviews if r.status == "pending"),
            "escalated_reviews": sum(1 for r in reviews if r.status == "escalated"),
            "total_revenue": round(total_revenue, 2),
        }
        return ApiResponse(data=data)


@router.get("/inventory", response_model=ApiResponse)
def inventory(_: AuthContext = Depends(require_seller)) -> ApiResponse:
    with db_session() as session:
        products = session.query(Product).all()
        return ApiResponse(
            data=[
                {
                    "id": p.id,
                    "name": p.name,
                    "category": p.category,
                    "price": p.price,
                    "cost": p.cost,
                    "stock": p.stock,
                    "avg_sales_day": round((sum(ord(ch) for ch in p.id) % 7) + 1, 2),
                    "days_stock_remaining": days_of_stock(p),
                    "status": "CRITICAL"
                    if days_of_stock(p) < 3
                    else "WARNING"
                    if days_of_stock(p) < 7
                    else "OK",
                }
                for p in products
            ]
        )


@router.post("/inventory/scan", response_model=ApiResponse)
def scan_inventory(_: AuthContext = Depends(require_seller)) -> ApiResponse:
    with db_session() as session:
        scanned, generated = generate_inventory_decisions(session)
        return ApiResponse(data={"scanned": scanned, "new_decisions": generated})


@router.get("/pricing", response_model=ApiResponse)
def pricing_monitor(_: AuthContext = Depends(require_seller)) -> ApiResponse:
    with db_session() as session:
        products = session.query(Product).all()
        rows = []
        for index, product in enumerate(products):
            competitor_price = round(product.price * (0.88 + ((sum(ord(ch) for ch in product.id) + index) % 9) * 0.02), 2)
            diff_pct = round(((product.price - competitor_price) / competitor_price) * 100, 2) if competitor_price else 0.0
            suggested_price = round(max(product.cost * 1.10, competitor_price * 0.98), 2)
            status = "OVERPRICED" if diff_pct > 10 else "UNDERPRICED" if diff_pct < 0 else "OK"
            rows.append(
                {
                    "id": product.id,
                    "name": product.name,
                    "category": product.category,
                    "our_price": product.price,
                    "competitor_price": competitor_price,
                    "diff_pct": diff_pct,
                    "suggested_price": suggested_price,
                    "status": status,
                }
            )
        return ApiResponse(data=rows)


@router.get("/analytics", response_model=ApiResponse)
def analytics(_: AuthContext = Depends(require_seller)) -> ApiResponse:
    with db_session() as session:
        products = session.query(Product).all()
        reviews = session.query(Review).all()
        orders = session.query(CustomerOrder).all()

        stock_health = {"Critical": 0, "Warning": 0, "OK": 0}
        for product in products:
            stock_health[
                "Critical" if days_of_stock(product) < 3 else "Warning" if days_of_stock(product) < 7 else "OK"
            ] += 1

        category_revenue = {product.category: 0.0 for product in products}
        sales_by_product: dict[str, dict[date, int]] = {product.id: {} for product in products}

        for order in orders:
            order_date = order.created_at.date()
            for item in order.items or []:
                product_id = str(item.get("product_id", ""))
                qty = int(item.get("qty", 0) or 0)
                product = session.query(Product).filter(Product.id == product_id).one_or_none()
                if not product:
                    continue
                sales_by_product.setdefault(product.id, {})[order_date] = sales_by_product.setdefault(product.id, {}).get(order_date, 0) + qty
                category_revenue[product.category] = round(category_revenue.get(product.category, 0.0) + float(item.get("subtotal", product.price * qty)), 2)

        today = datetime.utcnow().date()
        days = [today - timedelta(days=offset) for offset in range(6, -1, -1)]
        top_products = sorted(products, key=lambda product: sum(sales_by_product.get(product.id, {}).values()), reverse=True)[:5]
        if not top_products:
            top_products = products[:5]

        sales_velocity = []
        for current_day in days:
            day_entry = {"day": current_day.isoformat(), "products": []}
            for product in top_products:
                actual = sales_by_product.get(product.id, {}).get(current_day)
                if actual is None:
                    actual = max(0, ((sum(ord(ch) for ch in product.id) + current_day.day) % 6) - 1)
                day_entry["products"].append({"product_id": product.id, "product_name": product.name, "units": actual})
            sales_velocity.append(day_entry)

        sentiment_distribution = {"Positive": 0, "Neutral": 0, "Negative": 0}
        for review in reviews:
            sentiment = (review.sentiment or "neutral").capitalize()
            if sentiment not in sentiment_distribution:
                sentiment = "Neutral"
            sentiment_distribution[sentiment] += 1

        return ApiResponse(
            data={
                "sales_velocity": sales_velocity,
                "stock_health": [{"status": key, "count": value} for key, value in stock_health.items()],
                "category_revenue": [
                    {"category": key, "revenue": round(value, 2)} for key, value in category_revenue.items()
                ],
                "sentiment_distribution": [
                    {"label": key, "count": value} for key, value in sentiment_distribution.items()
                ],
                "top_products": [{"id": product.id, "name": product.name} for product in top_products],
            }
        )


@router.get("/decisions/pending", response_model=ApiResponse)
def pending_decisions(_: AuthContext = Depends(require_seller)) -> ApiResponse:
    with db_session() as session:
        decisions = (
            session.query(Decision)
            .filter(Decision.status == "pending")
            .order_by(Decision.confidence.desc(), Decision.created_at.desc())
            .all()
        )
        return ApiResponse(
            data=[
                {
                    "id": d.id,
                    "type": d.type,
                    "product_id": d.product_id,
                    "product_name": d.product_name,
                    "mode": d.mode,
                    "confidence": d.confidence,
                    "reasoning": d.reasoning,
                    "payload": d.payload,
                    "status": d.status,
                    "created_at": d.created_at.isoformat(),
                }
                for d in decisions
            ]
        )


@router.get("/decisions", response_model=ApiResponse)
def all_decisions(limit: int = 50, _: AuthContext = Depends(require_seller)) -> ApiResponse:
    with db_session() as session:
        decisions = session.query(Decision).order_by(Decision.id.desc()).limit(limit).all()
        return ApiResponse(
            data=[
                {
                    "id": d.id,
                    "type": d.type,
                    "product_id": d.product_id,
                    "product_name": d.product_name,
                    "mode": d.mode,
                    "confidence": d.confidence,
                    "reasoning": d.reasoning,
                    "payload": d.payload,
                    "status": d.status,
                    "created_at": d.created_at.isoformat(),
                    "resolved_at": d.resolved_at.isoformat() if d.resolved_at else None,
                    "resolved_by": d.resolved_by,
                }
                for d in decisions
            ]
        )


@router.post("/decisions/{decision_id}/resolve", response_model=ApiResponse)
def resolve(decision_id: int, request: DecisionResolveRequest, _: AuthContext = Depends(require_seller)) -> ApiResponse:
    with db_session() as session:
        decision = session.query(Decision).filter(Decision.id == decision_id).one_or_none()
        if not decision:
            raise HTTPException(status_code=404, detail="decision not found")
        if decision.status != "pending":
            raise HTTPException(status_code=409, detail="decision already resolved")

        resolve_decision(session, decision, request.action, request.resolved_by)
        return ApiResponse(data={"ok": True, "status": decision.status})


@router.get("/settings", response_model=ApiResponse)
def get_settings(_: AuthContext = Depends(require_seller)) -> ApiResponse:
    with db_session() as session:
        settings = session.query(AgentSetting).filter(AgentSetting.id == 1).one()
        return ApiResponse(
            data={
                "restock_threshold_days": settings.restock_threshold_days,
                "restock_buffer_days": settings.restock_buffer_days,
                "price_drift_threshold_pct": settings.price_drift_threshold_pct,
                "minimum_price_margin_pct": settings.minimum_price_margin_pct,
                "escalation_star_threshold": settings.escalation_star_threshold,
                "sentiment_confidence_min": settings.sentiment_confidence_min,
                "autonomous_confidence_threshold": settings.autonomous_confidence_threshold,
                "max_auto_drafts_per_run": settings.max_auto_drafts_per_run,
            }
        )


@router.post("/settings", response_model=ApiResponse)
def update_settings(request: AgentSettingsUpdateRequest, _: AuthContext = Depends(require_seller)) -> ApiResponse:
    with db_session() as session:
        settings = session.query(AgentSetting).filter(AgentSetting.id == 1).one()
        for key, value in request.model_dump().items():
            setattr(settings, key, value)
        return ApiResponse(data={"ok": True, "updated": True})


@router.get("/agent-status", response_model=ApiResponse)
def agent_status(_: AuthContext = Depends(require_seller)) -> ApiResponse:
    now = datetime.utcnow().isoformat()
    return _agent_status_payload(now)


@router.get("/hitl/agents", response_model=ApiResponse)
def hitl_agents(_: AuthContext = Depends(require_seller)) -> ApiResponse:
    now = datetime.utcnow().isoformat()
    return _agent_status_payload(now)


def _agent_status_payload(now: str) -> ApiResponse:
    return ApiResponse(
        data={
            "recommendation_agent": {
                "status": "healthy",
                "last_run": now,
                "details": "fallback recommender active",
            },
            "inventory_pricing_agent": {
                "status": "healthy",
                "last_run": now,
                "details": "manual scan trigger available",
            },
            "review_response_agent": {
                "status": "healthy",
                "last_run": now,
                "details": "rule-based sentiment + template drafts",
            },
        }
    )
