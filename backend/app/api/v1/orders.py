import uuid
import json
from typing import Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Order, OrderItem, CartItem, Product, User
from app.schemas import (
    CheckoutRequest, OrderDetailOut, OrderOut, OrderListResponse, OrderItemOut
)
from app.core.auth import get_current_user

router = APIRouter()


def _now():
    return datetime.now(timezone.utc).isoformat()


def _next_order_id(db: Session) -> str:
    count = db.query(Order).count()
    return f"ORD_{(count + 1):04d}"


@router.post("/orders", response_model=OrderDetailOut, status_code=201)
@router.post("/orders/checkout", response_model=OrderDetailOut, status_code=201)
def checkout(
    body: dict,
    session_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sid = session_id or body.get("session_id") or "guest"
    shipping_addr = body.get("shipping_address", {})
    if isinstance(shipping_addr, dict):
        shipping_json = json.dumps(shipping_addr)
    else:
        shipping_json = str(shipping_addr)

    cart_items = db.query(CartItem).filter(CartItem.session_id == sid).all()
    if not cart_items:
        # Check if items were provided in payload
        payload_items = body.get("items", [])
        if not payload_items:
            raise HTTPException(status_code=400, detail="Cart is empty")
        for pi in payload_items:
            pid = pi.get("product_id")
            p_qty = pi.get("quantity") or pi.get("qty", 1)
            p = db.query(Product).filter(Product.product_id == pid).first()
            if p:
                ci = CartItem(
                    cart_item_id=str(uuid.uuid4()),
                    session_id=sid,
                    product_id=p.product_id,
                    qty=p_qty,
                    added_at=_now(),
                )
                db.add(ci)
        db.commit()
        cart_items = db.query(CartItem).filter(CartItem.session_id == sid).all()

    # Validate stock for all items
    for ci in cart_items:
        if ci.product and ci.product.stock < ci.qty:
            raise HTTPException(
                status_code=400,
                detail=f"'{ci.product.name}' only has {ci.product.stock} units left",
            )

    total = sum(ci.product.price * ci.qty for ci in cart_items)
    order_id = _next_order_id(db)

    order = Order(
        order_id=order_id,
        customer_id=current_user.user_id,
        status="placed",
        total_amount=round(total, 2),
        shipping_address=json.dumps(body.shipping_address.model_dump()),
        created_at=_now(),
        updated_at=_now(),
    )
    db.add(order)

    item_outs = []
    for ci in cart_items:
        p = ci.product
        oi = OrderItem(
            order_item_id=str(uuid.uuid4()),
            order_id=order_id,
            product_id=p.product_id,
            product_name=p.name,
            qty=ci.qty,
            unit_price=p.price,
        )
        db.add(oi)
        p.stock = max(0, p.stock - ci.qty)
        item_outs.append(OrderItemOut(
            product_id=p.product_id,
            product_name=p.name,
            qty=ci.qty,
            unit_price=p.price,
        ))

    # Clear cart
    db.query(CartItem).filter(CartItem.session_id == session_id).delete()
    db.commit()

    return OrderDetailOut(
        order_id=order_id,
        status="placed",
        total_amount=round(total, 2),
        shipping_address=body.shipping_address.model_dump(),
        items=item_outs,
        created_at=order.created_at,
        updated_at=order.updated_at,
    )


@router.get("/orders", response_model=OrderListResponse)
def list_orders(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Order).filter(Order.customer_id == current_user.user_id)
    total = q.count()
    orders = q.order_by(Order.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    out = []
    for o in orders:
        items = [
            OrderItemOut(
                product_id=i.product_id,
                product_name=i.product_name,
                qty=i.qty,
                unit_price=i.unit_price,
            )
            for i in o.items
        ]
        addr = json.loads(o.shipping_address) if o.shipping_address else {}
        out.append(OrderOut(
            order_id=o.order_id,
            status=o.status,
            total_amount=o.total_amount,
            item_count=len(o.items),
            items=items,
            shipping_address=addr,
            created_at=o.created_at,
        ))
    return OrderListResponse(orders=out, total=total)


@router.get("/orders/{order_id}", response_model=OrderDetailOut)
def get_order(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.query(Order).filter(
        Order.order_id == order_id, Order.customer_id == current_user.user_id
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    items = [
        OrderItemOut(
            product_id=i.product_id,
            product_name=i.product_name,
            qty=i.qty,
            unit_price=i.unit_price,
        )
        for i in order.items
    ]
    addr = json.loads(order.shipping_address) if order.shipping_address else {}

    return OrderDetailOut(
        order_id=order.order_id,
        status=order.status,
        total_amount=order.total_amount,
        shipping_address=addr,
        items=items,
        created_at=order.created_at,
        updated_at=order.updated_at,
    )
