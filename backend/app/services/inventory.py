from __future__ import annotations

from datetime import datetime

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.db.database import AgentSetting, Decision, Product

CATEGORY_COMPETITOR_DISCOUNT = {
    "Electronics": 0.05,
    "Clothing": 0.08,
    "Books": 0.03,
    "Home & Kitchen": 0.06,
    "Sports": 0.04,
}


def avg_sales_per_day(product_id: str) -> float:
    # Lightweight deterministic simulation for MVP.
    base = (sum(ord(ch) for ch in product_id) % 7) + 1
    return float(base)


def days_of_stock(product: Product) -> float:
    velocity = avg_sales_per_day(product.id)
    if velocity <= 0:
        return 999.0
    return round(product.stock / velocity, 2)


def should_create_pending_decision(session: Session, product_id: str, decision_type: str) -> bool:
    existing = (
        session.query(Decision)
        .filter(
            and_(
                Decision.product_id == product_id,
                Decision.type == decision_type,
                Decision.status == "pending",
            )
        )
        .first()
    )
    return existing is None


def generate_inventory_decisions(session: Session) -> tuple[int, int]:
    settings = session.query(AgentSetting).filter(AgentSetting.id == 1).one()
    products = session.query(Product).all()

    generated = 0
    for product in products:
        dos = days_of_stock(product)
        velocity = avg_sales_per_day(product.id)

        if dos < settings.restock_threshold_days and product.stock < 20:
            if should_create_pending_decision(session, product.id, "restock"):
                suggested_qty = max(50, int(velocity * settings.restock_buffer_days))
                confidence = 0.9 if dos < 3 else 0.78
                mode = "autonomous" if confidence >= settings.autonomous_confidence_threshold else "advisory"
                decision = Decision(
                    type="restock",
                    product_id=product.id,
                    product_name=product.name,
                    mode=mode,
                    confidence=confidence,
                    reasoning=(
                        f"Stock is projected to run out in {dos} days at avg sales {velocity}/day."
                    ),
                    payload={
                        "current_stock": product.stock,
                        "days_of_stock": dos,
                        "avg_sales_per_day": velocity,
                        "suggested_qty": suggested_qty,
                    },
                    status="pending",
                )
                session.add(decision)
                generated += 1

        competitor_price = round(product.price * (1 - CATEGORY_COMPETITOR_DISCOUNT.get(product.category, 0.05)), 2)
        drift_pct = ((product.price - competitor_price) / competitor_price) * 100 if competitor_price > 0 else 0
        if drift_pct > settings.price_drift_threshold_pct:
            if should_create_pending_decision(session, product.id, "pricing"):
                min_price = product.cost * (1 + settings.minimum_price_margin_pct / 100)
                suggested_price = max(min_price, round(competitor_price * 1.01, 2))
                confidence = 0.82 if drift_pct < 15 else 0.74
                mode = "autonomous" if confidence >= settings.autonomous_confidence_threshold else "advisory"
                decision = Decision(
                    type="pricing",
                    product_id=product.id,
                    product_name=product.name,
                    mode=mode,
                    confidence=confidence,
                    reasoning=(
                        f"Price drift is {drift_pct:.2f}% above competitor benchmark."
                    ),
                    payload={
                        "our_price": product.price,
                        "competitor_price": competitor_price,
                        "drift_pct": round(drift_pct, 2),
                        "suggested_price": round(suggested_price, 2),
                    },
                    status="pending",
                )
                session.add(decision)
                generated += 1

    return len(products), generated


def resolve_decision(session: Session, decision: Decision, action: str, resolved_by: str) -> None:
    decision.status = "approved" if action == "approve" else "rejected"
    decision.resolved_by = resolved_by
    decision.resolved_at = datetime.utcnow()

    if action == "reject":
        return

    product = session.query(Product).filter(Product.id == decision.product_id).one()
    if decision.type == "restock":
        qty = int(decision.payload.get("suggested_qty", 0))
        product.stock += qty
    elif decision.type == "pricing":
        suggested_price = float(decision.payload.get("suggested_price", product.price))
        product.price = round(max(suggested_price, product.cost * 1.10), 2)
