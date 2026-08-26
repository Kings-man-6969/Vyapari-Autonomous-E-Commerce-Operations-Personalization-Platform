import json
import uuid
import time
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import Product, Order, OrderItem, Decision


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _days_ago(n: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=n)


def _compute_inventory_status(stock: int, avg_daily: float) -> tuple[str, float]:
    if avg_daily <= 0:
        if stock < 10:
            return "CRITICAL", 9999.0
        return "OK", 9999.0
    days = stock / avg_daily
    if days < 7:
        return "CRITICAL", round(days, 1)
    if days < 30:
        return "WARNING", round(days, 1)
    return "OK", round(days, 1)


def run_inventory_scan(db: Session, seller_id: str) -> dict:
    start = time.time()
    products = db.query(Product).filter(Product.seller_id == seller_id).all()
    cutoff = _days_ago(30)

    decisions_created = 0
    auto_executed = 0
    pending_review = 0
    escalated = 0

    for p in products:
        # Count units sold in last 30 days
        sold = (
            db.query(func.sum(OrderItem.qty))
            .join(Order, OrderItem.order_id == Order.order_id)
            .filter(
                OrderItem.product_id == p.product_id,
                Order.created_at >= cutoff.isoformat(),
            )
            .scalar()
            or 0
        )
        avg_daily = round(sold / 30, 2)
        status, days_rem = _compute_inventory_status(p.stock, avg_daily)

        if status == "OK":
            continue

        # Confidence based on sales data quality
        confidence = 0.90 if avg_daily > 0 else 0.55
        suggested_qty = max(50, int(avg_daily * 30)) if status == "CRITICAL" else max(30, int(avg_daily * 14))
        if suggested_qty == 0:
            suggested_qty = 30

        # Risk + tier
        if confidence >= 0.85 and suggested_qty <= 100:
            risk = "LOW"
            do_auto = True
        elif confidence >= 0.60:
            risk = "MEDIUM"
            do_auto = False
        else:
            risk = "HIGH"
            do_auto = False
            escalated += 1

        action_payload = {
            "action": "RESTOCK",
            "current_stock": p.stock,
            "avg_daily_sales": avg_daily,
            "days_remaining": days_rem if days_rem < 9999 else None,
            "suggested_qty": suggested_qty,
            "reason": f"Stock {status.lower()} — approx {days_rem if days_rem < 9999 else '∞'} days remaining",
        }

        dec_status = "auto_executed" if do_auto else "pending"
        dec = Decision(
            decision_id="DEC_" + str(uuid.uuid4())[:8].upper(),
            agent_type="INVENTORY",
            product_id=p.product_id,
            decision_type="RESTOCK",
            proposed_action=json.dumps(action_payload),
            confidence_score=confidence,
            risk_level=risk,
            decision_status=dec_status,
            created_at=_now(),
            updated_at=_now(),
        )
        db.add(dec)

        if do_auto:
            p.stock += suggested_qty
            p.updated_at = _now()
            auto_executed += 1
        else:
            pending_review += 1

        decisions_created += 1

    db.commit()
    elapsed_ms = int((time.time() - start) * 1000)
    return {
        "message": "Inventory scan complete",
        "decisions_created": decisions_created,
        "auto_executed": auto_executed,
        "pending_review": pending_review,
        "escalated": escalated,
        "scan_duration_ms": elapsed_ms,
    }
